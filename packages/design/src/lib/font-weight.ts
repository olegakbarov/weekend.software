/** Variable-font weight axes used as `fontVariationSettings` values. */
export const fontWeights = {
  normal: '"wght" 400',
  medium: '"wght" 450',
  semibold: '"wght" 550',
  bold: '"wght" 700',
} as const;

export type FontWeightName = keyof typeof fontWeights;
