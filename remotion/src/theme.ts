/**
 * Hyperyzer brand tokens — single source of truth for the ad.
 * Values lifted verbatim from the live site (globals.css, layout.tsx, page.tsx)
 * so the video and the product look identical.
 */

export const COLORS = {
  pink: "#ec4899", // primary-500
  pinkDark: "#db2777", // primary-600
  pinkLight: "#f472b6", // primary-400
  pink100: "#fce7f3",
  pink700: "#be185d",
  orange: "#f97316", // accent-500
  orangeDark: "#ea580c", // accent-600
  emerald: "#10b981", // retention bar in the real product UI
  emeraldBg: "rgba(16,185,129,0.12)",
  bg: "#FDF2F8", // page background
  slate900: "#0f172a", // primary text + logo square
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  white: "#ffffff",
} as const;

// Signature pink → orange gradient (the product's "energy").
export const GRADIENT = `linear-gradient(90deg, ${COLORS.pink}, ${COLORS.orange})`;
export const GRADIENT_BR = `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.orange})`;

export const RADIUS = {
  panel: 28,
  card: 24,
  pill: 14,
  chip: 10,
} as const;

// Glassmorphism (site .glass-panel / card surfaces).
export const GLASS = {
  bg: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(0,0,0,0.05)",
  borderLight: "1px solid rgba(255,255,255,0.6)",
  blur: "blur(22px)",
  shadow: "0 18px 50px rgba(236,72,153,0.12)",
} as const;

// Pink-tinted glow used on CTAs / the submit button.
export const GLOW = "0 14px 40px rgba(236,72,153,0.32)";
export const GLOW_SOFT = "0 8px 24px rgba(236,72,153,0.22)";

// The site's Apple easing: cubic-bezier(0.22, 1, 0.36, 1).
export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

// Spring presets (passed to Remotion spring({config})).
export const SPRINGS = {
  soft: { damping: 16, mass: 0.9, stiffness: 120 },
  gentle: { damping: 20, mass: 1, stiffness: 90 },
  pop: { damping: 9, mass: 0.6, stiffness: 200 },
  number: { damping: 13, mass: 0.8, stiffness: 140 },
  bar: { damping: 10, mass: 0.7, stiffness: 130 },
  logo: { damping: 12, mass: 0.8, stiffness: 130 },
} as const;

export const FONT_WEIGHT = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800, // Plus Jakarta Sans tops out at 800; used for headlines
} as const;
