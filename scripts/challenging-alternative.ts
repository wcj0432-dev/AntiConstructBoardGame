import { campaignDriver } from "./campaignDriver";
import { finish } from "./strategyCampaigns";
/** Keep the old 80 witnesses intact; a genuinely different normal-resource policy for one failed sample. */
export function challengingSparkAlternative() {
  const c = campaignDriver({
    goal: "spark",
    branch: "central",
    seed: "v08-spark-central",
    difficulty: "challenging",
    politics: "classic",
  });
  c.resolve("warning", "public-check");
  c.resolve("gazette", "rights");
  c.action({ type: "investigate", deck: "ley" });
  c.action({ type: "appoint", office: "gov-south", person: "mo" });
  c.action({ type: "project", project: "energy", province: "south" });
  c.end();
  c.action({ type: "selectGoal", goal: "spark" });
  c.action({ type: "strategyBranch", branch: "central" });
  c.action({ type: "personSkill", person: "lin", province: "industry" });
  c.action({ type: "department", department: "transport" });
  c.action({ type: "budget", department: "defense", level: 0 });
  c.end();
  c.resolve("accident", "contain");
  c.end();
  c.resolve("oldgod", "evacuate");
  c.end();
  let m = c.game.machine.matters.find((m) => m.kind === "accident")!;
  c.action({
    type: "authorize",
    matter: m.id,
    lead: "gov-south",
    joint: true,
    emergency: false,
  });
  c.resolve("accident", "seal");
  c.end();
  m = c.game.machine.matters.find((m) => m.kind === "distrust")!;
  c.action({
    type: "authorize",
    matter: m.id,
    lead: "plan",
    joint: false,
    emergency: false,
  });
  c.resolve("distrust", "rights");
  return finish(c);
}
