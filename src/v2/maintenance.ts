import {
  accountBalance,
  accountLabel,
  addLedger,
  setBalance,
  workFunding,
} from "./fiscal";
import { availableOfficer, workSpecs } from "./administration";
import { officePerson } from "./personnel";
import type { Action, Condition, V2Game, V2Preview } from "./model";

export type MaintenanceAction = Extract<
  Action,
  { type: "maintain" | "maintenanceSponsor" }
>;
export function maintenancePreview(
  g: V2Game,
  a: MaintenanceAction,
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
  const w = g.machine.works.find((w) => w.id === a.work),
    owner = w ? workFunding(g, w).owner : "central";
  const office = owner === "central" ? "plan" : `gov-${w?.province ?? "south"}`;
  const person = officePerson(g, office);
  const conditions: Condition[] = [
    {
      label: "实际竣工且有维护义务的设施",
      met: !!w?.completed && !w.cancelled && !!workSpecs[w.type].maintenance,
      reason: "选择已竣工、有维护合同的设施",
    },
    {
      label: "维护责任与管理协商",
      met:
        availableOfficer(g, person) &&
        (owner === "central" ||
          (g.machine.rights[w?.province ?? "south"] &&
            g.machine.trust[w?.province ?? "south"] > 0)),
      reason:
        "责任机构须能履职，地方/宗门设施须保有管理权与信任；资金不替代权限",
    },
  ];
  const effects: string[] = [];
  if (a.type === "maintain") {
    conditions.push({
      label: "存在实际维护欠款",
      met: (w?.maintenance?.arrears ?? 0) > 0,
      reason: "无欠付无需补缴；故障仍须另行技术维修",
    });
    for (const row of w?.maintenance?.payments ?? [])
      if (row.arrears) {
        conditions.push({
          label: `${accountLabel(g, row.account)}补缴${row.arrears}`,
          met: accountBalance(g, row.account) >= row.arrears,
          reason: "先向责任地方拨款，或明确变更维护承担方；中央不自动代付",
        });
        effects.push(
          `${accountLabel(g, row.account)}实际支付${row.arrears}，清偿本设施对应欠款`,
        );
      }
    effects.push(
      "补足后立即重新检查隔离、故障、政策与运营权限；不补发停运期间损失的收入，也不自动维修技术故障",
    );
  } else {
    const sponsor = a.account;
    conditions.push({
      label: "合法维护接管方",
      met:
        ["central", "industry", "south", "north", "cult"].includes(sponsor) &&
        sponsor !== w?.maintenanceSponsor &&
        (sponsor === "central"
          ? availableOfficer(g, officePerson(g, "plan"))
          : sponsor === "cult"
            ? !!g.machine.cooperation &&
              !!g.machine.surveyed &&
              g.machine.rights.south
            : !!g.machine.fiscal?.agreements.includes(sponsor)),
      reason:
        "中央计划委须在岗；地方须有正式财政协议；宗门须有已勘探的合作与收益渠道",
    });
    effects.push(
      `${accountLabel(g, sponsor)}明确承接本设施当前欠款及未来维护费；产权、投资收益和停机控制权保留原合同`,
      "不立即创造资金或清偿欠款；接管后仍须实际补缴或等待正常结算付款",
    );
  }
  return {
    title: a.type === "maintain" ? "补足设施维护欠款" : "协商接管维护责任",
    conditions,
    costs: {
      commands: 1,
      treasury: 0,
      capital: a.type === "maintenanceSponsor" ? 1 : 0,
      stock: 0,
    },
    actors: person ? [person] : [],
    institutions: [office],
    effects,
    parents: [w?.source, w?.sponsorSource].filter((x): x is string => !!x),
  };
}
export function applyMaintenance(
  g: V2Game,
  a: MaintenanceAction,
  source: string,
) {
  const w = g.machine.works.find((w) => w.id === a.work)!;
  if (a.type === "maintenanceSponsor") {
    w.maintenanceSponsor = a.account;
    w.sponsorSource = source;
    if (w.maintenance && w.maintenance.arrears)
      w.maintenance.payments = [
        ...w.maintenance.payments
          .filter((p) => p.paid > 0)
          .map((p) => ({ ...p, due: p.paid, arrears: 0 })),
        {
          account: a.account,
          due: w.maintenance.arrears,
          paid: 0,
          arrears: w.maintenance.arrears,
        },
      ];
  } else {
    const state = w.maintenance!;
    for (const row of state.payments) {
      if (!row.arrears) continue;
      setBalance(g, row.account, accountBalance(g, row.account) - row.arrears);
      addLedger(
        g,
        row.account,
        "public",
        row.arrears,
        `${workSpecs[w.type].name}补足维护`,
        source,
        "maintenance",
      );
      state.paid += row.arrears;
      row.paid += row.arrears;
      row.arrears = 0;
    }
    state.arrears = 0;
    state.lastPaidTurn = g.core.turn;
    state.source = source;
  }
}
