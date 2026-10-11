import { availableOfficer, workOperating } from "./administration";
import { officePerson } from "./personnel";
import { regionPassable } from "./operations";
import type { ProvinceId } from "../types";
import type { Condition, V2Game } from "./model";

export function plannerReady(g: V2Game) {
  return (
    availableOfficer(g, officePerson(g, "plan")) &&
    g.machine.departmentBudgets.plan > 0
  );
}
/** Permanent usable network conditions deliberately exclude this shipment's stock, cash and command. */
export function transportConditions(
  g: V2Game,
  from: ProvinceId,
  to: ProvinceId,
): Condition[] {
  const m = g.machine;
  return [
    {
      label: "实际跨省铁路与通行地区",
      met:
        from !== to &&
        regionPassable(g, from) &&
        regionPassable(g, to) &&
        m.works.some(
          (w) =>
            w.type === "rail" &&
            workOperating(g, w) &&
            ((w.province === from && w.to === to) ||
              (w.province === to && w.to === from)),
        ),
      reason: "竣工铁路须维护履约，两端无隔离或严重危机阻断",
    },
    {
      label: "计划调度负责人实际履职",
      met: plannerReady(g),
      reason:
        "任命可履职的计划主管；专职派遣、即时占用、拒绝履职或预算0都会中断调度",
    },
    {
      label: "运输兼容与两端管理协议",
      met: m.standards && m.cooperation && m.rights[from] && m.rights[to],
      reason: "建立兼容标准、合作与两端收益权；铁路不是无条件征调权",
    },
  ];
}
