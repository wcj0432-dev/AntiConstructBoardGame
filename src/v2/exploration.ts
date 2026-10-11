import { hasFeature } from "./regions";
import type { ProvinceId } from "../types";
import type { V2Game } from "./model";
/** Cards are drawn only from plausible local features; repeated ids provide explicit weights. */
export function explorationPool(g: V2Game, pid: ProvinceId) {
  const pool = ["meeting"];
  if (hasFeature(g, pid, "industrial"))
    pool.push("flying", "flying", "meeting");
  if (hasFeature(g, pid, "eldritch")) pool.push("dream", "dream", "dream");
  if (hasFeature(g, pid, "leyline")) pool.push("dream", "sword");
  if (hasFeature(g, pid, "jianghu")) pool.push("sword", "sword");
  if (hasFeature(g, pid, "civic")) pool.push("magic", "magic");
  if (hasFeature(g, pid, "aerial")) pool.push("flying");
  return pool;
}
