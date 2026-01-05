/** @type {import('tailwindcss').Config} */

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'bulkhead': '#1a1b1e',       // The dark background wall
        'panel-bg': '#25262b',       // The metal casing of an instrument
        'panel-border': '#373a40',   // The edge of the casing
        'screen-off': '#0a0c10',     // Empty CRT screen
        'phosphor': '#33ff33',       // The glowing text
        'alert': '#ff4444',          // Red lights
      },
      boxShadow: {
        'hard': '4px 4px 0px 0px rgba(0,0,0,0.5)', // The "Pixel Art" hard shadow
        'inset': 'inset 2px 2px 5px rgba(0,0,0,0.5)', // For pressed buttons/screens
      },
      backgroundImage: {
        // A simple noise texture for metal
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E\")",
      }
    },
  },
  plugins: [],
}