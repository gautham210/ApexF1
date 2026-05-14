import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        apex: {
          red: "#e10600",
          "red-dark": "#a00400",
          bg: "#080808",
          surface: "#111111",
          "surface-2": "#1a1a1a",
          "surface-3": "#222222",
          text: "#f0f0f0",
          muted: "#888888",
          border: "rgba(255,255,255,0.08)",
        },
        team: {
          redbull: "#3671C6",
          ferrari: "#E8002D",
          mercedes: "#27F4D2",
          mclaren: "#FF8000",
          astonmartin: "#229971",
          alpine: "#FF87BC",
          williams: "#64C4FF",
          rb: "#6692FF",
          sauber: "#52E252",
          haas: "#B6BABD",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        orbitron: ["Orbitron", "monospace"],
        rajdhani: ["Rajdhani", "sans-serif"],
      },
      backgroundImage: {
        "apex-gradient": "linear-gradient(135deg, #e10600 0%, #ff4d00 100%)",
        "dark-gradient": "linear-gradient(180deg, #111 0%, #080808 100%)",
        "glow-gradient": "radial-gradient(ellipse at center, rgba(225,6,0,0.3), transparent 70%)",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
        "pulse-red": "pulseRed 1.5s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        pulseRed: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-red": "0 0 20px rgba(225,6,0,0.4), 0 0 60px rgba(225,6,0,0.15)",
        "glow-sm": "0 0 10px rgba(225,6,0,0.3)",
        glass: "0 8px 32px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
