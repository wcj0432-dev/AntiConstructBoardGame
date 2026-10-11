import { getPerson } from "../data";
import { assignmentsFor } from "./personnel";
import { courseConditions } from "./training";
import { facilityStatus } from "./operations";
import { workSpecs } from "./administration";
import type { ProvinceId } from "../types";
import type { V2Game } from "./model";
export interface ConditionEvent {
  id: string;
  title: string;
  description: string;
  province: ProvinceId;
  panel: "finance" | "staff" | "local";
  source: string;
  urgent: boolean;
  person?: string;
}
/** State-derived decisions disappear when resolved, without an extra penalty clock. */
export function conditionEvents(g: V2Game): ConditionEvent[] {
  const m = g.machine,
    events: ConditionEvent[] = [];
  for (const w of m.works)
    if (facilityStatus(g, w).state === "maintenance")
      events.push({
        id: `maintenance:${w.id}`,
        title: `${workSpecs[w.type].name}维护欠付`,
        description: `实际欠付${w.maintenance!.arrears}；查看责任方，回拨资金并补缴，或协商维护接管。停运影响收入、供能和教学。`,
        province: w.province,
        panel: "finance",
        source: w.maintenance!.source,
        urgent: true,
      });
  for (const t of m.trainings ?? [])
    if (["active", "paused"].includes(t.state)) {
      const missing = courseConditions(g, t).filter((c) => !c.met);
      if (missing.length)
        events.push({
          id: `training:${t.id}`,
          title: `${getPerson(t.student)?.name}课程待协调`,
          description: `${missing.map((c) => c.reason).join("；")}。已有进度${t.progress}/${t.duration}保留；可以恢复岗位、补缴学院维护或更换合格导师。`,
          person: t.student,
          province: t.province,
          panel: "staff",
          source: t.source,
          urgent: false,
        });
    }
  for (const [office, id] of Object.entries(m.secondaryAppointments ?? {}))
    if (id) {
      const state = assignmentsFor(g, id);
      if (!state.adminAvailable)
        events.push({
          person: id,
          id: `position:${office}`,
          title: `${getPerson(id)?.name}兼职履职冲突`,
          description:
            state.restrictions.join("；") +
            "。解除专职派遣或调整正式岗位后再调用协调能力。",
          province: (office.startsWith("gov-")
            ? office.slice(4)
            : "industry") as ProvinceId,
          panel: "staff",
          source: m.origins[`person:${id}`] ?? "",
          urgent: false,
        });
    }
  for (const pid of ["industry", "south", "north"] as const)
    for (const feature of m.regionFeatures?.[pid] ?? []) {
      const source = m.origins[`feature:${pid}:${feature}`];
      if (source)
        events.push({
          id: `feature:${pid}:${feature}`,
          title: "地方调查形成新行动渠道",
          description: `已确认地域特征 ${feature}；查看地方特色与跨省合作。具体行动仍检查人物、政策和协议。`,
          province: pid,
          panel: "local",
          source,
          urgent: false,
        });
    }
  return events;
}
