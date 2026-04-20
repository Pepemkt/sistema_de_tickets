/**
 * Tailwind configuration — Warm Tactile Design System
 *
 * REQ-COLOR-02: ALL theme.extend values use var(--*) — ZERO hex literals here.
 * REQ-DARK-01: darkMode is array form ['class', '[data-theme="dark"]'].
 * brand ramp removed (was unused, contained stale hex values).
 *
 * Token source: styles/tokens.css (single source of truth for all hex values).
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      /* -----------------------------------------------------------------------
         COLORS
         Raw ramps: arena / forest / coral
         State ramps: success / warning / danger / info
         Semantic aliases: bg-* / text-* / border-*
         ----------------------------------------------------------------------- */
      colors: {
        /* Arena — warm neutrals */
        arena: {
          50:  "var(--clr-arena-50)",
          100: "var(--clr-arena-100)",
          200: "var(--clr-arena-200)",
          300: "var(--clr-arena-300)",
          400: "var(--clr-arena-400)",
          500: "var(--clr-arena-500)",
          600: "var(--clr-arena-600)",
          700: "var(--clr-arena-700)",
          800: "var(--clr-arena-800)",
          900: "var(--clr-arena-900)",
        },
        /* Forest — primary action */
        forest: {
          50:  "var(--clr-forest-50)",
          100: "var(--clr-forest-100)",
          200: "var(--clr-forest-200)",
          300: "var(--clr-forest-300)",
          400: "var(--clr-forest-400)",
          500: "var(--clr-forest-500)",
          600: "var(--clr-forest-600)",
          700: "var(--clr-forest-700)",
          800: "var(--clr-forest-800)",
          900: "var(--clr-forest-900)",
        },
        /* Coral — accent / emphasis */
        coral: {
          50:  "var(--clr-coral-50)",
          100: "var(--clr-coral-100)",
          200: "var(--clr-coral-200)",
          300: "var(--clr-coral-300)",
          400: "var(--clr-coral-400)",
          500: "var(--clr-coral-500)",
          600: "var(--clr-coral-600)",
          700: "var(--clr-coral-700)",
          800: "var(--clr-coral-800)",
          900: "var(--clr-coral-900)",
        },
        /* Semantic state ramps */
        success: {
          50:  "var(--clr-success-50)",
          500: "var(--clr-success-500)",
          700: "var(--clr-success-700)",
        },
        warning: {
          50:  "var(--clr-warning-50)",
          500: "var(--clr-warning-500)",
          700: "var(--clr-warning-700)",
        },
        danger: {
          50:  "var(--clr-danger-50)",
          500: "var(--clr-danger-500)",
          700: "var(--clr-danger-700)",
        },
        info: {
          50:  "var(--clr-info-50)",
          500: "var(--clr-info-500)",
          700: "var(--clr-info-700)",
        },
        /* Semantic surface / text / border aliases */
        /* Usage: bg-surface, text-primary, border-soft, etc. */
        surface:    "var(--bg-surface)",
        raised:     "var(--bg-raised)",
        sunken:     "var(--bg-sunken)",
        overlay:    "var(--bg-overlay)",
        page:       "var(--bg-page)",
        primary:    "var(--text-primary)",
        secondary:  "var(--text-secondary)",
        muted:      "var(--text-muted)",
        inverse:    "var(--text-inverse)",
        onprimary:  "var(--text-onprimary)",
        onaccent:   "var(--text-onaccent)",
      },

      /* -----------------------------------------------------------------------
         BORDER COLORS — semantic aliases for border-{soft,strong,focus}
         Usage: border-soft, border-strong, border-focus-ring
         ----------------------------------------------------------------------- */
      borderColor: {
        soft:         "var(--border-soft)",
        strong:       "var(--border-strong)",
        "focus-ring": "var(--border-focus)",
      },

      /* -----------------------------------------------------------------------
         BORDER RADII
         Usage: rounded-xs, rounded-sm, rounded-md, rounded-lg, rounded-xl,
                rounded-2xl, rounded-full
         ----------------------------------------------------------------------- */
      borderRadius: {
        xs:   "var(--radius-xs)",
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)",
      },

      /* -----------------------------------------------------------------------
         BOX SHADOWS — multi-layer physical system
         Usage: shadow-xs, shadow-sm, shadow-md, shadow-lg, shadow-xl,
                shadow-inset, shadow-focus, shadow-focus-danger, shadow-glow-accent
         ----------------------------------------------------------------------- */
      boxShadow: {
        xs:           "var(--shadow-xs)",
        sm:           "var(--shadow-sm)",
        md:           "var(--shadow-md)",
        lg:           "var(--shadow-lg)",
        xl:           "var(--shadow-xl)",
        inset:        "var(--shadow-inset)",
        focus:        "var(--shadow-focus)",
        "focus-danger": "var(--shadow-focus-danger)",
        "glow-accent":  "var(--shadow-glow-accent)",
      },

      /* -----------------------------------------------------------------------
         TRANSITION DURATIONS
         Usage: duration-swift, duration-base, duration-slow, duration-hero
         ----------------------------------------------------------------------- */
      transitionDuration: {
        swift: "var(--duration-swift)",
        base:  "var(--duration-base)",
        slow:  "var(--duration-slow)",
        hero:  "var(--duration-hero)",
      },

      /* -----------------------------------------------------------------------
         TRANSITION TIMING FUNCTIONS (EASINGS)
         Usage: ease-tactile, ease-spring, ease-swift, ease-in-out-warm
         ----------------------------------------------------------------------- */
      transitionTimingFunction: {
        tactile:      "var(--ease-tactile)",
        spring:       "var(--ease-spring)",
        swift:        "var(--ease-swift)",
        "in-out-warm": "var(--ease-in-out-warm)",
      },

      /* -----------------------------------------------------------------------
         FONT FAMILIES
         display = Fraunces (via CSS var injected by next/font/google)
         body    = Geist Sans (default sans)
         mono    = Geist Mono
         ----------------------------------------------------------------------- */
      fontFamily: {
        display: "var(--font-display)",
        body:    "var(--font-body)",
        mono:    "var(--font-mono)",
      },

      /* -----------------------------------------------------------------------
         TYPE SCALE
         Anchored at 16px base (1rem). Major-third (~1.25) with tuned overrides.
         Usage: text-display-xl, text-title-l, text-body, text-label, etc.
         ----------------------------------------------------------------------- */
      fontSize: {
        "display-xl": ["4.5rem",   { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-l":  ["3.5rem",   { lineHeight: "0.98", letterSpacing: "-0.025em" }],
        "display-m":  ["2.75rem",  { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "title-xl":   ["2rem",     { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "title-l":    ["1.5rem",   { lineHeight: "1.2",  letterSpacing: "-0.01em" }],
        "title-m":    ["1.25rem",  { lineHeight: "1.3",  letterSpacing: "-0.005em" }],
        "title-s":    ["1.125rem", { lineHeight: "1.35", letterSpacing: "0" }],
        "body-l":     ["1.125rem", { lineHeight: "1.55", letterSpacing: "0" }],
        "body":       ["1rem",     { lineHeight: "1.6",  letterSpacing: "0" }],
        "body-s":     ["0.875rem", { lineHeight: "1.55", letterSpacing: "0.005em" }],
        "label":      ["0.8125rem",{ lineHeight: "1.4",  letterSpacing: "0.02em" }],
        "caption":    ["0.75rem",  { lineHeight: "1.4",  letterSpacing: "0.03em" }],
        "overline":   ["0.6875rem",{ lineHeight: "1.3",  letterSpacing: "0.12em" }],
        "data-l":     ["1rem",     { lineHeight: "1.5",  letterSpacing: "0" }],
        "data":       ["0.875rem", { lineHeight: "1.5",  letterSpacing: "0" }],
      },

      /* -----------------------------------------------------------------------
         SPACING ANCHORS
         Extends the default 4px grid with semantic section/hero rhythm tokens.
         Usage: py-section, py-hero, px-gutter
         ----------------------------------------------------------------------- */
      spacing: {
        gutter:  "var(--space-gutter)",
        section: "var(--space-section)",
        hero:    "var(--space-hero)",
      },
    },
  },
  plugins: [],
};

export default config;
