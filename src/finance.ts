import type { GameState } from "./types";
export function fiscalForecast(
  s: GameState,
  maintenance = 0,
  projectCosts = 0,
  income = 5,
  fixed = 4,
) {
  const total = fixed + maintenance + projectCosts,
    paid = Math.min(s.treasury, total);
  return {
    current: s.treasury,
    income,
    fixed,
    maintenance,
    projectCosts,
    total,
    paid,
    next: s.treasury - paid + income,
    default: s.treasury < total,
  };
}
