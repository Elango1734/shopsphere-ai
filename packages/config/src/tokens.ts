/**
 * Elviree design tokens — the single source of truth architecture.md
 * requires ("Define design tokens once in packages/config"). Plain data, no
 * React/React Native/CSS dependency, so mobile (StyleSheet/NativeWind) and
 * admin web (CSS variables/Tailwind) both consume the same values without
 * either platform owning the definition.
 *
 * Values are extracted from the Evira e-commerce UI kit via the Figma REST
 * API (see tokens.json in the extraction output). The kit is deliberately
 * monochrome: there is no chromatic brand hue, contrast and weight carry the
 * hierarchy instead, and the primary CTA is near-black in light mode /
 * mid-grey in dark mode.
 */

export const palette = {
  /** Greyscale ramp read off the kit's unlocked screens. */
  grey: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#EEEEEE',
    200: '#E0E0E0',
    300: '#DADADA',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#616161',
    700: '#35383F',
    800: '#212121',
    900: '#1F222A',
    950: '#181A20',
    1000: '#000000'
  },
  /** Icon/illustration ink used throughout the kit's vector art. */
  ink: '#130F26',
  success: { 500: '#1F9D63', 700: '#136B44' },
  warning: { 500: '#D98A14', 700: '#8F5B0C' },
  danger: { 500: '#E0402F', 700: '#A32C1F' },
  info: { 500: '#2E7FD9', 700: '#1E568F' }
} as const;

export interface SemanticColorRoles {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  focusRing: string;
}

/** Evira light: white surfaces, #212121 ink, near-black pill CTAs. */
export const lightTheme: SemanticColorRoles = {
  background: palette.grey[0],
  surface: palette.grey[0],
  surfaceElevated: palette.grey[0],
  surfaceSunken: palette.grey[50],
  textPrimary: palette.grey[800],
  textSecondary: palette.grey[600],
  textMuted: palette.grey[500],
  textInverse: palette.grey[0],
  border: palette.grey[300],
  borderSubtle: palette.grey[100],
  accent: palette.grey[800],
  accentPressed: palette.grey[1000],
  onAccent: palette.grey[0],
  success: palette.success[500],
  warning: palette.warning[500],
  danger: palette.danger[500],
  info: palette.info[500],
  focusRing: palette.grey[800]
};

/** Evira dark: #181A20 ground, #1F222A cards, #35383F elevated + CTA. */
export const darkTheme: SemanticColorRoles = {
  background: palette.grey[950],
  surface: palette.grey[900],
  surfaceElevated: palette.grey[700],
  surfaceSunken: palette.grey[1000],
  textPrimary: palette.grey[0],
  textSecondary: palette.grey[200],
  textMuted: palette.grey[500],
  textInverse: palette.grey[950],
  border: palette.grey[700],
  borderSubtle: palette.grey[900],
  accent: palette.grey[700],
  accentPressed: palette.grey[600],
  onAccent: palette.grey[0],
  success: palette.success[500],
  warning: palette.warning[500],
  danger: palette.danger[500],
  info: palette.info[500],
  focusRing: palette.grey[0]
};

/**
 * iOS resolves bundled fonts by PostScript name, and Urbanist ships each
 * weight under its own family ("Urbanist Medium", "Urbanist SemiBold"...),
 * so family+fontWeight does NOT select the right face. Always set
 * fontFamily to one of these exact names and leave fontWeight unset.
 */
export const fontFamilies = {
  regular: 'Urbanist-Regular',
  medium: 'Urbanist-Medium',
  semibold: 'Urbanist-SemiBold',
  bold: 'Urbanist-Bold',
  black: 'Urbanist-Black'
} as const;

export const typography = {
  fontFamily: {
    /** The kit sets every text node in Urbanist. */
    sans: 'Urbanist',
    serif: 'Georgia'
  },
  /** Sizes observed in the kit: 14 / 16 / 18 / 24 / 40 carry almost everything. */
  fontSize: { xs: 12, sm: 14, base: 16, md: 18, lg: 20, xl: 24, '2xl': 28, '3xl': 34, '4xl': 40 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '900' },
  lineHeight: { tight: 1.15, snug: 1.3, normal: 1.5, relaxed: 1.65 }
} as const;

/**
 * The app's type scale: four roles, four sizes, nothing else. Every screen
 * sizes text through these — a raw `fontSize: <number>` in a screen is a
 * regression, not a local decision.
 *
 *   heading     20  screen headings and section headings ("Shop by category")
 *   title       18  card / row / sheet titles sitting inside a section
 *   normal      16  body copy, row labels, inputs, button labels
 *   description 14  secondary and supporting copy, metadata, captions
 *
 * Sizes only — weight stays with the call site, since the same size carries
 * several weights (a bold price and a medium caption are both `normal`).
 */
export const textSizes = { heading: 20, title: 18, normal: 16, description: 14 } as const;

/** Line heights paired to `textSizes`, at the kit's ~1.3 ratio. */
export const textLineHeights = { heading: 26, title: 24, normal: 22, description: 20 } as const;

export type TextRole = keyof typeof textSizes;

/**
 * Named text styles lifted verbatim from the kit, as size/lineHeight/weight
 * triples. Screens should reach for these rather than re-deriving sizes.
 */
export const textStyles = {
  h1: { fontSize: textSizes.heading, lineHeight: textLineHeights.heading, fontFamily: fontFamilies.black },
  h2: { fontSize: textSizes.heading, lineHeight: textLineHeights.heading, fontFamily: fontFamilies.bold },
  h3: { fontSize: textSizes.heading, lineHeight: textLineHeights.heading, fontFamily: fontFamilies.bold },
  bodyLgBold: { fontSize: textSizes.title, lineHeight: textLineHeights.title, fontFamily: fontFamilies.bold },
  bodyLg: { fontSize: textSizes.title, lineHeight: textLineHeights.title, fontFamily: fontFamilies.medium },
  bodyBold: { fontSize: textSizes.normal, lineHeight: textLineHeights.normal, fontFamily: fontFamilies.bold },
  body: { fontSize: textSizes.normal, lineHeight: textLineHeights.normal, fontFamily: fontFamilies.semibold },
  caption: { fontSize: textSizes.description, lineHeight: textLineHeights.description, fontFamily: fontFamilies.medium },
  captionBold: { fontSize: textSizes.description, lineHeight: textLineHeights.description, fontFamily: fontFamilies.semibold }
} as const;

/** 4px grid. */
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 } as const;

/** Corner radii observed in the kit: 8 / 12 / 16 / 20, plus fully-rounded pills. */
export const radii = { sm: 8, md: 12, lg: 16, xl: 20, full: 100 } as const;

export const motion = {
  duration: { fast: 120, base: 200, slow: 320 },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.3, 0, 1, 1]
  }
} as const;

export const elevation = {
  // Platform-agnostic shadow description; each platform maps this to its own shadow/elevation API.
  sm: { offsetY: 1, blur: 3, opacity: 0.08 },
  md: { offsetY: 4, blur: 10, opacity: 0.1 },
  lg: { offsetY: 10, blur: 24, opacity: 0.14 }
} as const;

export type ThemeName = 'light' | 'dark';

export function getTheme(name: ThemeName): SemanticColorRoles {
  return name === 'dark' ? darkTheme : lightTheme;
}
