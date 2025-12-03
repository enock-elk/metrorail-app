module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",   // <--- This is the magic line. It tells Tailwind to look inside the js folder!
    "./public/**/*.html"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}