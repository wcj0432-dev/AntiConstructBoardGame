import {
  startCampaign,
  executeCommand,
  serializeV2,
  deserializeV2,
  milestones,
  previewAction,
  finance,
} from "../src/v2/engine";
import type { Action, Goal } from "../src/v2/model";
import type { ProvinceId } from "../src/types";
export function runV7Campaign(
  goal: "codex" | "comms",
  branch: "central" | "plural",
  seed = `v07-${goal}-${branch}`,
) {
  let g = startCampaign({
    mode: "experimental",
    seed,
    difficulty: "standard",
    politics: "classic",
  });
  const opening = serializeV2(g),
    transcript: {
      turn: number;
      action: Action;
      cash: number;
      local: Record<ProvinceId, number>;
    }[] = [];
  const action = (a: Action) => {
    const turn = g.core.turn,
      r = executeCommand(g, a);
    if (r.result.status === "failed")
      throw new Error(
        `T${turn} ${JSON.stringify(a)} ${r.result.errors.join(";")} cash${g.core.treasury}`,
      );
    g = r.game;
    transcript.push({
      turn,
      action: a,
      cash: g.core.treasury,
      local: { ...g.machine.fiscal!.locals },
    });
  };
  const resolve = (kind: string, option: string) => {
    const m = g.machine.matters.find((x) => x.kind === kind);
    if (!m) throw Error(`缺少真实事务${kind}`);
    action({ type: "resolve", matter: m.id, option });
  };
  const attempt = (a: Action) => {
    if (previewAction(g, a).errors.length) return false;
    action(a);
    return true;
  };
  resolve("warning", "observe");
  resolve("gazette", "rights");
  action({ type: "policy", issue: "method", side: 1 });
  for (const province of ["south", "north"] as const)
    action({ type: "reconcile", province });
  g = deserializeV2(serializeV2(g));
  action({ type: "end" });
  action({ type: "selectGoal", goal: goal as Goal });
  action({ type: "strategyBranch", branch });
  const acc = g.machine.matters.find((x) => x.kind === "accident")!;
  action({
    type: "authorize",
    matter: acc.id,
    lead: "anomaly",
    joint: false,
    emergency: false,
  });
  resolve("accident", "seal");
  attempt({ type: "budget", department: "defense", level: 0 });
  const pids: ProvinceId[] = ["industry", "south", "north"];
  let reloads = 1;
  while (g.core.status === "playing") {
    const turn = g.core.turn;
    if (turn >= 3) {
      if (g.core.paralysis) attempt({ type: "unblock" });
      for (const m of g.machine.matters.filter((x) => x.kind === "distrust")) {
        const a: Action = { type: "resolve", matter: m.id, option: "rights" };
        if (previewAction(g, a).errors.length)
          attempt({
            type: "authorize",
            matter: m.id,
            lead: `gov-${m.province}`,
            joint: false,
            emergency: false,
          });
        attempt(a);
      }
      if (g.core.treasury < 9 || finance(g).default)
        for (const province of ["north", "industry", "south"] as const)
          if (
            g.machine.fiscal!.agreements.includes(province) &&
            g.machine.fiscal!.locals[province] >= 3 &&
            attempt({
              type: "fiscalTransfer",
              province,
              direction: "levy",
              amount: Math.min(5, g.machine.fiscal!.locals[province]),
            })
          )
            break;
      for (const pid of ["south", "industry", "north"] as const) {
        if (g.machine.trust[pid] < 2 || !g.machine.rights[pid])
          attempt({ type: "reconcile", province: pid });
        if (!g.machine.fiscal!.agreements.includes(pid))
          attempt({ type: "fiscalAgreement", province: pid });
      }
      const oldgod = g.machine.matters.find((x) => x.kind === "oldgod");
      if (oldgod) {
        const a: Action = {
          type: "resolve",
          matter: oldgod.id,
          option: "seal",
        };
        if (previewAction(g, a).errors.length)
          attempt({
            type: "authorize",
            matter: oldgod.id,
            lead: "anomaly",
            joint: false,
            emergency: false,
          });
        if (!attempt(a))
          attempt({ type: "resolve", matter: oldgod.id, option: "contain" });
      }
      if (g.core.treasury < 7 || finance(g).default)
        for (const province of ["north", "industry", "south"] as const)
          if (
            g.machine.fiscal!.agreements.includes(province) &&
            g.machine.fiscal!.locals[province] >= 3 &&
            attempt({
              type: "fiscalTransfer",
              province,
              direction: "levy",
              amount: Math.min(5, g.machine.fiscal!.locals[province]),
            })
          )
            break;
      if (goal === "codex") {
        if (branch === "central") {
          if (g.machine.regime !== "vertical" && !g.machine.pending)
            attempt({ type: "regime", regime: "vertical" });
          if (
            !g.machine.departments.anomaly.length &&
            !g.machine.departmentPending
          )
            attempt({ type: "department", department: "anomaly" });
        }
        for (const province of pids) {
          const works = g.machine.works.filter(
            (w) => w.province === province && w.completed,
          );
          if (
            !g.machine.works.some(
              (w) => w.province === province && w.type === "warning",
            )
          )
            attempt({ type: "project", project: "warning", province });
          if (
            works.length &&
            !g.machine.strategy!.legalRecords.some(
              (r) => r.province === province,
            )
          )
            attempt({ type: "lawRegister", province, work: works[0].id });
        }
      } else {
        for (const province of pids)
          if (
            !g.machine.works.some(
              (w) => w.type === "relay" && w.province === province,
            )
          )
            attempt({
              type: "project",
              project: "relay",
              province,
              worker: g.core.appointments[`gov-${province}`] ?? "",
              funding: branch === "central" ? "central" : "local",
            });
        for (const matter of g.machine.matters.filter(
          (x) => x.kind !== "final",
        ))
          attempt({ type: "dispatch", matter: matter.id });
      }
      for (const w of g.machine.works.filter(
        (w) => (w.maintenance?.arrears ?? 0) > 0,
      ))
        attempt({ type: "maintain", work: w.id });
      if (turn === 10 || turn === 11) attempt({ type: "inspect" });
      if (turn === 12) {
        const final = g.machine.matters.find((x) => x.kind === "final");
        if (final)
          action({ type: "resolve", matter: final.id, option: "activate" });
      }
    }
    const restored = deserializeV2(serializeV2(g));
    if (serializeV2(restored) !== serializeV2(g))
      throw Error("战役存档往返不一致");
    g = restored;
    reloads++;
    action({ type: "end" });
  }
  return {
    game: g,
    opening: JSON.parse(opening),
    transcript,
    reloads,
    checks: milestones(g),
  };
}
