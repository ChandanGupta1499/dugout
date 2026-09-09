// Ported from the "Dugout Design System" Claude Design project
// (claude.ai/design/p/7ac794a4-8052-4451-beb2-571de886e52f) tokens/*.css.
// Values are close visual reconstructions, not extracted production values —
// see that project's readme for the source screenshots and known gaps.

export const colors = {
  red50: '#FEF5F6',
  red100: '#FDEBEC',
  red200: '#F9CFD2',
  red400: '#F03A40',
  red500: '#E8232A',
  red600: '#E11B22',
  red700: '#C0151B',
  red800: '#8E0F14',

  white: '#FFFFFF',
  grey50: '#FAFAFB',
  grey100: '#F2F2F4',
  grey200: '#EDEDF0',
  grey300: '#D9D9DE',
  grey500: '#8A8A93',
  grey600: '#6B6B74',
  grey800: '#3A3A40',
  ink: '#101013',

  green600: '#12855A',
  amber600: '#C98A00',
  blue600: '#1B5EA8',

  club: {
    mi: '#1B5EA8',
    csk: '#F2C302',
    rcb: '#D51F2A',
    kkr: '#3B1E63',
    gt: '#16283C',
    neutral: '#3A3A40',
  },
} as const;

export const semantic = {
  surfacePage: colors.white,
  surfaceCard: colors.white,
  surfaceTint: colors.red50,
  surfaceTintStrong: colors.red100,
  surfaceBrand: colors.red600,
  surfaceBrandPressed: colors.red700,

  textDisplay: colors.ink,
  textBody: colors.grey800,
  textMuted: colors.grey600,
  textPlaceholder: colors.grey500,
  textBrand: colors.red600,
  textOnBrand: colors.white,

  lineHairline: colors.grey200,
  lineStrong: colors.grey300,
  lineBrand: colors.red200,

  statusLive: colors.red600,
} as const;

export const spacing = {
  s0: 0,
  s1: 2,
  s2: 4,
  s3: 6,
  s4: 8,
  s5: 12,
  s6: 16,
  s7: 20,
  s8: 24,
  s9: 32,
  s10: 40,
  s11: 56,

  gutterScreen: 18,
  gapList: 8,
  gapStack: 12,
  gapSection: 20,
  controlH: 48,
  controlHSm: 38,
  rowH: 52,
  tapMin: 44,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 20,
  pill: 999,
  card: 14,
  control: 12,
} as const;

// Font families are registered via expo-font in app/_layout.tsx using
// @expo-google-fonts/archivo and @expo-google-fonts/hanken-grotesk.
export const fonts = {
  display: 'Archivo_900Black_Italic',
  body: 'HankenGrotesk_400Regular',
  label: 'HankenGrotesk_800ExtraBold',
  rowName: 'HankenGrotesk_800ExtraBold_Italic',
  button: 'HankenGrotesk_900Black_Italic',
} as const;

export const typography = {
  displayMd: { fontFamily: fonts.display, fontSize: 22, lineHeight: 21 },
  title: { fontFamily: fonts.rowName, fontSize: 17, lineHeight: 20 },
  rowName: { fontFamily: fonts.rowName, fontSize: 15, lineHeight: 18 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.1,
  },
  button: {
    fontFamily: fonts.button,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;
