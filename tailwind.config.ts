import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f14",
        ink2: "#080b10",
        panel: "#111826",
        panel2: "#0e1420",
        accent: "#22c55e",
        accentMuted: "#16a34a",
        accentSoft: "#4ade80",
        indigo: "#6366f1",
        indigo2: "#818cf8",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono2: ["var(--font-mono2)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent, #0b0f14 85%), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 64px)",
        "glow-radial":
          "radial-gradient(closest-side, rgba(34,197,94,0.35), rgba(34,197,94,0) 70%)",
        "glow-radial-indigo":
          "radial-gradient(closest-side, rgba(99,102,241,0.3), rgba(99,102,241,0) 70%)",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(2%, -4%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        drift: "drift 14s ease-in-out infinite",
        "drift-slow": "drift 22s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
