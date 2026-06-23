/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B2A66",
        ink: "#101828",
        paper: "#FFFFFF",
        mist: "#F3F6FB"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(11, 42, 102, 0.10)"
      }
    }
  },
  plugins: []
};
