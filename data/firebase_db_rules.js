{
  "rules": {
    /* GUARDIAN DEFAULT: Deny all reads and writes by default */
    ".read": false,
    ".write": false,

    /* 1. PUBLIC READ, ENOCK-ONLY WRITE (The Core Infrastructure) */
    "config": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'"
    },
    "schedules": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'"
    },
    "notices": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'"
    },
    "exclusions": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'"
    },
    "disruptions": {
      ".read": true,
      ".write": "auth != null"
    },

    /* 2. MULTI-ADMIN READ, PUBLIC WRITE (The Data Ingestion Pipelines) */
    "feedback": {
      // Both Enock and Thandeka can read the feedback list
      ".read": "auth != null && (auth.token.email === 'enockelk@gmail.com' || auth.token.email === 'thandeka05nxumalo@gmail.com')",
      
      "$feedbackId": {
        // Commuters can create. ONLY Enock can update/resolve. Thandeka cannot alter feedback.
        ".write": "auth != null && (!data.exists() || auth.token.email === 'enockelk@gmail.com')",
        ".validate": "newData.hasChildren(['type', 'text', 'timestamp']) && newData.child('text').isString() && newData.child('text').val().length < 3000 && newData.child('type').val().length < 50"
      }
    },
    "votes": {
      // Both Enock and Thandeka can read the voting totals
      ".read": "auth != null && (auth.token.email === 'enockelk@gmail.com' || auth.token.email === 'thandeka05nxumalo@gmail.com')",
      
      "$voteId": {
        ".write": "auth != null && !data.exists()",
        ".validate": "newData.hasChildren(['region', 'timestamp']) && newData.child('region').isString() && newData.child('region').val().length < 10"
      }
    },

    /* GUARDIAN PHASE 7: SILENT TELEMETRY(metrics) PIPELINE */
    "metrics": {
      // Both admins can view the diagnostic dashboards
      ".read": "auth != null && (auth.token.email === 'enockelk@gmail.com' || auth.token.email === 'thandeka05nxumalo@gmail.com')",
      
      "crashes": {
        // Admin can clear the DB
        ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'",
        "$crashId": {
          // App can silently POST logs without an auth token
          ".write": "!data.exists()"
        }
      },
      "routing_fails": {
        // Admin can clear the DB
        ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'",
        "$deadEndId": {
          // App can silently POST logs without an auth token
          ".write": "!data.exists()"
        }
      }
    },

    /* 3. ARCHIVE PROTOCOLS (Enock and Thandeka can read, Only Enock can write) */
    "notices_archive": {
      ".read": "auth != null && (auth.token.email === 'enockelk@gmail.com' || auth.token.email === 'thandeka05nxumalo@gmail.com')",
      ".write": "auth != null && auth.token.email === 'enockelk@gmail.com'"
    }
  }
}