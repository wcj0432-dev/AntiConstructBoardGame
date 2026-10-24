import {
  campaignDriver,
  type Driver,
  type CampaignConfig,
} from "./campaignDriver";
import { milestones } from "../src/v2/engine";
import { runV7Campaign } from "./v7-campaigns";
const branch = (c: Driver) =>
  c.action({ type: "strategyBranch", branch: c.config.branch });
const goal = (c: Driver) =>
  c.action({ type: "selectGoal", goal: c.config.goal });
function seal(c: Driver, kind = "accident") {
  const m = c.game.machine.matters.find((x) => x.kind === kind)!;
  if (!m) throw Error(`Missing ${kind}`);
  if (!c.attempt({ type: "resolve", matter: m.id, option: "seal" })) {
    c.action({
      type: "authorize",
      matter: m.id,
      lead: "anomaly",
      joint: kind === "oldgod",
      emergency: false,
    });
    c.resolve(kind, "seal");
  }
}
function contain(c: Driver) {
  if (c.game.machine.matters.some((x) => x.kind === "oldgod"))
    c.resolve("oldgod", "contain");
}
function foundations(c: Driver) {
  c.resolve("warning", "observe");
  c.resolve("gazette", "rights");
  c.action({ type: "policy", issue: "method", side: 1 });
  for (const province of ["south", "north"] as const)
    c.action({ type: "reconcile", province });
  c.end();
  goal(c);
  branch(c);
  seal(c);
  c.action({ type: "budget", department: "defense", level: 0 });
}
function engineering(c: Driver) {
  c.resolve("warning", "public-check");
  c.action({ type: "investigate", deck: "ley" });
  c.action({ type: "personSkill", person: "lin", province: "industry" });
  c.action({
    type: "project",
    project: "energy",
    province: "south",
    worker: "mo",
    assignment: "dedicated",
  });
  c.action({ type: "audit", province: "industry", lead: "gov-industry" });
  c.end();
  goal(c);
  if (c.config.goal === "traffic")
    c.action({ type: "audit", province: "north", lead: "gov-north" });
}
function finish(c: Driver) {
  while (c.game.core.turn < 12) {
    c.mediate();
    if (c.game.core.paralysis) c.attempt({ type: "unblock" });
    c.fund();
    const god = c.game.machine.matters.find((x) => x.kind === "oldgod");
    if (god && god.containment === 0)
      c.attempt({ type: "resolve", matter: god.id, option: "contain" });
    c.upkeep();
    if (c.game.core.turn === 10 || c.game.core.turn === 11)
      c.attempt({ type: "inspect" });
    c.end();
  }
  c.mediate();
  if (c.game.core.paralysis) c.attempt({ type: "unblock" });
  c.upkeep();
  if (
    !c.game.machine.terminalInspected ||
    milestones(c.game).some((x) => !x.met)
  )
    throw Error(`Not ready at final ${c.context()}`);
  c.resolve("final", "activate");
  c.end();
  return {
    game: c.game,
    opening: c.opening,
    trace: c.trace,
    settlements: c.settlements,
    reloads: c.reloads,
    checks: milestones(c.game),
  };
}
function night(c: Driver) {
  if (c.config.branch === "central") {
    c.action({ type: "regime", regime: "vertical" });
    c.resolve("warning", "observe");
    for (const province of ["industry", "south", "north"] as const)
      c.action({ type: "project", project: "warning", province });
    c.end();
    goal(c);
    branch(c);
    seal(c);
    c.action({ type: "department", department: "anomaly" });
    c.action({ type: "policy", issue: "disclosure", side: 0 });
    c.action({ type: "budget", department: "defense", level: 0 });
    c.end();
    const dispute = c.game.machine.matters.find((x) => x.kind === "distrust")!;
    c.action({
      type: "authorize",
      matter: dispute.id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    c.resolve("distrust", "rights");
    c.end();
    seal(c, "oldgod");
  } else {
    c.resolve("warning", "observe");
    for (const province of ["industry", "south", "north"] as const)
      c.action({ type: "project", project: "warning", province });
    c.action({ type: "policy", issue: "method", side: 1 });
    c.end();
    goal(c);
    branch(c);
    seal(c);
    c.action({ type: "budget", department: "defense", level: 0 });
    c.action({ type: "department", department: "evacuation" });
    c.end();
    c.resolve("distrust", "rights");
    c.action({ type: "regime", regime: "joint" });
    c.action({ type: "appoint", office: "gov-south", person: null });
    c.action({ type: "appoint", office: "gov-north", person: "xing" });
    c.action({ type: "investigate", deck: "archive" });
    c.end();
    const dream = c.game.machine.matters.find(
      (x) => x.kind === "gazette" && x.variant === "dream",
    )!;
    c.action({ type: "resolve", matter: dream.id, option: "permit" });
    c.action({ type: "appoint", office: "gov-south", person: "ye" });
    c.action({ type: "policy", issue: "disclosure", side: 1 });
    c.resolve("oldgod", "joint");
  }
}
function accord(c: Driver) {
  foundations(c);
  c.action({ type: "department", department: "evacuation" });
  c.end();
  c.resolve("distrust", "rights");
  if (c.config.branch === "central") {
    c.action({ type: "investigate", deck: "standards" });
    const flying = c.game.machine.matters.find(
      (x) => x.kind === "gazette" && x.variant === "flying",
    )!;
    c.action({ type: "resolve", matter: flying.id, option: "standard" });
    c.action({ type: "department", department: "anomaly" });
    c.end();
    seal(c, "oldgod");
  } else {
    c.action({ type: "fiscalAgreement", province: "south" });
    c.end();
    c.action({ type: "fiscalAgreement", province: "industry" });
    seal(c, "oldgod");
    c.end();
    c.action({ type: "fiscalAgreement", province: "north" });
  }
}
function spark(c: Driver) {
  if (c.config.branch === "central") {
    c.resolve("warning", "public-check");
    c.resolve("gazette", "standard");
    c.action({ type: "investigate", deck: "ley" });
    c.action({ type: "appoint", office: "gov-south", person: "mo" });
    c.action({ type: "project", project: "energy", province: "south" });
    c.end();
    goal(c);
    branch(c);
    c.action({ type: "department", department: "transport" });
    c.action({ type: "budget", department: "defense", level: 0 });
    c.end();
    c.resolve("accident", "contain");
    c.end();
    c.resolve("oldgod", "evacuate");
    c.end();
    const a = c.game.machine.matters.find((x) => x.kind === "accident")!;
    c.action({
      type: "authorize",
      matter: a.id,
      lead: "gov-south",
      joint: true,
      emergency: false,
    });
    c.resolve("accident", "seal");
    c.end();
    const d = c.game.machine.matters.find((x) => x.kind === "distrust")!;
    c.action({
      type: "authorize",
      matter: d.id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    c.resolve("distrust", "rights");
  } else {
    c.resolve("warning", "observe");
    c.resolve("gazette", "rights");
    c.action({ type: "policy", issue: "method", side: 1 });
    c.action({ type: "reconcile", province: "south" });
    c.action({ type: "investigate", deck: "ley" });
    c.end();
    goal(c);
    branch(c);
    seal(c);
    c.action({ type: "budget", department: "defense", level: 0 });
    c.action({ type: "personSkill", person: "lin", province: "industry" });
    c.end();
    c.resolve("distrust", "rights");
    c.action({ type: "fiscalAgreement", province: "south" });
    c.action({
      type: "project",
      project: "energy",
      province: "south",
      worker: "mo",
      assignment: "dedicated",
      funding: "local",
    });
    c.action({ type: "department", department: "transport" });
    c.end();
    seal(c, "oldgod");
    c.end();
    c.action({ type: "appoint", office: "gov-south", person: "mo" });
  }
}
function traffic(c: Driver) {
  engineering(c);
  branch(c);
  c.action({ type: "department", department: "transport" });
  c.action({ type: "policy", issue: "method", side: 1 });
  c.action({ type: "coordinate", province: "south", kind: "agreement" });
  c.end();
  seal(c);
  c.action({ type: "personSkill", person: "xing", province: "south" });
  c.action({ type: "budget", department: "defense", level: 0 });
  c.action({ type: "personSkill", person: "zhou", province: "industry" });
  c.end();
  seal(c, "oldgod");
  c.resolve("distrust", "rights");
  c.action({
    type: "project",
    project: "grid",
    province: "south",
    to: "industry",
    worker: "linruoxu",
    assignment: "dedicated",
    funding: "central",
  });
  c.action({ type: "survey", province: "south", field: "routes" });
  c.end();
  contain(c);
  c.action({ type: "fiscalAgreement", province: "south" });
  c.action({
    type: "project",
    project: "port",
    province: "south",
    worker: "luchaosheng",
    assignment: "dedicated",
    funding: "local",
  });
  c.end();
  contain(c);
  c.action({
    type: "fiscalTransfer",
    province: "south",
    direction: "grant",
    amount: 2,
  });
  c.end();
  contain(c);
  c.action({ type: "reconcile", province: "industry" });
  c.action({ type: "fiscalAgreement", province: "industry" });
  c.end();
  c.action({
    type: "fiscalTransfer",
    province: "industry",
    direction: "levy",
    amount: 5,
  });
  contain(c);
  c.action({
    type: "project",
    project: "rail",
    province: "south",
    to: "industry",
    partner: "industry",
    worker: "guhe",
    assignment: "dedicated",
    funding: c.config.branch === "central" ? "central" : "multi",
  });
  c.end();
  c.fund();
  contain(c);
  c.action({ type: "appoint", office: "anomaly", person: "linruoxu" });
  c.action({
    type: "network",
    work: c.game.machine.works.find((w) => w.type === "grid")!.id,
    operation: "repair",
  });
  c.action({ type: "appoint", office: "gov-south", person: "luchaosheng" });
  c.end();
  c.fund();
  contain(c);
  c.action({
    type: "fiscalTransfer",
    province: "south",
    direction: "grant",
    amount: 4,
  });
  c.upkeep();
  c.attempt({ type: "inspect" });
  c.end();
}
function learning(c: Driver) {
  engineering(c);
  c.action({ type: "policy", issue: "method", side: 1 });
  c.action({ type: "coordinate", province: "south", kind: "agreement" });
  c.action({ type: "budget", department: "defense", level: 0 });
  c.action({ type: "reconcile", province: "industry" });
  c.action({ type: "reconcile", province: "north" });
  c.end();
  seal(c);
  c.action({ type: "reconcile", province: "south" });
  c.action({ type: "fiscalAgreement", province: "north" });
  c.end();
  seal(c, "oldgod");
  c.action({
    type: "project",
    project: "grid",
    province: "south",
    to: "industry",
    worker: "linruoxu",
    assignment: "dedicated",
    funding: "central",
  });
  c.action({ type: "fiscalAgreement", province: "south" });
  c.end();
  if (c.config.branch === "plural") branch(c);
  c.action({ type: "fiscalAgreement", province: "industry" });
  c.resolve("distrust", "rights");
  c.action({
    type: "project",
    project: "academy",
    province: "south",
    worker: "xuzhao",
    assignment: "dedicated",
    funding: "local",
  });
  c.end();
  c.action({
    type: "fiscalTransfer",
    province: "north",
    direction: "levy",
    amount: 5,
  });
  c.action({
    type: "project",
    project: "academy",
    province: "industry",
    worker: "taoqi",
    assignment: "dedicated",
    funding: "local",
  });
  c.action({ type: "appoint", office: "gov-south", person: "mo" });
  c.action({
    type: "train",
    mentor: "mo",
    student: "yunsong",
    cap: "leywork",
    province: "south",
    method: c.config.branch === "plural" ? "field" : "academy",
    facility:
      c.config.branch === "central"
        ? c.game.machine.works.find(
            (w) => w.type === "academy" && w.province === "south",
          )!.id
        : undefined,
  });
  c.end();
  c.action({
    type: "fiscalTransfer",
    province: "north",
    direction: "levy",
    amount: 5,
  });
  c.action({ type: "appoint", office: "gov-industry", person: "taoqi" });
  c.action({ type: "policy", issue: "disclosure", side: 1 });
  c.end();
  c.action({
    type: "fiscalTransfer",
    province: "south",
    direction: "grant",
    amount: 5,
  });
  c.action({
    type: "train",
    mentor: "taoqi",
    student: "zhou",
    cap: "mobilize",
    province: "industry",
    method: "academy",
    facility: c.game.machine.works.find(
      (w) => w.type === "academy" && w.province === "industry",
    )!.id,
  });
  c.end();
  c.action({
    type: "fiscalTransfer",
    province: "industry",
    direction: "grant",
    amount: 5,
  });
  if (c.config.branch === "central")
    c.action({ type: "appoint", office: "gov-south", person: "yunsong" });
  c.end();
  if (c.config.branch === "plural")
    c.action({ type: "appoint", office: "gov-south", person: "yunsong" });
  else {
    branch(c);
    for (const w of c.game.machine.works.filter((w) => w.type === "academy"))
      c.action({ type: "maintenanceSponsor", work: w.id, account: "central" });
  }
  c.action({
    type: "network",
    work: c.game.machine.works.find((w) => w.type === "grid")!.id,
    operation: "repair",
  });
  c.end();
  c.action({ type: "appoint", office: "gov-industry", person: "zhou" });
  c.action({ type: "inspect" });
}
function prosperity(c: Driver) {
  engineering(c);
  branch(c);
  c.action({ type: "policy", issue: "method", side: 1 });
  c.action({
    type: "coordinate",
    province: "south",
    kind: c.config.branch === "central" ? "prepare" : "agreement",
    regime: c.config.branch === "central" ? "vertical" : undefined,
  });
  c.action({ type: "budget", department: "defense", level: 0 });
  c.end();
  if (c.config.branch === "central")
    c.action({ type: "regime", regime: "vertical" });
  seal(c);
  c.action({ type: "personSkill", person: "xing", province: "south" });
  c.action({ type: "personSkill", person: "zhou", province: "industry" });
  c.end();
  seal(c, "oldgod");
  if (c.config.branch === "central") {
    const d = c.game.machine.matters.find((x) => x.kind === "distrust")!;
    c.action({
      type: "authorize",
      matter: d.id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
  }
  c.resolve("distrust", "rights");
  c.action({ type: "reconcile", province: "industry" });
  c.action({
    type: "project",
    project: "grid",
    province: "south",
    to: "industry",
    worker: "linruoxu",
    assignment: "dedicated",
  });
  c.end();
  contain(c);
  c.action({ type: "fiscalAgreement", province: "industry" });
  c.action({
    type: "project",
    project: "cooperative",
    province: "industry",
    worker: "taoqi",
    assignment: "dedicated",
    funding: "local",
  });
  c.end();
  contain(c);
  if (c.config.branch === "plural")
    c.action({ type: "fiscalAgreement", province: "south" });
  c.action({ type: "reconcile", province: "north" });
  c.end();
  contain(c);
  c.action({ type: "fiscalAgreement", province: "north" });
  c.end();
  c.fund();
  contain(c);
  if (c.config.branch === "central")
    c.action({ type: "fiscalReform", system: "central" });
  c.action({ type: "appoint", office: "gov-south", person: "mo" });
  if (c.config.branch === "plural")
    c.action({
      type: "network",
      work: c.game.machine.works.find((w) => w.type === "grid")!.id,
      operation: "repair",
    });
  c.end();
  if (c.config.branch === "central") {
    c.comfortableLocals();
    c.action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 5,
    });
    c.end();
    c.action({
      type: "network",
      work: c.game.machine.works.find((w) => w.type === "grid")!.id,
      operation: "repair",
    });
  }
}
export function runStrategyCampaign(config: CampaignConfig) {
  if (config.goal === "codex" || config.goal === "comms")
    return runV7Campaign(config.goal, config.branch, config.seed, config);
  const c = campaignDriver(config);
  if (config.goal === "night") night(c);
  else if (config.goal === "accord") accord(c);
  else if (config.goal === "spark") spark(c);
  else if (config.goal === "traffic") traffic(c);
  else if (config.goal === "learning") learning(c);
  else prosperity(c);
  return finish(c);
}
