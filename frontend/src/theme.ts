export const colors = {
  surface: "#09090B",
  onSurface: "#F4F4F5",
  surfaceSecondary: "#18181B",
  onSurfaceSecondary: "#A1A1AA",
  surfaceTertiary: "#27272A",
  onSurfaceTertiary: "#D4D4D8",
  surfaceInverse: "#EFEFE8",
  onSurfaceInverse: "#09090B",
  brand: "#D0A85C",
  brandSecondary: "#E5C88F",
  brandTertiary: "#3D311D",
  onBrand: "#09090B",
  success: "#84CC16",
  error: "#F87171",
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#1F1F22",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fonts = {
  display: "SpaceGrotesk-Bold",
  displayMedium: "SpaceGrotesk-Medium",
  mono: "JetBrainsMono-Regular",
  monoBold: "JetBrainsMono-Bold",
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const CLASS_META: Record<
  string,
  { color: string; label: string }
> = {
  economy: { color: colors.onSurfaceSecondary, label: "ECO" },
  business: { color: colors.brandSecondary, label: "BIZ" },
  first: { color: colors.brand, label: "1ST" },
};

export const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

export const priceLabel = (n: number) => (n === 0 ? "FREE" : peso(n));
