import { lawAuthority } from "./nationalStrategy";
import { getOffice, getPerson } from "../data";
import { availableOfficer } from "./administration";
import { gridOperating, workFunding } from "./fiscal";
import { assignedOffices, officePerson } from "./personnel";
import { projectCandidate } from "./traits";
import type { Action, Condition, V2Game, V2Preview, Work } from "./model";
const c = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
export function networkAuthority(g: V2Game, w: Work) {
  const owner = workFunding(g, w).owner,
    central = owner === "central",
    joint = owner === "joint";
  const local = availableOfficer(g, officePerson(g, `gov-${w.province}`));
  return central
    ? availableOfficer(g, officePerson(g, "plan"))
    : joint
      ? local && g.machine.trust[w.province] >= 2 && g.machine.cooperation
      : !!w.network?.consentUntil && w.network.consentUntil >= g.core.turn;
}
export function networkPreview(
  g: V2Game,
  a: Extract<Action, { type: "network" }>,
): Partial<V2Preview> {
  const w = g.machine.works.find((w) => w.id === a.work),
    conditions: Condition[] = [],
    actors: string[] = [],
    costs = {
      commands: 1,
      treasury: 0,
      capital: 0,
      stock: 0,
      province: w?.province,
    };
  const title = {
    repair: "维修跨省灵能电网",
    close: "中央下令停机",
    reopen: "恢复跨省供能",
    consent: "取得运营者应急授权",
  }[a.operation];
  conditions.push(
    c(
      "真实电网设施",
      !!w && w.type === "grid" && w.completed && !w.cancelled,
      "先完成具有实际融资与管理合同的跨省灵能电网",
    ),
  );
  if (!w)
    return { title, conditions, costs, effects: [], actors, institutions: [] };
  const contract = workFunding(g, w),
    plan = officePerson(g, "plan"),
    gov = officePerson(g, `gov-${w.province}`);
  const technician = Object.values(g.core.appointments)
    .concat(Object.values(g.machine.secondaryAppointments ?? {}))
    .find(
      (id) =>
        !!id &&
        availableOfficer(g, id) &&
        projectCandidate(g, id, "grid", w.province),
    );
  if (a.operation === "consent") {
    costs.capital = 1;
    conditions.push(
      c(
        "运营者可以协商",
        availableOfficer(g, gov) &&
          g.machine.trust[w.province] >= 2 &&
          g.core.policies.method === 1,
        "本省主管须可履职、信任2与协商政策；地方产权不能被资金直接越过",
      ),
    );
    if (contract.owner === "cult")
      conditions.push(
        c(
          "宗门技术代表在位",
          !!technician,
          "宗门经营须可履职的灵能技术代表参与协商",
        ),
      );
    if (gov) actors.push(gov);
    if (technician) actors.push(technician);
  } else {
    conditions.push(
      c(
        "合同中的应急管理权",
        networkAuthority(g, w) ||
          (a.operation === "repair" && lawAuthority(g, w)),
        "中央未取得运营者停机/维修权限。地方/宗门产权先取得应急授权；央地共管须本地主管、信任2及合作；中央独资需计划负责人可履职。有效法域可执行已登记电网的技术维修，不能代替停机控制权",
      ),
    );
    if (plan) actors.push(plan);
    if (a.operation === "repair") {
      costs.treasury = 1;
      costs.stock = 1;
      conditions.push(
        c(
          "实际灵能技术与岗位",
          !!technician,
          "可履职的墨玄、宗门代表、跨界工程师或已培训继任者必须在正式职位参与维修",
        ),
        c("存在真实故障", !!w.network?.fault, "网络无故障，不需要重复维修"),
      );
      if (technician) actors.push(technician);
    } else if (a.operation === "close")
      conditions.push(
        c(
          "网络尚未停机",
          !!w.network?.active,
          "设施已经停机；停机解除故障传播但停止工业额外生产和税源",
        ),
      );
    else
      conditions.push(
        c("网络尚未供能", !w.network?.active, "设施已经在供能，无需重复恢复"),
        c(
          "异常源可控且故障已修复",
          !w.network?.fault &&
            !g.machine.matters.some(
              (m) =>
                ["accident", "oldgod"].includes(m.kind) &&
                m.province === w.province &&
                (m.isolated || (m.stage >= 3 && m.containment === 0)),
            ),
          "先维修并处置南岭异常源；恢复供能不能自动消除源头危机",
        ),
      );
  }
  return {
    title,
    conditions,
    costs,
    actors: [...new Set(actors)],
    institutions: ["plan", `gov-${w.province}`],
    effects:
      a.operation === "consent"
        ? ["按运营合同取得三回合应急管理授权，不转移产权；参与者本回合占用。"]
        : a.operation === "close"
          ? [
              "停止供能；工业省额外产出与税源+2暂停，故障不再沿网络施压，但设施维护继续。",
            ]
          : a.operation === "repair"
            ? ["修复实际电网故障，保留产权；若源头仍失控，恢复供能仍被阻止。"]
            : [
                "恢复供能，工业省产出与常规税源+2重新启用；收益按实际合同分配。",
              ],
  };
}
export function applyNetwork(
  g: V2Game,
  a: Extract<Action, { type: "network" }>,
  source: string,
) {
  const w = g.machine.works.find((w) => w.id === a.work)!;
  w.network ??= { active: true, fault: false };
  if (a.operation === "consent") w.network.consentUntil = g.core.turn + 2;
  else if (a.operation === "repair") {
    w.network.fault = false;
    const cases = [...g.machine.matters, ...g.machine.backlog].filter(
      (m) => m.kind === "energyFault" && m.variant === w.id,
    );
    for (const m of cases) {
      m.lifecycle = "resolved";
      g.machine.archive.push(m);
      delete g.machine.authorization[m.id];
    }
    g.machine.matters = g.machine.matters.filter((m) => !cases.includes(m));
    g.machine.backlog = g.machine.backlog.filter((m) => !cases.includes(m));
  } else w.network.active = a.operation === "reopen";
  g.machine.origins[`network:${w.id}`] = source;
  for (const actor of networkPreview(g, a).actors ?? [])
    g.machine.occupied[actor] = source;
}
export function networkRelations(g: V2Game, w: Work) {
  const c = workFunding(g, w);
  return {
    producer: w.province,
    beneficiary: c.beneficiary ?? w.to ?? "industry",
    operator: c.owner,
    investors: c.shares,
    technical: w.worker,
    operating: gridOperating(g, w),
    source: w.source,
    currentAuthority: networkAuthority(g, w),
    institutions: ["plan", `gov-${w.province}`],
    workerOffice: w.worker
      ? assignedOffices(g, w.worker)
          .map((id) => getOffice(id).name)
          .join("、")
      : "",
    workerName: getPerson(w.worker)?.name ?? "未分配",
  };
}
