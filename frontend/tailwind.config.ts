import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/* 5-accent palette — referenced across components */
export const MX = ["#FF3AF2", "#00F5D4", "#FFE600", "#FF6B35", "#7B2FFF"] as const;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:   ["var(--font-sans)", "sans-serif"],
        outfit: ["var(--font-outfit)", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card:       { DEFAULT: "var(--card)",       foreground: "var(--card-foreground)" },
        popover:    { DEFAULT: "var(--popover)",     foreground: "var(--popover-foreground)" },
        primary:    { DEFAULT: "var(--primary)",     foreground: "var(--primary-foreground)" },
        secondary:  { DEFAULT: "var(--secondary)",   foreground: "var(--secondary-foreground)" },
        muted:      { DEFAULT: "var(--muted)",       foreground: "var(--muted-foreground)" },
        accent:     { DEFAULT: "var(--accent)",      foreground: "var(--accent-foreground)" },
        destructive:{ DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input:  "var(--input)",
        ring:   "var(--ring)",
        /* named maximalist accents for arbitrary-value shortcuts */
        mg: "#FF3AF2",
        cy: "#00F5D4",
        yw: "#FFE600",
        or: "#FF6B35",
        pu: "#7B2FFF",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
      typography: {
        DEFAULT: { css: { maxWidth: "none", color: "inherit", "--tw-prose-invert-body": "#FAFAFF" } },
      },
    },
  },
  plugins: [animate, typography],
};
export default config;
