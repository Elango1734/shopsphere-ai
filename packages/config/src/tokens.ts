/**
 * ShopSphere AI design tokens — the single source of truth architecture.md
 * requires ("Define design tokens once in packages/config"). Plain data, no
 * React/React Native/CSS dependency, so mobile (StyleSheet/NativeWind) and
 * admin web (CSS variables/Tailwind) both consume the same values without
 * either platform owning the definition.
 *
 * Brand anchors: warm ivory, midnight navy, electric coral.
 */

export const palette = {
  ivory: {
    50: '#FFFEFB',
    100: '#FBF6EC',
    200: '#F5EDDB',
    300: '#EDE0C4',
    400: '#DECBA0'
  },
  navy: {
    50: '#E9ECF4',
    100: '#C7CEE2',
    200: '#8D9BC2',
    300: '#4C5D8A',
    400: '#283357',
    500: '#141B30',
    600: '#10152A',
    700: '#0B0F20',
    800: '#070A17',
    900: '#04050D'
  },
  coral: {
    50: '#FFEFEC',
    100: '#FFD6CE',
    200: '#FFAD9D',
    300: '#FF8066',
    400: '#FF5A3C',
    500: '#F03E22',
    600: '#CC2E16',
    700: '#A12411'
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F7F5',
    100: '#ECECE8',
    200: '#D9D9D3',
    300: '#B8B8B0',
    400: '#8E8E85',
    500: '#6B6B63',
    600: '#4D4D47',
    700: '#35352F',
    800: '#232320',
    900: '#141412'
  },
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

/** Warm-ivory-on-midnight-navy light theme: ivory surfaces, navy text, coral accent. */
export const lightTheme: SemanticColorRoles = {
  background: palette.ivory[100],
  surface: palette.ivory[50],
  surfaceElevated: palette.neutral[0],
  surfaceSunken: palette.ivory[200],
  textPrimary: palette.navy[700],
  textSecondary: palette.navy[400],
  textMuted: palette.neutral[500],
  textInverse: palette.ivory[50],
  border: palette.ivory[300],
  borderSubtle: palette.ivory[200],
  accent: palette.coral[400],
  accentPressed: palette.coral[600],
  onAccent: palette.neutral[0],
  success: palette.success[500],
  warning: palette.warning[500],
  danger: palette.danger[500],
  info: palette.info[500],
  focusRing: palette.coral[400]
};

/** Midnight-navy-on-near-black dark theme: the same accent, inverted surfaces. */
export const darkTheme: SemanticColorRoles = {
  background: palette.navy[700],
  surface: palette.navy[600],
  surfaceElevated: palette.navy[500],
  surfaceSunken: palette.navy[800],
  textPrimary: palette.ivory[100],
  textSecondary: palette.navy[100],
  textMuted: palette.neutral[400],
  textInverse: palette.navy[700],
  border: palette.navy[400],
  borderSubtle: palette.navy[500],
  accent: palette.coral[400],
  accentPressed: palette.coral[300],
  onAccent: palette.navy[900],
  success: palette.success[500],
  warning: palette.warning[500],
  danger: palette.danger[500],
  info: palette.info[500],
  focusRing: palette.coral[300]
};

export const typography = {
  fontFamily: {
    // Platform-native system fonts by default; mobile/admin may map these to a licensed editorial typeface.
    sans: 'System',
    serif: 'Georgia'
  },
  fontSize: { xs: 12, sm: 14, base: 16, md: 18, lg: 20, xl: 24, '2xl': 28, '3xl': 34, '4xl': 42 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.15, snug: 1.3, normal: 1.5, relaxed: 1.65 }
} as const;

/** 4px grid. */
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 } as const;

export const radii = { sm: 6, md: 10, lg: 16, xl: 24, full: 999 } as const;

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
