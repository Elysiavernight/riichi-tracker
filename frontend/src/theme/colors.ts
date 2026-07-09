// Palette lifted from elysiavernight.com's dark mode classes
// (bg-[#0f0f14], pink-400/500/600, gray-200/400/500, pink-900/50 borders).

export const colors = {
  background: "#0f0f14",
  backgroundDeep: "#0c0c11",
  surface: "#17171f", // card background — one step lighter than bg,
  // standing in for the site's `bg-white/5` translucent card look, which
  // doesn't translate directly to RN without a blur/backdrop layer.

  border: "rgba(131, 24, 67, 0.5)", // pink-900 at 50% — matches site's card borders
  borderStrong: "#db2777", // pink-600, used on focus states

  pinkPrimary: "#f472b6", // pink-400 — headings, links
  pinkAccent: "#ec4899", // pink-500 — primary buttons
  pinkStrong: "#db2777", // pink-600 — pressed/active states
  pinkMuted: "#f9a8d4", // pink-300 — secondary text accents
  pinkSoft: "#fbcfe8", // pink-200 — decorative touches

  textPrimary: "#e5e7eb", // gray-200
  textSecondary: "#9ca3af", // gray-400
  textMuted: "#6b7280", // gray-500

  error: "#f87171", // red-400 — readable against the dark background
  white: "#ffffff",
} as const;

export const radii = {
  md: 12,
  lg: 20,
  xl: 28, // the site leans heavily on very rounded corners (rounded-[3rem] etc.)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;