// --- METRORAIL MAP VIEWER (V4.46 - Guardian Fixed) ---
// Handles the pinch-to-zoom image viewer for the static network map.

let mapModal, closeMapBtn, closeMapBtn2, viewMapBtn;
let mapContainer, mapImage, mapZoomIn, mapZoomOut;

// STATE VARIABLES
let scale = 1;
let pointX = 0;
let pointY = 0;
let panning = false;
let startX = 0;
let startY = 0;

// GESTURE VARIABLES
let initialPinchDistance = null;
let initialScale = 1;
let lastTap = 0;

function setupMapLogic() {
    console.log("Map Viewer: Initializing...");

    mapModal = document.getElementById('map-modal');
    closeMapBtn = document.getElementById('close-map-btn');
    closeMapBtn2 = document.getElementById('close-map-btn-2');
    viewMapBtn = document.getElementById('view-map-btn');
    
    mapContainer = document.getElementById('map-container');
    mapImage = document.getElementById('map-image');
    mapZoomIn = document.getElementById('map-zoom-in');
    mapZoomOut = document.getElementById('map-zoom-out');

    if (!mapModal) {
        console.error("Map Viewer: Map Modal not found in DOM.");
        return;
    }
    
    if (!viewMapBtn) {
        console.error("Map Viewer: View Map Button not found in DOM.");
        return;
    }

    const resetMap = () => {
        scale = 1;
        pointX = 0;
        pointY = 0;
        if(mapImage) {
            mapImage.style.transform = `translate(0px, 0px) scale(1)`;
        }
    };

    const updateTransform = () => {
        if(mapImage) {
            mapImage.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        }
    };

    const openMap = () => {
        console.log("Map Viewer: Opening Map...");
        mapModal.classList.remove('hidden');
        resetMap();
        
        // Close Sidenav if open
        const sidenav = document.getElementById('sidenav');
        const sidenavOverlay = document.getElementById('sidenav-overlay');
        if(sidenav) {
            sidenav.classList.remove('open');
            if(sidenavOverlay) sidenavOverlay.classList.remove('open');
            document.body.classList.remove('sidenav-open');
        }
    };

    const closeMap = () => {
        mapModal.classList.add('hidden');
    };

    // --- BINDING EVENTS ---
    // Remove old listeners to prevent duplicates (not easily possible with anon funcs, but safe to re-add on reload)
    viewMapBtn.onclick = openMap; // Direct assignment to ensure it works
    
    if (closeMapBtn) closeMapBtn.onclick = closeMap;
    if (closeMapBtn2) closeMapBtn2.onclick = closeMap;

    // --- BUTTON ZOOM ---
    if (mapZoomIn) {
        mapZoomIn.onclick = (e) => {
            e.stopPropagation();
            scale += 0.5;
            updateTransform();
        };
    }

    if (mapZoomOut) {
        mapZoomOut.onclick = (e) => {
            e.stopPropagation();
            if (scale > 1) { 
                scale -= 0.5;
                if (scale < 1) scale = 1;
                if(scale === 1) { pointX = 0; pointY = 0; }
                updateTransform();
            }
        };
    }

    // --- MOUSE PAN ---
    if (mapContainer) {
        mapContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            panning = true;
        });

        mapContainer.addEventListener('mouseup', () => { panning = false; });
        mapContainer.addEventListener('mouseleave', () => { panning = false; });

        mapContainer.addEventListener('mousemove', (e) => {
            if (!panning) return;
            e.preventDefault();
            
            if (scale <= 1) { pointX = 0; pointY = 0; updateTransform(); return; }

            let nextX = e.clientX - startX;
            let nextY = e.clientY - startY;
            
            // Limit Panning based on Scale
            const limitX = (mapContainer.offsetWidth * scale - mapContainer.offsetWidth) / 2;
            const limitY = (mapContainer.offsetHeight * scale - mapContainer.offsetHeight) / 2;

            const safeLimitX = Math.max(0, limitX);
            const safeLimitY = Math.max(0, limitY);

            if (nextX > safeLimitX) nextX = safeLimitX;
            if (nextX < -safeLimitX) nextX = -safeLimitX;
            if (nextY > safeLimitY) nextY = safeLimitY;
            if (nextY < -safeLimitY) nextY = -safeLimitY;

            pointX = nextX;
            pointY = nextY;
            updateTransform();
        });
        
        // --- TOUCH GESTURES (PINCH & DOUBLE TAP) ---
        mapContainer.addEventListener('touchstart', (e) => {
            // 1. PINCH START (2 Fingers)
            if (e.touches.length === 2) {
                e.preventDefault();
                panning = false;
                initialPinchDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialScale = scale;
                return;
            }
    
            // 2. PAN / DOUBLE-TAP (1 Finger)
            if (e.touches.length === 1) {
                // Double Tap Check
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                
                if (tapLength < 300 && tapLength > 0) {
                    e.preventDefault();
                    if (scale > 1) {
                        resetMap(); 
                    } else {
                        scale = 2.5; 
                        updateTransform();
                    }
                    lastTap = 0;
                    return;
                }
                lastTap = currentTime;
    
                startX = e.touches[0].clientX - pointX;
                startY = e.touches[0].clientY - pointY;
                panning = true;
            }
        }, {passive: false}); // Important for iOS
        
        mapContainer.addEventListener('touchmove', (e) => {
            // 1. PINCH MOVE (2 Fingers)
            if (e.touches.length === 2 && initialPinchDistance) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                
                const pinchFactor = currentDistance / initialPinchDistance;
                let newScale = initialScale * pinchFactor;
    
                if (newScale < 1) newScale = 1;
                if (newScale > 5) newScale = 5;
    
                scale = newScale;
                if (scale === 1) { pointX = 0; pointY = 0; }
                
                updateTransform();
                return;
            }
    
            // 2. PAN MOVE (1 Finger)
            if (!panning || e.touches.length !== 1) return;
            
            if(scale <= 1) { pointX = 0; pointY = 0; updateTransform(); return; }
    
            e.preventDefault();
            let nextX = e.touches[0].clientX - startX;
            let nextY = e.touches[0].clientY - startY;
    
            const limitX = (mapContainer.offsetWidth * scale - mapContainer.offsetWidth) / 2;
            const limitY = (mapContainer.offsetHeight * scale - mapContainer.offsetHeight) / 2;

            const safeLimitX = Math.max(0, limitX);
            const safeLimitY = Math.max(0, limitY);
    
            if (nextX > safeLimitX) nextX = safeLimitX;
            if (nextX < -safeLimitX) nextX = -safeLimitX;
            if (nextY > safeLimitY) nextY = safeLimitY;
            if (nextY < -safeLimitY) nextY = -safeLimitY;
    
            pointX = nextX;
            pointY = nextY;
            updateTransform();
        }, {passive: false}); // Important for iOS

        mapContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialPinchDistance = null;
            }
            if (e.touches.length === 0) {
                panning = false;
            }
        });
    }
    
    // Close on background click
    if (mapModal) {
        mapModal.onclick = (e) => {
            if (e.target === mapModal) closeMap();
        };
    }
    
    console.log("Map Viewer: Logic Setup Complete.");
}