import type { Action, RegionFeature, V2Game } from "./model";
import type { ProvinceId } from "../types";
import { hasFeature } from "./regions";
export interface RegionalOpportunity {
  id: string;
  group: "local" | "special" | "cross";
  label: string;
  action: Action;
  features: RegionFeature[];
  scope: ProvinceId[];
  repeat: "once" | "limited";
  effect: string;
}
/** Visibility is geographical discovery; action legality remains the engine's shared preview. */
export function regionalActions(
  g: V2Game,
  pid: ProvinceId,
  to: ProvinceId,
): RegionalOpportunity[] {
  const entry = (
    id: string,
    group: RegionalOpportunity["group"],
    label: string,
    action: Action,
    features: RegionFeature[] = [],
    effect = "读取真实权限、人员、付款与地区条件",
    repeat: RegionalOpportunity["repeat"] = "once",
  ): RegionalOpportunity => ({
    id,
    group,
    label,
    action,
    features,
    scope: group === "cross" ? [pid, to] : [pid],
    repeat,
    effect,
  });
  const rows = [
    entry("warning", "local", "建设本地异常预警站", {
      type: "project",
      project: "warning",
      province: pid,
    }),
    entry("resources", "local", "地方资源与民生普查", {
      type: "survey",
      province: pid,
      field: "resources",
    }),
    entry(
      "audit",
      "local",
      "地方财政稽核",
      { type: "audit", province: pid, lead: `gov-${pid}` },
      [],
      "有限回收漏税，揭示真实地方财政控制",
      "limited",
    ),
    entry("anomaly", "local", "本地异常与行政调查", {
      type: "survey",
      province: pid,
      field: "anomaly",
    }),
    entry(
      "agreement",
      "local",
      "行政协作与收益磋商",
      { type: "coordinate", province: pid, kind: "agreement" },
      [],
      "在实际计划委与地方协作下恢复渠道",
      "limited",
    ),
    entry(
      "exercise",
      "local",
      "基层跨部门应急演习",
      { type: "coordinate", province: pid, kind: "exercise" },
      [],
      "须有安全预算与负责人员，有限保护期",
      "limited",
    ),
    entry(
      "ley",
      "special",
      "灵脉勘探与工程机会",
      { type: "investigate", deck: "ley", province: pid },
      ["leyline"],
    ),
    entry(
      "archive",
      "special",
      "异常契约遗迹调查",
      { type: "investigate", deck: "archive", province: pid },
      ["eldritch"],
    ),
    entry(
      "routes",
      "special",
      "浮空港航线调查",
      { type: "survey", province: pid, field: "routes" },
      ["aerial"],
    ),
    entry(
      "factory",
      "special",
      "本地工业设施改造",
      {
        type: "project",
        project: "factory",
        province: pid,
        worker: "guhe",
        assignment: "dedicated",
      },
      ["industrial"],
    ),
    entry(
      "farm",
      "special",
      "农业合作改良",
      {
        type: "project",
        project: "farm",
        province: pid,
        worker: "tang",
        assignment: "dedicated",
      },
      ["rural"],
    ),
    entry(
      "caravan",
      "special",
      "江湖承诺物流",
      { type: "personSkill", person: "yanxingzhou", province: pid },
      ["jianghu"],
    ),
    entry(
      "civic",
      "special",
      "群众组织机会调查",
      { type: "investigate", deck: "civic", province: pid },
      ["civic"],
    ),
    entry("rail", "cross", "规划跨省铁路", {
      type: "project",
      project: "rail",
      province: pid,
      to,
      worker: "guhe",
      assignment: "dedicated",
    }),
    entry(
      "transfer",
      "cross",
      "真实铁路物资调运",
      { type: "transfer", from: pid, to, amount: 2 },
      [],
      "来源支出3实物，目标得到2，损耗1",
      "limited",
    ),
    entry(
      "grid",
      "cross",
      "跨省灵能供给规划",
      {
        type: "project",
        project: "grid",
        province: pid,
        to,
        worker: "mo",
        assignment: "dedicated",
      },
      ["leyline"],
    ),
  ];
  return rows.filter((r) =>
    r.features.every((feature) => hasFeature(g, pid, feature)),
  );
}
export function cooperationLink(g: V2Game, pid: ProvinceId) {
  const plan =
    g.core.appointments.plan || g.machine.secondaryAppointments?.plan;
  const gov =
    g.core.appointments[`gov-${pid}`] ||
    g.machine.secondaryAppointments?.[`gov-${pid}`];
  return g.machine.cooperation &&
    g.core.policies.method === 1 &&
    g.machine.rights[pid] &&
    plan &&
    gov
    ? g.machine.relationships?.find(
        (r) =>
          r.province === pid &&
          r.actors.includes(plan) &&
          r.actors.includes(gov),
      )
    : undefined;
}
