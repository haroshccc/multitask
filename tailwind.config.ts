import type { Config } from "tailwindcss";

/**
 * Design tokens sourced verbatim from design-reference/design-language.html.
 * Brand gradient (yellow → amber → pink at 135°) is the signature accent;
 * neutrals sit on a cool-leaning ink scale (slight violet cast in highlights).
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Fredoka", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Menlo", "monospace"],
      },
      colors: {
        // Neutral ink scale (cool, slight violet tint) ------------------------
        ink: {
          0: "#ffffff",
          50: "#fafafa",   // page background
          100: "#f4f4f6",  // bg2
          150: "#f0f0f5",  // ink6 (very light chips)
          200: "#ededf0",  // bg3
          300: "#e2e2ea",  // ink5 (borders)
          400: "#a8a8bc",  // ink4 (disabled / meta)
          500: "#6b6b80",  // ink3 (secondary text)
          700: "#2d2d3a",  // ink2
          900: "#111118",  // ink (primary text)
        },
        // Brand accent — amber is the singleton primary (gradient handles the
        // richer variants). Keep a numeric scale for compatibility with Tailwind
        // conventions even though design only uses the 500.
        accent: {
          yellow: "#facc15",
          amber: "#f59e0b",
          orange: "#f97316",
          pink: "#ec4899",
          rose: "#e11d48",
          purple: "#a855f7",
        },
        primary: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b", // --amber
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // List colors (used to tint project chips / list dots) ---------------
        list: {
          red: "#ef4444",
          green: "#10b981",
          teal: "#14b8a6",
          cyan: "#06b6d4",
          sky: "#0ea5e9",
          blue: "#3b82f6",
          indigo: "#6366f1",
          violet: "#8b5cf6",
        },
        // Semantic ----------------------------------------------------------
        success: { DEFAULT: "#10b981", 500: "#10b981", 600: "#059669" },
        warning: { DEFAULT: "#f59e0b", 500: "#f59e0b", 600: "#d97706" },
        danger: { DEFAULT: "#ef4444", 500: "#ef4444", 600: "#dc2626" },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #facc15 0%, #f59e0b 45%, #ec4899 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(250,204,21,0.08), rgba(236,72,153,0.08))",
      },
      borderRadius: {
        xs: "5px",
        sm: "7px",
        DEFAULT: "10px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.06)",
        DEFAULT: "0 4px 16px rgba(0,0,0,0.07)",
        lift: "0 12px 40px rgba(0,0,0,0.10)",
        accent: "0 4px 20px rgba(245,158,11,0.25)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        bounce: "cubic-bezier(0.34, 1.3, 0.64, 1)",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
        xs: ["11px", { lineHeight: "1.5" }],
        sm: ["12px", { lineHeight: "1.55" }],
        base: ["14px", { lineHeight: "1.55" }],
        md: ["15px", { lineHeight: "1.5" }],
        lg: ["17px", { lineHeight: "1.55" }],
        xl: ["20px", { lineHeight: "1.4" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
        "3xl": ["28px", { lineHeight: "1.25", letterSpacing: "-0.3px" }],
        "4xl": ["32px", { lineHeight: "1.2", letterSpacing: "-0.6px" }],
        "5xl": ["48px", { lineHeight: "1.05", letterSpacing: "-1.5px" }],
        "6xl": ["62px", { lineHeight: "1", letterSpacing: "-2px" }],
        "7xl": ["72px", { lineHeight: "0.95", letterSpacing: "-2.5px" }],
      },
      letterSpacing: {
        tightest: "-2.5px",
        tighter: "-2px",
        tight: "-0.6px",
      },
      keyframes: {
        gradShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        pulseAccent: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(245,158,11,0)" },
        },
      },
      animation: {
        "grad-shift": "gradShift 4s ease infinite",
        "pulse-accent": "pulseAccent 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
