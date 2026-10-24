import { campaignDriver } from "./campaignDriver";
/** A real inherited local academy, standard resources, no injected facilities or graduates. */
export function runStoryCampaign(
  charter: "central" | "local" = "central",
  method: "academy" | "field" = "academy",
  tax: "central" | "autonomy" = "central",
) {
  const c = campaignDriver({
    goal: "spark",
    branch: "plural",
    seed: "v08-story-496",
    difficulty: "standard",
    politics: "random",
  });
  const work = c.game.machine.works.find(
    (w) => w.type === "academy" && w.province === "south",
  )!.id;
  c.action({
    type: "storyDecision",
    work,
    chapter: "charter",
    choice: charter,
  });
  c.resolve("warning", "observe");
  c.resolve("gazette", "rights");
  c.action({ type: "investigate", deck: "ley" });
  c.end();
  c.action({ type: "selectGoal", goal: "spark" });
  const accident = c.game.machine.matters.find((m) => m.kind === "accident")!;
  c.action({
    type: "authorize",
    matter: accident.id,
    lead: "anomaly",
    joint: false,
    emergency: false,
  });
  c.resolve("accident", "seal");
  c.action({ type: "reconcile", province: "south" });
  c.action({
    type: "storyDecision",
    work,
    chapter: "teaching",
    choice: method,
    mentor: "mo",
    student: "yunsong",
    cap: "leywork",
    facility: method === "academy" ? work : undefined,
  });
  c.end();
  const distrust = c.game.machine.matters.find((m) => m.kind === "distrust")!;
  c.action({
    type: "authorize",
    matter: distrust.id,
    lead: "plan",
    joint: false,
    emergency: false,
  });
  c.resolve("distrust", "rights");
  while (
    c.game.machine.trainings!.find((t) => t.student === "yunsong")!.state !==
    "completed"
  ) {
    if (c.game.core.turn > 6)
      throw Error(`Story did not graduate ${c.context()}`);
    c.fund();
    c.upkeep();
    c.end();
  }
  c.action({ type: "storyDecision", work, chapter: "tax", choice: tax });
  return { game: c.game, opening: c.opening, trace: c.trace, work };
}
