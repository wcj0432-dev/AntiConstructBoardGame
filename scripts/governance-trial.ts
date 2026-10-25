import { startGovernanceTrial, trialChecks } from "../src/v2/governanceTrial";
import {
  executeCommand,
  previewAction,
  serializeV2,
  deserializeV2,
  finance,
} from "../src/v2/engine";
import type { Action } from "../src/v2/model";
export function runGovernanceTrial(path: "central" | "local" | "professional") {
  let g = startGovernanceTrial();
  const opening = structuredClone(g),
    trace: {
      turn: number;
      action: Action;
      commands: number;
      cash: number;
      capital: number;
    }[] = [],
    snapshots: (typeof g)[] = [],
    settlements: ReturnType<typeof finance>[] = [];
  const act = (a: Action) => {
    const r = executeCommand(g, a);
    if (r.result.status === "failed")
      throw Error(
        `T${g.core.turn} ${JSON.stringify(a)} ${r.result.errors.join(";")} ${JSON.stringify({ cash: g.core.treasury, commands: g.core.commands, roles: g.core.appointments, occupied: g.machine.occupied, works: g.machine.works.map((w) => ({ type: w.type, progress: w.progress, completed: w.completed, network: w.network, maint: w.maintenance })), locals: g.machine.fiscal!.locals })}`,
      );
    trace.push({
      turn: g.core.turn,
      action: a,
      commands: r.game.core.commands,
      cash: r.game.core.treasury,
      capital: r.game.core.capital,
    });
    g = r.game;
  };
  const resolve = (kind: string, option: string) => {
    const m = g.machine.matters.find((m) => m.kind === kind);
    if (!m) throw Error(`T${g.core.turn} missing ${kind}`);
    act({ type: "resolve", matter: m.id, option });
  };
  const seal = () => {
    const m = g.machine.matters.find((m) => m.kind === "accident")!;
    if (
      previewAction(g, { type: "resolve", matter: m.id, option: "seal" }).errors
        .length
    )
      act({
        type: "authorize",
        matter: m.id,
        lead: "anomaly",
        joint: false,
        emergency: false,
      });
    resolve("accident", "seal");
  };
  const end = () => {
    snapshots.push(structuredClone(g));
    settlements.push(finance(g));
    const before = serializeV2(g),
      reload = deserializeV2(before);
    if (serializeV2(reload) !== before) throw Error("Trial roundtrip differs");
    g = reload;
    act({ type: "end" });
    if (g.core.status === "lost") throw Error(`Trial lost: ${g.core.ending}`);
  };
  const grid = () => g.machine.works.find((w) => w.type === "grid")!;
  const decision = (
    kind: "construction-budget" | "maintenance-voice",
    choice: "accept" | "negotiate",
  ) => {
    const a = g.machine.agendas!.items.find(
      (a) => a.kind === kind && a.state === "active",
    );
    if (!a) throw Error(`missing ${kind}`);
    act({ type: "agendaDecision", agenda: a.id, choice });
  };
  // Meeting 1: three different responses to the same genuinely occupied planner.
  if (path === "central")
    act({ type: "appoint", office: "plan", person: "wen" });
  else if (path === "local")
    act({ type: "appoint", office: "gov-south", person: "xing" });
  else {
    act({ type: "appoint", office: "gov-industry", person: "wen" });
    act({ type: "appoint", office: "plan", person: null });
    act({ type: "concurrent", office: "plan", person: "wen" });
    act({
      type: "train",
      mentor: "mo",
      student: "yunsong",
      cap: "leywork",
      province: "south",
      method: "academy",
      facility: g.machine.works.find((w) => w.type === "academy")!.id,
    });
  }
  end();
  // Meeting 2: actual construction contract, original accident and a real agenda.
  act({
    type: "project",
    project: "grid",
    province: "south",
    to: "industry",
    worker: "linruoxu",
    assignment: "dedicated",
    funding:
      path === "central" ? "central" : path === "local" ? "local" : "joint",
  });
  decision(
    "construction-budget",
    path === "professional" ? "negotiate" : "accept",
  );
  if (path === "local") {
    resolve("accident", "public");
    act({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 5,
    });
  } else {
    seal();
    act({ type: "reconcile", province: "south" });
  }
  end();
  // Meeting 3: finance and public authority vs real graduation and specialization.
  if (path === "central") {
    const m = g.machine.matters.find((m) => m.kind === "distrust")!;
    act({
      type: "authorize",
      matter: m.id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    resolve("distrust", "rights");
  } else if (path === "local") {
    seal();
    act({ type: "maintenanceSponsor", work: grid().id, account: "central" });
    act({ type: "appoint", office: "anomaly", person: "linruoxu" });
    act({ type: "network", work: grid().id, operation: "consent" });
  } else {
    act({ type: "pause", work: grid().id });
    act({ type: "budget", department: "plan", level: 2 });
    const m = g.machine.matters.find((m) => m.kind === "distrust")!;
    act({
      type: "authorize",
      matter: m.id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    resolve("distrust", "rights");
    act({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 5,
    });
  }
  end();
  // Meeting 4: the early build has a genuine scheduled fault; late build avoids that risk.
  if (path === "central") {
    act({ type: "network", work: grid().id, operation: "repair" });
    act({ type: "appoint", office: "plan", person: "lin" });
    resolve("oldgod", "evacuate");
    act({ type: "borderSupply", route: "rail" });
  } else if (path === "local") {
    decision("maintenance-voice", "accept");
    act({ type: "network", work: grid().id, operation: "repair" });
    resolve("oldgod", "evacuate");
    act({ type: "borderSupply", route: "jianghu" });
  } else {
    act({ type: "appoint", office: "gov-south", person: "yunsong" });
    act({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    resolve("oldgod", "evacuate");
    act({ type: "borderSupply", route: "jianghu" });
  }
  end();
  return {
    game: g,
    opening,
    trace,
    snapshots,
    settlements,
    checks: trialChecks(g),
  };
}
