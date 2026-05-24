/**
 * SoulSync design tokens.
 * Used by mobile + admin to keep visual identity consistent.
 *
 * Aesthetic targets: cinematic, glassy, romantic, gen-z.
 * Themes are layered: base palette + accent gradient + glass surface.
 */

export type ThemeName = 'romantic-dark' | 'aurora' | 'noir' | 'sunset' | 'mint';

export interface Palette {
  bg: string;
  bgElevated: string;
  surface: string;       // glass card base
  surfaceStrong: string; // modals
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryOn: string;
  accent: string;
  accent2: string;
  success: string;
  danger: string;
  warning: string;
  gradient: [string, string, string];
  glow: string;
}

export const palettes: Record<ThemeName, Palette> = {
  'romantic-dark': {
    bg: '#0B0710',
    bgElevated: '#120B1A',
    surface: 'rgba(255,255,255,0.06)',
    surfaceStrong: 'rgba(20,12,28,0.85)',
    border: 'rgba(255,255,255,0.08)',
    text: '#F8F4FF',
    textMuted: '#C9BEDC',
    textFaint: '#7C7090',
    primary: '#FF5C8A',
    primaryOn: '#FFFFFF',
    accent: '#9D6BFF',
    accent2: '#FFB3D1',
    success: '#5BE3A6',
    danger: '#FF6B6B',
    warning: '#FFC371',
    gradient: ['#FF5C8A', '#9D6BFF', '#5C8AFF'],
    glow: 'rgba(255,92,138,0.45)',
  },
  aurora: {
    bg: '#06121A',
    bgElevated: '#0A1B26',
    surface: 'rgba(255,255,255,0.05)',
    surfaceStrong: 'rgba(10,27,38,0.85)',
    border: 'rgba(255,255,255,0.07)',
    text: '#EAFBFF',
    textMuted: '#A9CBD6',
    textFaint: '#5E7C87',
    primary: '#5BE3A6',
    primaryOn: '#062017',
    accent: '#7DC8FF',
    accent2: '#B49BFF',
    success: '#5BE3A6',
    danger: '#FF6B6B',
    warning: '#FFC371',
    gradient: ['#5BE3A6', '#7DC8FF', '#B49BFF'],
    glow: 'rgba(125,200,255,0.4)',
  },
  noir: {
    bg: '#000000',
    bgElevated: '#0A0A0A',
    surface: 'rgba(255,255,255,0.04)',
    surfaceStrong: 'rgba(15,15,15,0.92)',
    border: 'rgba(255,255,255,0.06)',
    text: '#F5F5F7',
    textMuted: '#9C9CA3',
    textFaint: '#56565C',
    primary: '#FFFFFF',
    primaryOn: '#000000',
    accent: '#FF3B5C',
    accent2: '#7C7C84',
    success: '#34D399',
    danger: '#FF3B5C',
    warning: '#FBBF24',
    gradient: ['#FFFFFF', '#A1A1A6', '#3A3A3C'],
    glow: 'rgba(255,255,255,0.18)',
  },
  sunset: {
    bg: '#1A0B0F',
    bgElevated: '#240F14',
    surface: 'rgba(255,200,170,0.06)',
    surfaceStrong: 'rgba(36,15,20,0.88)',
    border: 'rgba(255,180,140,0.08)',
    text: '#FFF5EA',
    textMuted: '#E6C0A6',
    textFaint: '#9A6B58',
    primary: '#FF8C5A',
    primaryOn: '#1A0B0F',
    accent: '#FFD66B',
    accent2: '#FF6F8C',
    success: '#5BE3A6',
    danger: '#FF6B6B',
    warning: '#FFC371',
    gradient: ['#FF8C5A', '#FF6F8C', '#FFD66B'],
    glow: 'rgba(255,140,90,0.4)',
  },
  mint: {
    bg: '#06120E',
    bgElevated: '#0A1B14',
    surface: 'rgba(160,255,210,0.06)',
    surfaceStrong: 'rgba(10,27,20,0.88)',
    border: 'rgba(160,255,210,0.08)',
    text: '#EAFFF5',
    textMuted: '#A9D6BC',
    textFaint: '#5E876F',
    primary: '#5BE3A6',
    primaryOn: '#06120E',
    accent: '#A8FFD6',
    accent2: '#7DFFD0',
    success: '#5BE3A6',
    danger: '#FF6B6B',
    warning: '#FFC371',
    gradient: ['#5BE3A6', '#A8FFD6', '#7DFFD0'],
    glow: 'rgba(91,227,166,0.4)',
  },
};

export const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 };

export const typography = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: '800' as const, letterSpacing: -1.2 },
  h1:      { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.8 },
  h2:      { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3:      { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small:   { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro:   { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0.4 },
};

export const motion = {
  springSoft:  { damping: 18, stiffness: 220, mass: 0.9 },
  springSnap:  { damping: 14, stiffness: 320, mass: 0.7 },
  durations:   { fast: 160, base: 240, slow: 420, cinematic: 700 },
};

export const shadows = {
  card:    'shadow-color: #000; shadow-opacity: 0.25; shadow-radius: 16; shadow-offset: 0 6;',
  glow:    (c: string) => `shadow-color: ${c}; shadow-opacity: 0.5; shadow-radius: 24; shadow-offset: 0 0;`,
};

export const moodColors: Record<string, string> = {
  happy: '#FFD66B',
  loved: '#FF5C8A',
  excited: '#FF8C5A',
  calm: '#5BE3A6',
  sad: '#7DC8FF',
  anxious: '#B49BFF',
  tired: '#9C9CA3',
  angry: '#FF6B6B',
  longing: '#FFB3D1',
};
