import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      colors: {
        ink: {
          900: "#080d14",
          800: "#0e1520",
          700: "#172030",
          500: "#2a3a52",
          200: "#c8d4e8",
          100: "#e8eef8"
        },
        tide: {
          600: "#3B82F6",
          500: "#55aaff",
          400: "#64DAFC",
          300: "#a0e8ff"
        },
        ember: {
          400: "#f87171",
          300: "#fca5a5"
        }
      },
      backgroundImage: {
        "logo-gradient": "linear-gradient(135deg, #76FFFF 0%, #64DAFC 32%, #3B82F6 100%)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(100, 218, 252, 0.18), 0 20px 50px rgba(5, 10, 20, 0.7)",
        "glow-sm": "0 0 0 1px rgba(100, 218, 252, 0.12), 0 4px 20px rgba(5, 10, 20, 0.5)"
      }
    }
  },
  plugins: []
};

export default config;
