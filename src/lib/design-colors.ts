/**
 * ISPO Design System - Color Tokens
 */
export const darkColors = {
  background: '#000000',
  foreground: '#A7A7A7',
  card: '#181818',
  cardForeground: '#DEDEDE',
  secondary: '#1A1A1A',
  secondaryForeground: '#DEDEDE',
  muted: '#191919',
  mutedForeground: '#8A8A8A',
  border: '#2D2D2D',
  input: '#181818',
  primary: '#DEDEDE',
  primaryForeground: '#030303',
  accent: '#DEDEDE',
  accentForeground: '#030303',
  destructive: '#F14D4C',
  destructiveForeground: '#F8F8F8',
  success: '#31AA40',
  successForeground: '#F8F8F8',
  warning: '#D9A514',
  warningForeground: '#030303',
  textHighlight: '#00BE83',
  ring: '#00BE83',
  statusRunning: '#E8E8E8',
  statusCompleted: '#11AD32',
  statusFailed: '#F14D4C',
  statusPending: '#8A8A8A',
  statusCancelled: '#8A8A8A',
} as const;

export const lightColors = {
  background: '#F5F0EB',
  foreground: '#2C2420',
  card: '#EDE7E1',
  cardForeground: '#2C2420',
  secondary: '#E8E2DB',
  secondaryForeground: '#2C2420',
  muted: '#E8E2DB',
  mutedForeground: '#8A7F75',
  border: '#D8D0C8',
  input: '#EDE7E1',
  primary: '#2C2420',
  primaryForeground: '#F5F0EB',
  accent: '#E84B8A',
  accentForeground: '#FFFFFF',
  destructive: '#D40924',
  destructiveForeground: '#F8F8F8',
  success: '#008D00',
  successForeground: '#F8F8F8',
  warning: '#C18200',
  warningForeground: '#2C2420',
  textHighlight: '#E84B8A',
  ring: '#E84B8A',
  statusRunning: '#2C2420',
  statusCompleted: '#11AD32',
  statusFailed: '#F14D4C',
  statusPending: '#8A7F75',
  statusCancelled: '#8A7F75',
} as const;

export function getColors(theme: 'dark' | 'light') {
  return theme === 'dark' ? darkColors : lightColors;
}

export function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

export const darkStatusBadges = {
  running: withOpacity(darkColors.statusRunning, 0.2),
  completed: withOpacity(darkColors.statusCompleted, 0.2),
  failed: withOpacity(darkColors.statusFailed, 0.2),
  pending: withOpacity(darkColors.muted, 0.5),
} as const;

export const lightStatusBadges = {
  running: withOpacity(lightColors.statusRunning, 0.15),
  completed: withOpacity(lightColors.statusCompleted, 0.15),
  failed: withOpacity(lightColors.statusFailed, 0.15),
  pending: withOpacity(lightColors.muted, 0.5),
} as const;
