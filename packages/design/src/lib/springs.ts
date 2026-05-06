import type { Transition } from "framer-motion";

/**
 * Three named spring presets. The vocabulary of motion:
 * fast for hovers/fades, moderate for menus/tooltips, slow for modals/panels.
 */
export const springs = {
  fast: { type: "spring", stiffness: 600, damping: 40, mass: 0.5 },
  moderate: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  slow: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof springs;
