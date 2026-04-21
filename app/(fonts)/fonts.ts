import { Poppins, Inter, Geist_Mono } from "next/font/google";

export const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800"],
  preload: true,
  fallback: ["system-ui", "ui-sans-serif", "sans-serif"],
  adjustFontFallback: true,
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: "variable",
  preload: true,
  fallback: ["system-ui", "ui-sans-serif", "sans-serif"],
  adjustFontFallback: true,
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  weight: "variable",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
  adjustFontFallback: true,
});
