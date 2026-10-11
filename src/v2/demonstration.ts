import { newV2, deserializeV2, serializeV2 } from "./engine";
import {
  accountBalance,
  accountLabel,
  fundingPayments,
  makeFunding,
  moveMoney,
  workFunding,
} from "./fiscal";
import { workSpecs } from "./administration";
import { plannerReady } from "./qualifications";
import { facilityOperating } from "./operations";
import type { FiscalAccount, V2Game, V2Preview } from "./model";

/** A disclosed scenario budget; normal campaigns retain their original resources. */
export function startSuccessionDemo() {
  const g = newV2("experimental", "spark", "南岭工程与人才接班-v06");
  const m = g.machine;
  g.core.treasury = 36;
  m.fiscal!.locals = { industry: 12, south: 12, north: 12 };
  m.fiscal!.cultTreasury = 8;
  m.goalPending = false;
  m.matters = [];
  m.backlog = [];
  m.cooperation = true;
  m.standards = true;
  m.surveyed = true;
  m.knowledge = true;
  m.rights = { industry: true, south: true, north: true };
  m.trust = { industry: 3, south: 3, north: 3 };
  m.fiscal!.agreements = ["industry", "south", "north"];
  g.core.policies.method = 1;
  g.core.policies.disclosure = null;
  g.core.appointments["gov-south"] = "mo";
  const source = `history-${g.core.nextId++}`;
  m.history.unshift({
    id: source,
    turn: 1,
    title: "南岭工程与人才接班：场景准备",
    actors: ["lin", "mo"],
    institutions: ["plan", "gov-south"],
    conditions: ["独立的十二回合跨系统演示，不计入原始资源平衡通关"],
    effects: [
      "中央36、三省各12、宗门8；已建立勘探、财政协议、兼容标准与合作；南岭历史学院可供两人教学。下一步由玩家签订电网合同。",
    ],
    parents: [],
  });
  m.works.push({
    id: `work-${g.core.nextId++}`,
    type: "academy",
    province: "south",
    progress: 2,
    duration: 2,
    completed: true,
    paused: false,
    cancelled: false,
    assignment: "advisor",
    source,
    contract: makeFunding(
      g,
      {
        type: "project",
        project: "academy",
        province: "south",
        funding: "local",
      },
      source,
    ),
    maintenance: {
      turn: -1,
      fee: 1,
      due: 0,
      paid: 0,
      arrears: 0,
      payments: [],
      source,
    },
  });
  m.demonstration = {
    id: "succession",
    failed: false,
    reserveSource: undefined,
  };
  m.origins.surveyed = source;
  m.origins.cooperation = source;
  m.origins.standards = source;
  return deserializeV2(serializeV2(g));
}
export function demoGrid(g: V2Game) {
  return g.machine.works.find(
    (w) => w.type === "grid" && w.province === "south" && !w.cancelled,
  );
}
export function demoPayer(g: V2Game): FiscalAccount | undefined {
  const w = demoGrid(g);
  return w
    ? (w.maintenanceSponsor ??
        fundingPayments(
          workFunding(g, w),
          workSpecs.grid.maintenance,
          g.core.turn,
        )[0]?.account)
    : undefined;
}
export function demoPhase(g: V2Game) {
  const d = g.machine.demonstration,
    w = demoGrid(g);
  if (!d || !w) return 1;
  if (
    !w.completed ||
    !(g.machine.trainings ?? []).some(
      (t) => t.state === "completed" && t.cap === "leywork",
    )
  )
    return 2;
  if (!d.failed || !facilityOperating(g, w)) return 3;
  return 4;
}
export function demoReservePreview(
  g: V2Game,
): Pick<
  V2Preview,
  | "title"
  | "conditions"
  | "costs"
  | "actors"
  | "institutions"
  | "effects"
  | "parents"
> {
  const d = g.machine.demonstration,
    w = demoGrid(g),
    payer = demoPayer(g),
    amount = payer ? accountBalance(g, payer) : 0;
  return {
    title: "场景预算决策：拨出责任账户应急准备金",
    conditions: [
      {
        label: "四阶段场景中的一次预算决策",
        met: !!d && !d.reserveSource && !!w?.completed && !!payer,
        reason: "仅在演示场景电网竣工后执行一次；正式战役不会扣除这笔准备金",
      },
      {
        label: "计划机关能主持预算调拨",
        met: plannerReady(g),
        reason: "计划委负责人须实际在岗、有预算且未被专职派遣",
      },
    ],
    costs: { commands: 1, treasury: 0, capital: 0, stock: 0 },
    actors: [g.core.appointments.plan!].filter(Boolean),
    institutions: ["plan"],
    effects: [
      `${payer ? accountLabel(g, payer) : "责任账户"}余额${amount}全部转至${payer === "central" ? "工业省" : "中央"}应急准备金，资金总量守恒`,
      "下一期先付维护再收税，该责任方余额不足将让本设施停运；接管责任或财政回拨后须实际补缴",
      "这项场景决策公开制造预算冲突；不会改写产权、授予资质或替玩家清偿欠款",
    ],
    parents: w ? [w.source] : [],
  };
}
export function applyDemoReserve(g: V2Game, source: string) {
  const payer = demoPayer(g)!;
  moveMoney(
    g,
    payer,
    payer === "central" ? "industry" : "central",
    accountBalance(g, payer),
    "演示：应急准备金调拨",
    source,
  );
  g.machine.demonstration!.reserveSource = source;
}
export function observeDemoSettlement(g: V2Game) {
  const d = g.machine.demonstration,
    w = demoGrid(g);
  if (d && w?.completed && (w.maintenance?.arrears ?? 0) > 0) d.failed = true;
}
