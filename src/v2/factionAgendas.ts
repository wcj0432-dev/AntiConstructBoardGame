import { getPerson, getOffice, factionNames } from "../data";
import { availableOfficer, workSpecs } from "./administration";
import { officePerson } from "./personnel";
import { workFunding, accountLabel } from "./fiscal";
import type {
  Action,
  FactionAgenda,
  History,
  V2Game,
  Condition,
} from "./model";
export type HistoryWriter = (
  g: V2Game,
  title: string,
  actors: string[],
  institutions: string[],
  conditions: string[],
  effects: string[],
  parents?: string[],
) => string;
export type AgendaAction = Extract<Action, { type: "agendaDecision" }>;
export const agendaTitles = {
  "construction-budget": "工程主管要求专项预算",
  "maintenance-voice": "维护接管后的地方经营诉求",
};
export function agendaStanding(g: V2Game, a: FactionAgenda) {
  const holder = officePerson(g, a.office),
    w = g.machine.works.find((w) => w.id === a.work);
  const formal =
    !!holder &&
    getPerson(holder)?.faction === a.faction &&
    availableOfficer(g, holder);
  return {
    formal,
    holder,
    interest: !!w && !w.cancelled,
    reason: formal
      ? `${factionNames[a.faction]}通过${getOffice(a.office).name}提出正式议程`
      : `原发起人${getPerson(a.issuer)?.name}当前没有可用的同派系主持职位；合同/行业利益仍在，免职不会抹掉这项已公开要求`,
  };
}
export function agendaOperation(g: V2Game, a: AgendaAction): Action | null {
  const agenda = g.machine.agendas?.items.find((x) => x.id === a.agenda);
  if (!agenda) return null;
  if (a.choice === "accept")
    return agenda.kind === "construction-budget"
      ? { type: "budget", department: "plan", level: 2 }
      : {
          type: "fiscalTransfer",
          province: agenda.province,
          direction: "grant",
          amount: 2,
        };
  if (a.choice === "negotiate")
    return agenda.kind === "construction-budget"
      ? { type: "pause", work: agenda.work }
      : {
          type: "maintenanceSponsor",
          work: agenda.work,
          account: agenda.province,
        };
  return null;
}
export function agendaConditions(g: V2Game, a: AgendaAction): Condition[] {
  const agenda = g.machine.agendas?.items.find((x) => x.id === a.agenda);
  const c = (label: string, met: boolean, reason: string): Condition => ({
    label,
    met,
    reason,
  });
  const out = [
    c(
      "当前有效且尚未处理的议程",
      !!agenda && agenda.state === "active" && g.core.turn <= agenda.deadline,
      "选择未到期且尚未接受、拒绝或替代的议程；旧决定不能重复扣费或领取政治效果",
    ),
  ];
  if (!agenda) return out;
  out.push(
    c(
      "真实合同或工程利益仍在",
      agendaStanding(g, agenda).interest,
      "议程绑定的工程已撤销时，只保留历史，不继续索取资源",
    ),
  );
  if (a.choice === "negotiate")
    out.push(
      c(
        "发起派系的正式谈判资格",
        agendaStanding(g, agenda).formal,
        agendaStanding(g, agenda).reason,
      ),
    );
  if (a.choice === "delay")
    out.push(
      c(
        "只允许一次有代价的延期",
        !agenda.deferred,
        "延期支付1政治资本、顺延一回合；不得无限拖延",
      ),
    );
  return out;
}
export function agendaEffects(g: V2Game, a: AgendaAction) {
  const x = g.machine.agendas?.items.find((x) => x.id === a.agenda);
  if (!x) return [];
  const name = getPerson(x.issuer)?.name ?? x.issuer;
  if (a.choice === "delay")
    return [
      `支付1政治资本，将本议程期限从第${x.deadline}回合结束延至第${x.deadline + 1}回合结束；仅此一次`,
      `到期仍未处理：${name}积怨+1，记录一次；不另扣财政或添加危机`,
    ];
  if (a.choice === "reject")
    return [
      `维持原安排；${name}积怨+1。即使免职，积怨仍影响其未来任用；无额外虚构不满资源`,
    ];
  if (a.choice === "negotiate")
    return [
      x.kind === "construction-budget"
        ? "同意本回合暂停该项工程，释放人员；下一回合起才可按真实条件恢复，不追回历史投资"
        : "地方重新承担本设施维护和既有欠款，产权仍按原合同；这是不同于中央拨款的实际安排",
      `${name}积怨最多-1；关闭本次议程，不可重复获得政治让步`,
    ];
  return [
    x.kind === "construction-budget"
      ? "使用原专项预算：计划部门后续费用及真实施工速度同时改变"
      : "实际从中央转移2资金给诉求所在省，不创造全国财富，也不转移产权",
    `${name}积怨最多-1；关闭本次议程`,
  ];
}
export function applyAgendaDecision(
  g: V2Game,
  a: AgendaAction,
  source: string,
) {
  const x = g.machine.agendas!.items.find((x) => x.id === a.agenda)!;
  if (a.choice === "delay") {
    x.deferred = true;
    x.deadline++;
    x.delaySource = source;
    return;
  }
  x.state =
    a.choice === "accept"
      ? "accepted"
      : a.choice === "negotiate"
        ? "negotiated"
        : "rejected";
  x.decisionSource = source;
  if (a.choice === "negotiate" && x.kind === "construction-budget")
    x.resumeAfter = g.core.turn + 1;
  g.core.grievances[x.issuer] = Math.max(
    0,
    (g.core.grievances[x.issuer] ?? 0) + (a.choice === "reject" ? 1 : -1),
  );
}
/** Two reusable, event-driven interests, once per kind per government, max two active. */
export function collectAgendas(
  before: V2Game,
  g: V2Game,
  write: HistoryWriter,
) {
  const state = g.machine.agendas;
  if (!state || g.core.status !== "playing") return;
  for (const a of state.items.filter((a) => a.state === "active")) {
    const w = g.machine.works.find((w) => w.id === a.work);
    const noLongerRelevant =
      !w ||
      w.cancelled ||
      (a.kind === "construction-budget" &&
        (w.completed || g.machine.departmentBudgets.plan === 2)) ||
      (a.kind === "maintenance-voice" && w.maintenanceSponsor !== "central");
    if (noLongerRelevant) {
      a.state = "superseded";
      a.decisionSource = write(
        g,
        "派系议程因实际安排变化结束",
        [a.issuer],
        [a.office],
        ["原诉求已被实际工程/预算/责任变化取代"],
        ["不追加奖励或处罚；原发起记录保留"],
        [a.source, w?.sponsorSource ?? ""],
      );
    }
  }
  if (state.items.filter((a) => a.state === "active").length >= 2) return;
  const candidates: {
    kind: FactionAgenda["kind"];
    work: V2Game["machine"]["works"][number];
    office: string;
    trigger: string;
  }[] = [];
  for (const w of g.machine.works) {
    if (w.cancelled) continue;
    const old = before.machine.works.find((x) => x.id === w.id);
    if (
      !old &&
      ["grid", "rail", "factory"].includes(w.type) &&
      !w.completed &&
      g.machine.departmentBudgets.plan === 1
    )
      candidates.push({
        kind: "construction-budget",
        work: w,
        office: "plan",
        trigger: w.source,
      });
    if (
      w.completed &&
      w.maintenanceSponsor === "central" &&
      w.sponsorSource !== old?.sponsorSource &&
      workFunding(g, w).owner !== "central" &&
      workSpecs[w.type].maintenance > 0
    )
      candidates.push({
        kind: "maintenance-voice",
        work: w,
        office: `gov-${w.province}`,
        trigger: w.sponsorSource!,
      });
  }
  for (const c of candidates) {
    if (
      state.seen.includes(c.kind) ||
      state.items.filter((a) => a.state === "active").length >= 2
    )
      continue;
    const issuer = officePerson(g, c.office);
    if (!issuer || !availableOfficer(g, issuer)) continue;
    if (c.kind === "maintenance-voice" && !g.machine.rights[c.work.province])
      continue;
    const source = write(
      g,
      `派系议程提出：${agendaTitles[c.kind]}`,
      [issuer],
      [c.office],
      [`实际${workSpecs[c.work.type].name}及现任${getOffice(c.office).name}`],
      [
        c.kind === "construction-budget"
          ? "要求计划专项预算；也可正式谈判暂停该项工程"
          : "中央接管维护后，地方要求2资金维持经营；也可谈判重新由地方承担维护",
        `第${g.core.turn + 2}回合结束到期；未处理使${getPerson(issuer)?.name}积怨+1，仅一次；可支付1政治资本延期一次`,
      ],
      [c.trigger],
    );
    state.items.push({
      id: `agenda-${g.core.nextId++}`,
      kind: c.kind,
      work: c.work.id,
      province: c.work.province,
      office: c.office,
      issuer,
      faction: getPerson(issuer)!.faction,
      created: g.core.turn,
      deadline: g.core.turn + 2,
      deferred: false,
      source,
      trigger: c.trigger,
      state: "active",
    });
    state.seen.push(c.kind);
  }
}
export function expireAgendas(g: V2Game, write: HistoryWriter) {
  for (const a of g.machine.agendas?.items ?? [])
    if (a.state === "active" && g.core.turn >= a.deadline) {
      a.state = "expired";
      g.core.grievances[a.issuer] = (g.core.grievances[a.issuer] ?? 0) + 1;
      a.decisionSource = write(
        g,
        "派系议程到期：未履行公开要求",
        [a.issuer],
        [a.office],
        [`第${a.deadline}回合结束，尚未接受、妥协或拒绝`],
        [`${getPerson(a.issuer)?.name}积怨+1；只记一次，不追加独立惩罚资源`],
        [a.source],
      );
    }
}
export function agendaDescription(g: V2Game, a: FactionAgenda) {
  return `${getPerson(a.issuer)?.name} · ${factionNames[a.faction]}：${a.kind === "construction-budget" ? `围绕${workSpecs[g.machine.works.find((w) => w.id === a.work)!.type].name}申请计划专项预算` : `${accountLabel(g, a.province)}在中央接管维护后要求实际经营支持`}。处理期限第${a.deadline}回合结束。`;
}
export type AgendaHistory = History;

/** A negotiated pause is a real, one-turn contractual commitment, not a free cancel/restart loop. */
export function agendaCommitmentConditions(g: V2Game, a: Action): Condition[] {
  if (a.type !== "pause" && a.type !== "workControl") return [];
  const w = g.machine.works.find((w) => w.id === a.work);
  const resumes = a.type === "pause" ? !!w?.paused : a.operation === "restart";
  if (!resumes) return [];
  return (g.machine.agendas?.items ?? [])
    .filter(
      (x) =>
        x.work === a.work &&
        x.state === "negotiated" &&
        x.kind === "construction-budget" &&
        g.core.turn < (x.resumeAfter ?? 0),
    )
    .map((x) => ({
      label: "履行已经签署的暂缓承诺",
      met: false,
      reason: `本项工程已协商暂停至本回合结束，第${x.resumeAfter}回合起可以按原条件恢复；其他工程与行政类别不受此承诺限制`,
      source: x.decisionSource,
    }));
}
