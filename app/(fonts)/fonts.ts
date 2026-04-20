/**
 * Font declarations for the Warm Tactile design system.
 * All fonts loaded via next/font/google — auto-hosted, zero CLS via adjustFontFallback.
 *
 * REQ-TYPE-01: display "swap" + adjustFontFallback on all three fonts.
 * REQ-TYPE-02: SOFT axis declared in CSS font-variation-settings only (no JS detection).
 * REQ-TYPE-03: No Inter, Roboto, Arial, or system-ui as primary font.
 * REQ-PERFORMANCE-01: adjustFontFallback: true targets CLS < 0.02.
 */

import { Fraunces, Geist, Geist_Mono } from "next/font/google";

/**
 * Fraunces — display / headline font.
 * Variable axes: wght (100–900), opsz (9–144), SOFT (0–100).
 * The SOFT axis is the signature move: rounded letterform terminals at SOFT 50
 * on display-xl sizes give headlines a handmade, warm-premium quality.
 * Fallback: Georgia — warm-adjacent serif, metric-compatible enough for CLS.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  weight: "variable",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: true,
});

/**
 * Geist Sans — body / UI font.
 * Clean geometric sans-serif. The default reading font for all body copy,
 * labels, buttons, and UI chrome. Pairs with Fraunces for display contrast.
 * Fallback: ui-sans-serif — system default sans, metric-reasonable for CLS.
 */
export const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
  weight: "variable",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: true,
});

/**
 * Geist Mono — code / numeric / data font.
 * Used for QR token strings, code blocks, data table hash values.
 * Not preloaded — rarely above-the-fold; skip preload to save LCP budget.
 * Fallback: ui-monospace — system default mono, adequate for data rendering.
 */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  weight: "variable",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
  adjustFontFallback: true,
});
