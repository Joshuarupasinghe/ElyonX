export const colors = {
  bg: '#000000',
  surface: '#000000',
  surfaceElevated: '#2A2A2E',
  surfaceHover: '#333338',
  border: '#3A3A3F',
  borderSubtle: '#2A2A2E',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A8',
  textMuted: '#6B6B73',
  textDim: '#4A4A52',

  purple: '#A855F7',
  purpleLight: '#9B80FF',
  purpleDark: '#5A3DC7',
  purpleGlow: 'rgba(123, 92, 250, 0.25)',
  purpleBg: 'rgba(123, 92, 250, 0.12)',

  green: '#00E676',
  greenDim: 'rgba(0, 230, 118, 0.2)',
  red: '#FF5252',
  redDim: 'rgba(255, 82, 82, 0.2)',
  orange: '#FFAB40',
  orangeDim: 'rgba(255, 171, 64, 0.2)',
  cyan: '#40E0D0',
  yellow: '#FFD740',

  eqBand1: '#FF5252',
  eqBand2: '#B388FF',
  eqBand3: '#7B5CFA',
  eqBand4: '#40E0D0',
  eqBand5: '#00E676',

  faderGreen: '#00E676',
  faderYellow: '#FFD740',
  faderOrange: '#FFAB40',
  faderRed: '#FF5252',

  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const typography = {
  fontFamily: undefined,

  xs: 9,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  title: 24,

  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  }),
};
