import type { ProvinceId } from "../types";
import type { RegionFeature, V2Game } from "./model";
export const featureNames: Record<RegionFeature, string> = {
  leyline: "灵脉",
  industrial: "工业基础",
  eldritch: "异常遗迹",
  jianghu: "江湖网络",
  rural: "农业地区",
  civic: "群众组织",
  aerial: "浮空航线",
  coastal: "海岸港湾",
};
export const initialFeatures = (): Record<ProvinceId, RegionFeature[]> => ({
  industry: ["industrial", "civic", "aerial"],
  south: ["leyline", "rural", "jianghu", "civic", "aerial"],
  north: ["eldritch", "rural", "jianghu", "aerial"],
});
export const hasFeature = (
  g: V2Game,
  pid: ProvinceId,
  feature: RegionFeature,
) =>
  (g.machine.regionFeatures ?? initialFeatures())[pid]?.includes(feature) ??
  false;
export function discoverFeature(
  g: V2Game,
  pid: ProvinceId,
  feature: RegionFeature,
  source: string,
) {
  g.machine.regionFeatures ??= initialFeatures();
  if (!hasFeature(g, pid, feature)) g.machine.regionFeatures[pid].push(feature);
  g.machine.origins[`feature:${pid}:${feature}`] = source;
}
