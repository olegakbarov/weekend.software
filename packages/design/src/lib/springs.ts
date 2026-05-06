/**
 * Three named spring presets — framer-motion v12 perceptual API.
 * The vocabulary of motion: fast for hovers/fades, moderate for menus/tooltips,
 * slow for modals/panels.
 *
 * Upstream parity: matches `registry/default/lib/springs.ts` at commit d850ecf
 * (mickadesign/fluid-functionalism). Values mirror the CSS companion tokens
 * in tokens.css (`--spring-fast-ms`/`--spring-moderate-ms`/`--spring-slow-ms`).
 */
export const springs = {
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
  },
  moderate: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0.15,
  },
  slow: {
    type: "spring" as const,
    duration: 0.24,
    bounce: 0.15,
  },
} as const;

export type SpringName = keyof typeof springs;
