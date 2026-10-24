import {
  startCampaign,
  executeCommand,
  previewAction,
  serializeV2,
  deserializeV2,
  finance,
  milestones,
} from "../src/v2/engine";
import type { Action, Difficulty, Goal } from "../src/v2/model";
export interface CampaignConfig {
  goal: Goal;
  branch: "central" | "plural";
  seed: string;
  difficulty: Difficulty;
  politics: "classic" | "random";
}
export function campaignDriver(config: CampaignConfig) {
  let g = startCampaign({
    mode: "experimental",
    seed: config.seed,
    difficulty: config.difficulty,
    politics: config.politics,
  });
  const opening = structuredClone(g),
    trace: {
      turn: number;
      action: Action;
      cash: number;
      commands: number;
      crisis: number;
      paralysis: number;
      local: Record<string, number>;
    }[] = [],
    settlements: ReturnType<typeof finance>[] = [],
    reloads: number[] = [];
  const context = () =>
    JSON.stringify({
      turn: g.core.turn,
      status: g.core.status,
      cash: g.core.treasury,
      commands: g.core.commands,
      crisis: g.core.crisis,
      local: g.machine.fiscal!.locals,
      checks: milestones(g).filter((c) => !c.met),
      works: g.machine.works.map((w) => ({
        type: w.type,
        id: w.id,
        progress: w.progress,
        completed: w.completed,
        maintenance: w.maintenance,
        network: w.network,
      })),
      roles: g.core.appointments,
      occupied: g.machine.occupied,
    });
  const action = (a: Action) => {
    const turn = g.core.turn,
      r = executeCommand(g, a);
    if (r.result.status === "failed")
      throw Error(
        `${JSON.stringify(a)} ${r.result.errors.join(";")} ${context()}`,
      );
    g = r.game;
    trace.push({
      turn,
      action: a,
      cash: g.core.treasury,
      commands: g.core.commands,
      crisis: g.core.crisis,
      paralysis: g.core.paralysis,
      local: { ...g.machine.fiscal!.locals },
    });
    if (g.core.status === "lost") throw Error(`Campaign lost ${context()}`);
  };
  const attempt = (a: Action) => {
    if (previewAction(g, a).errors.length) return false;
    action(a);
    return true;
  };
  const resolve = (kind: string, option: string) => {
    const m = g.machine.matters.find((m) => m.kind === kind);
    if (!m) throw Error(`Missing ${kind} ${context()}`);
    action({ type: "resolve", matter: m.id, option });
  };
  const end = () => {
    settlements.push(finance(g));
    const before = serializeV2(g),
      n = deserializeV2(before);
    if (serializeV2(n) !== before) throw Error("Save/load changed live state");
    g = n;
    reloads.push(g.core.turn);
    action({ type: "end" });
  };
  const fund = (floor = 8) => {
    if (g.core.treasury >= floor && !finance(g).default) return;
    for (const province of ["north", "industry", "south"] as const) {
      const balance = g.machine.fiscal!.locals[province];
      if (
        balance >= 4 &&
        attempt({
          type: "fiscalTransfer",
          province,
          direction: "levy",
          amount: Math.min(5, balance),
        })
      )
        break;
    }
  };
  const upkeep = () => {
    for (const w of g.machine.works.filter(
      (w) => (w.maintenance?.arrears ?? 0) > 0,
    )) {
      if (!attempt({ type: "maintain", work: w.id })) {
        const owed = w.maintenance!.payments.find(
          (r) =>
            r.arrears > 0 && ["industry", "south", "north"].includes(r.account),
        );
        if (owed)
          attempt({
            type: "fiscalTransfer",
            province: owed.account as "south",
            direction: "grant",
            amount: Math.min(5, owed.arrears + 1),
          });
        attempt({ type: "maintain", work: w.id });
      }
    }
  };
  const comfortableLocals = () => {
    for (const province of ["industry", "south", "north"] as const)
      if (g.machine.fiscal!.locals[province] < 3)
        attempt({
          type: "fiscalTransfer",
          province,
          direction: "grant",
          amount: 5,
        });
  };
  const mediate = () => {
    for (const id of new Set(Object.values(g.core.appointments)))
      if (id && (g.core.grievances[id] ?? 0) >= 3)
        attempt({ type: "mediate", person: id });
  };
  return {
    get game() {
      return g;
    },
    config,
    opening,
    trace,
    settlements,
    reloads,
    action,
    attempt,
    resolve,
    end,
    fund,
    upkeep,
    comfortableLocals,
    mediate,
    context,
  };
}
export type Driver = ReturnType<typeof campaignDriver>;
