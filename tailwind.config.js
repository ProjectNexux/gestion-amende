/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Primary brand color: sober corporate blue (replaces the previous violet/indigo identity).
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // Secondary accent: muted teal, used sparingly for highlights.
        accent: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },
        // Danger, warmer than plain Tailwind rose — used for "corail" accents (mise en demeure,
        // priority/urgent states) so danger doesn't read as identical to generic red everywhere.
        coral: {
          50: "#fff3f1",
          100: "#ffe4de",
          200: "#ffc6ba",
          400: "#ff8a75",
          500: "#f76a55",
          600: "#e5533e",
          700: "#c43f2c",
        },
        // Success, fresher/cooler than plain emerald — the "vert menthe" tone used for done/paid
        // states and the "traités" chart line.
        mint: {
          50: "#effbf6",
          100: "#d9f5ea",
          200: "#aeead2",
          400: "#4fd1a5",
          500: "#2bbf91",
          600: "#149c77",
          700: "#0f7d60",
        },
        // App-wide surface levels (2026-08-25 palette pass) — a lavender-tinted background instead
        // of flat gray, white "raised" cards, and two subtler tinted levels for differentiating
        // sections without introducing a new white rectangle for every block.
        surface: {
          base: "#F4F5FB",
          raised: "#FFFFFF",
          muted: "#F1F2F9",
          accent: "#EEF2FF",
        },
        // Sidebar surface — slate-blue, deliberately NOT near-black navy. Renamed values, same
        // token name (`navy-*`) so every existing consumer (Sidebar.tsx, ClientSidebar.tsx) picks
        // up the new color for free without further edits.
        navy: {
          950: "#1B2536",
          900: "#26344A",
          850: "#2C3B54",
          800: "#33445F",
          700: "#3E5170",
          600: "#4C6182",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.625rem",
        "2xl": "0.75rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
        "card-hover": "0 4px 12px -2px rgba(15, 23, 42, 0.10), 0 2px 4px -2px rgba(15, 23, 42, 0.06)",
        popover: "0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
};
