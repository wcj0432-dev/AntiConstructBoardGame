import { describe, expect, it } from "vitest";
import {
  deserializeV2,
  executeCommand,
  milestones,
  newV2,
  previewAction,
  serializeV2,
  startCampaign,
} from "./engine";
import type { Action, Goal, V2Game } from "./model";
import { runStrategyCampaign } from "../../scripts/strategyCampaigns";
import { runStoryCampaign } from "../../scripts/storyCampaign";
import { storyFacts } from "./contractStory";
import { politicalStories } from "./politicalStories";
const goals: Goal[] = [
  "spark",
  "accord",
  "night",
  "traffic",
  "learning",
  "prosperity",
  "codex",
  "comms",
];
function run(g: V2Game, a: Action) {
  const r = executeCommand(g, a);
  expect(r.result.errors, JSON.stringify(a)).toEqual([]);
  return r.game;
}
function opening() {
  return startCampaign({
    mode: "experimental",
    difficulty: "standard",
    politics: "random",
    seed: "v08-story-496",
  });
}
function beforeChapter(chapter: "teaching" | "tax") {
  const r = runStoryCampaign();
  let g = opening();
  for (const t of r.trace) {
    if (t.action.type === "storyDecision" && t.action.chapter === chapter)
      break;
    g = run(g, t.action);
  }
  return { g, work: r.work };
}
describe("v0.8 标准资源十六分支见证", () => {
  for (const goal of goals)
    for (const branch of ["central", "plural"] as const)
      it(`${goal} / ${branch} 从实际开局到第12回合结算`, () => {
        const r = runStrategyCampaign({
          goal,
          branch,
          seed: `v08-${goal}-${branch}`,
          difficulty: "standard",
          politics: "classic",
        });
        expect(r.opening.core.treasury).toBe(12);
        expect(r.opening.core.commands).toBe(5);
        expect(r.opening.machine.fiscal!.locals).toEqual({
          industry: 6,
          south: 6,
          north: 6,
        });
        expect(r.opening.machine.fiscal!.cultTreasury).toBe(5);
        expect(r.trace.filter((t) => t.action.type === "end")).toHaveLength(12);
        expect(r.settlements).toHaveLength(12);
        expect(
          typeof r.reloads === "number" ? r.reloads : r.reloads.length,
        ).toBe(12);
        expect(r.game.core.status).toBe("won");
        expect(r.game.core.turn).toBe(12);
        expect(r.game.machine.finalDone).toBe(true);
        expect(r.game.machine.terminalInspected).toBe(true);
        expect(r.game.machine.strategy!.branch).toBe(branch);
        expect(r.checks.every((c) => c.met)).toBe(true);
        expect(r.trace.every((t) => t.cash >= 0 && t.commands >= 0)).toBe(true);
        expect(serializeV2(deserializeV2(serializeV2(r.game)))).toBe(
          serializeV2(r.game),
        );
      });
});
describe("v0.8 真实三章政治故事", () => {
  for (const charter of ["central", "local"] as const)
    for (const method of ["academy", "field"] as const)
      for (const tax of ["central", "autonomy"] as const)
        it(`${charter}/${method}/${tax} 正常资源跨回合履约`, () => {
          const r = runStoryCampaign(charter, method, tax),
            g = r.game,
            f = storyFacts(g, r.work);
          expect(r.opening.core.treasury).toBe(12);
          expect(r.opening.machine.trainings).toHaveLength(0);
          expect(f.complete).toBe(true);
          expect(f.decisions).toHaveLength(3);
          expect(f.course!.state).toBe("completed");
          expect(f.course!.duration).toBe(method === "academy" ? 2 : 3);
          expect(g.machine.fiscal!.taxSystem).toBe(tax);
          expect(f.w!.maintenanceSponsor).toBe(
            charter === "central" ? "central" : "south",
          );
          expect(f.w!.contract!.owner).toBe("south");
          expect(f.decisions[1].turn).toBeGreaterThan(f.decisions[0].turn);
          expect(f.decisions[2].turn).toBeGreaterThan(f.decisions[1].turn);
          for (const d of f.decisions) {
            const h = g.machine.history.find((h) => h.id === d.source)!;
            if (d.operation) expect(h.parents).toContain(d.operation);
          }
          expect(serializeV2(deserializeV2(serializeV2(g)))).toBe(
            serializeV2(g),
          );
        });
  it("预览无副作用；章节执行仅扣一次原操作费用且不重复课程", () => {
    const { g, work } = beforeChapter("teaching");
    const a: Action = {
      type: "storyDecision",
      work,
      chapter: "teaching",
      choice: "academy",
      mentor: "mo",
      student: "yunsong",
      cap: "leywork",
      facility: work,
    };
    const before = serializeV2(g),
      v = previewAction(g, a);
    previewAction(g, a);
    expect(serializeV2(g)).toBe(before);
    const request = { id: "chapter-request", revision: g.machine.revision },
      r = executeCommand(g, a, request);
    expect(r.result.errors).toEqual([]);
    expect(r.game.core.commands).toBe(g.core.commands - v.costs.commands);
    expect(r.game.core.treasury).toBe(g.core.treasury - v.costs.treasury);
    expect(r.game.machine.trainings).toHaveLength(1);
    expect(r.game.machine.trainings![0].progress).toBe(0);
    expect(executeCommand(r.game, a, request).game).toBe(r.game);
    expect(executeCommand(r.game, a).result.status).toBe("failed");
  });
  it("不能跳章、重复签字、同回合连签；失败不扣资源", () => {
    let g = opening();
    const work = g.machine.works.find((w) => w.type === "academy")!.id;
    const skipped = executeCommand(g, {
      type: "storyDecision",
      work,
      chapter: "tax",
      choice: "central",
    });
    expect(skipped.result.status).toBe("failed");
    expect(skipped.game).toBe(g);
    g = run(g, {
      type: "storyDecision",
      work,
      chapter: "charter",
      choice: "central",
    });
    expect(
      previewAction(g, {
        type: "storyDecision",
        work,
        chapter: "teaching",
        choice: "field",
        mentor: "mo",
        student: "yunsong",
        cap: "leywork",
      }).errors.join(),
    ).toContain("跨回合");
  });
  it("维护接管不会抹债；改换承担方会阻止后续章节", () => {
    const { g, work } = beforeChapter("teaching");
    // Isolated invalidation fixtures: debt and later policy changes, not balance evidence.
    g.machine.works.find((w) => w.id === work)!.maintenanceSponsor = "south";
    const a: Action = {
      type: "storyDecision",
      work,
      chapter: "teaching",
      choice: "field",
      mentor: "mo",
      student: "yunsong",
      cap: "leywork",
    };
    expect(executeCommand(g, a).game).toBe(g);
    expect(previewAction(g, a).errors.join()).toContain("先前约定");
  });
  it("未毕业不可讨论税制，失去导师岗位则真实暂停", () => {
    const { g, work } = beforeChapter("teaching");
    let n = run(g, {
      type: "storyDecision",
      work,
      chapter: "teaching",
      choice: "academy",
      mentor: "mo",
      student: "yunsong",
      cap: "leywork",
      facility: work,
    });
    expect(
      previewAction(n, {
        type: "storyDecision",
        work,
        chapter: "tax",
        choice: "central",
      }).errors.join(),
    ).toContain("实际毕业");
    n = run(n, { type: "appoint", office: "gov-south", person: "zhou" });
    n = run(n, { type: "end" });
    expect(n.machine.trainings![0].state).toBe("paused");
    expect(n.machine.trainings![0].progress).toBe(0);
  });
  it("已采用的税制可明确确认，不重复扣改革费用；不能绕过战略分支", () => {
    const { g, work } = beforeChapter("tax");
    const v = previewAction(g, {
      type: "storyDecision",
      work,
      chapter: "tax",
      choice: "autonomy",
    });
    expect(v.costs.commands).toBe(0);
    expect(v.costs.treasury).toBe(0);
    expect(v.costs.capital).toBe(0);
    g.machine.goal = "prosperity";
    g.machine.strategy!.branch = "central";
    expect(
      previewAction(g, {
        type: "storyDecision",
        work,
        chapter: "tax",
        choice: "autonomy",
      }).errors.join(),
    ).toContain("财政战略");
  });
  it("故事完成后税制变化会显示承诺失效；不会永久授予条件", () => {
    const r = runStoryCampaign();
    r.game.machine.fiscal!.taxSystem = "split";
    expect(storyFacts(r.game, r.work).complete).toBe(false);
    expect(storyFacts(r.game, r.work).issues.join()).toContain("后来改革");
  });
});
describe("v0.8 规则事实与存档自查", () => {
  it("铁路专家按真实端点判定，不强制北境岗位；无端点专家仍失败", () => {
    const r = runStrategyCampaign({
        goal: "traffic",
        branch: "plural",
        seed: "v08-traffic-plural",
        difficulty: "standard",
        politics: "classic",
      }),
      g = r.game;
    expect(milestones(g).find((c) => c.label.startsWith("战略分支"))!.met).toBe(
      true,
    );
    // Province-specific negative fixture keeps the unrelated northern specialist in office.
    g.core.appointments["gov-south"] = "zhou";
    g.machine.trust.north = 3;
    expect(milestones(g).find((c) => c.label.startsWith("战略分支"))!.met).toBe(
      false,
    );
  });
  it("人物增加信任始终封顶3，操作后可正常存读", () => {
    const g = newV2("experimental", "spark", "trust-boundary");
    g.machine.trust.south = 3;
    const n = run(g, {
      type: "personSkill",
      person: "xing",
      province: "south",
    });
    expect(n.machine.trust.south).toBe(3);
    expect(deserializeV2(serializeV2(n)).machine.trust.south).toBe(3);
  });
  it("毕业生担任无关岗位，秘书不虚报专业继任", () => {
    const { game: g } = runStoryCampaign();
    g.core.appointments.defense = "yunsong";
    expect(
      politicalStories(g).find((s) => s.id === "academy-succession")!.phase,
    ).toBe("毕业以后，岗位以前");
    g.core.appointments["gov-south"] = "yunsong";
    expect(
      politicalStories(g).find((s) => s.id === "academy-succession")!.phase,
    ).toBe("学员已经走上岗位");
  });
  it("0.7存档增量迁移，不追认章节、不改变资金合同和随机数", () => {
    const g = opening(),
      raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.7.0";
    delete raw.machine.storylines;
    const n = deserializeV2(JSON.stringify(raw));
    expect(n.machine.rulesVersion).toBe("0.8.5");
    expect(n.machine.storylines).toEqual([]);
    expect(n.core).toEqual(g.core);
    expect(n.machine.works).toEqual(g.machine.works);
    expect(n.machine.fiscal).toEqual(g.machine.fiscal);
  });
  it("当前档缺少故事、伪造来源、跳章、课程串省或重复记录均拒绝，原字符串保留", () => {
    const r = runStoryCampaign();
    for (const mutate of [
      (x: V2Game) => {
        delete x.machine.storylines;
      },
      (x: V2Game) => {
        x.machine.storylines![0].decisions[0].source = "fake";
      },
      (x: V2Game) => {
        x.machine.storylines![0].decisions[1].turn = 1;
      },
      (x: V2Game) => {
        x.machine.trainings![0].province = "north";
      },
      (x: V2Game) => {
        x.machine.storylines!.push(x.machine.storylines![0]);
      },
    ]) {
      const n = structuredClone(r.game);
      mutate(n);
      const raw = serializeV2(n);
      expect(() => deserializeV2(raw)).toThrow();
      expect(serializeV2(n)).toBe(raw);
    }
  });
});
