import type { V2Game, Work } from "./model";
import type { ProvinceId } from "../types";

export function regionPassable(g: V2Game, pid: ProvinceId) {
  return !g.machine.matters.some(
    (m) => m.province === pid && (m.isolated || m.stage >= 3),
  );
}
/** One operating decision for income, production, networks, teaching and goals. */
export function facilityStatus(
  g: V2Game,
  w: Work,
): {
  state: "building" | "cancelled" | "maintenance" | "stopped" | "operating";
  reason: string;
} {
  const m = g.machine;
  if (w.cancelled)
    return { state: "cancelled", reason: "已取消，不提供设施能力" };
  if (!w.completed)
    return {
      state: "building",
      reason: w.paused ? "施工暂停" : "建设中，尚无经营能力",
    };
  if ((w.maintenance?.arrears ?? 0) > 0)
    return {
      state: "maintenance",
      reason: `维护欠付${w.maintenance!.arrears}，补足责任账户欠款后恢复；当期收入不能提前支付维护`,
    };
  if (m.matters.some((x) => x.province === w.province && x.isolated))
    return { state: "stopped", reason: "所在地隔离，暂停经营、生产及教学" };
  if (
    ["farm", "port", "cooperative", "academy"].includes(w.type) &&
    (!m.rights[w.province] ||
      m.trust[w.province] < 2 ||
      m.suppressed[w.province])
  )
    return { state: "stopped", reason: "地方收益权、信任2或可用地方组织不足" };
  if (["cooperative", "port"].includes(w.type) && g.core.policies.method !== 1)
    return { state: "stopped", reason: "缺少协商经营政策" };
  if (w.type === "factory" && !m.standards)
    return { state: "stopped", reason: "兼容技术标准失效" };
  if (w.type === "academy" && !m.cooperation)
    return { state: "stopped", reason: "跨组织教学渠道中断" };
  if (
    w.type === "rail" &&
    (!w.to || !regionPassable(g, w.province) || !regionPassable(g, w.to))
  )
    return { state: "stopped", reason: "铁路端点缺失、隔离或严重危机阻断" };
  if (w.type === "grid") {
    if (!w.network?.active || w.network.fault)
      return {
        state: "stopped",
        reason: w.network?.fault
          ? "灵能故障，须合法技术维修"
          : "运营者关闭供能，仍须履行维护",
      };
    if (
      m.matters.some(
        (x) =>
          [w.province, w.to ?? "industry"].includes(x.province) &&
          (x.isolated ||
            (["accident", "oldgod"].includes(x.kind) &&
              x.stage >= 3 &&
              x.containment === 0)),
      )
    )
      return { state: "stopped", reason: "供能端或受益端异常 / 隔离中断电网" };
  }
  return {
    state: "operating",
    reason: "维护履约及当前组织、政策和地区条件有效",
  };
}
export const facilityOperating = (g: V2Game, w: Work) =>
  facilityStatus(g, w).state === "operating";
export const facilityStateNames = {
  building: "建设中",
  cancelled: "已取消",
  maintenance: "维护欠付停运",
  stopped: "其他原因停运",
  operating: "正常运行",
};
