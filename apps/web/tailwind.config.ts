import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(40 22% 84%)",
        input: "hsl(40 22% 84%)",
        ring: "hsl(24 66% 34%)",
        background: "hsl(42 36% 95%)",
        foreground: "hsl(24 26% 17%)",
        primary: {
          DEFAULT: "hsl(24 66% 34%)",
          foreground: "hsl(39 90% 97%)"
        },
        secondary: {
          DEFAULT: "hsl(38 29% 88%)",
          foreground: "hsl(24 26% 17%)"
        },
        destructive: {
          DEFAULT: "hsl(0 72% 51%)",
          foreground: "hsl(0 0% 100%)"
        },
        accent: {
          DEFAULT: "hsl(30 80% 52%)",
          foreground: "hsl(39 90% 97%)"
        },
        muted: {
          DEFAULT: "hsl(40 26% 90%)",
          foreground: "hsl(29 12% 38%)"
        },
        card: {
          DEFAULT: "hsl(39 90% 98%)",
          foreground: "hsl(24 26% 17%)"
        },
        popover: {
          DEFAULT: "hsl(39 90% 98%)",
          foreground: "hsl(24 26% 17%)"
        }
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem"
      },
      boxShadow: {
        float: "0 16px 40px rgba(93, 54, 27, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
