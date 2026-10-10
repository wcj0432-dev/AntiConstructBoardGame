import { describe, expect, it } from "vitest";
import {
  deserializeV2,
  executeAction,
  executeCommand,
  matterProgress,
  newV2,
  previewAction,
  serializeV2,
  startCampaign,
} from "./engine";
import type { Action, V2Game } from "./model";
const go = (g: V2Game, a: Action) => executeAction(g, a);
const end = (g: V2Game) => go(g, { type: "end" });
function oldgod() {
  let g = newV2("national", "night", "联邦-v03-验收");
  g = end(g);
  g = end(g);
  g = end(g);
  g.core.appointments["gov-north"] = "xing";
  g.core.appointments["gov-south"] = "bai";
  return g;
}
describe("v0.3 原子事务与生命周期", () => {
  it("完全解决只扣费一次，移出队列并归档；同请求跨存档重放不扣费", () => {
    const g = newV2("campaign", "night", "联邦-v03-验收"),
      id = g.machine.matters[0].id,
      a: Action = { type: "resolve", matter: id, option: "repair" };
    const receipt = { id: "fixed-request", revision: 0 },
      out = executeCommand(g, a, receipt);
    expect(out.result.status).toBe("resolved");
    expect(out.game.core.commands).toBe(g.core.commands - 1);
    expect(out.game.machine.matters.some((x) => x.id === id)).toBe(false);
    expect(out.game.machine.archive.find((x) => x.id === id)?.lifecycle).toBe(
      "resolved",
    );
    const restored = deserializeV2(serializeV2(out.game));
    expect(executeCommand(restored, a, receipt).game).toBe(restored);
    expect(g.machine.matters).toHaveLength(1);
    expect(g.machine.archive).toHaveLength(0);
    const duplicate = executeCommand(restored, a, {
      id: "another-click",
      revision: 1,
    });
    expect(duplicate.result.status).toBe("failed");
    expect(duplicate.game).toBe(restored);
  });
  it("条件失败与过期预览返回原状态，不扣费，也不推进随机序列", () => {
    const g = newV2(),
      a: Action = {
        type: "resolve",
        matter: g.machine.matters[0].id,
        option: "public",
      };
    const before = serializeV2(g),
      fail = executeCommand(g, a);
    expect(fail.result.status).toBe("failed");
    expect(fail.result.errors.length).toBeGreaterThan(0);
    expect(serializeV2(g)).toBe(before);
    expect(fail.game).toBe(g);
    const newer = go(g, {
      type: "project",
      project: "warning",
      province: "south",
    });
    const stale = executeCommand(
      newer,
      { type: "end" },
      { id: "stale", revision: 0 },
    );
    expect(stale.result.errors.join()).toContain("局势已经变化");
    expect(stale.game).toBe(newer);
  });
  it("撤离是部分完成，仍需管理异常源；遏制到期后的下一次结算会恶化", () => {
    const g = oldgod(),
      it = g.machine.matters.find((x) => x.kind === "oldgod")!,
      out = executeCommand(g, {
        type: "resolve",
        matter: it.id,
        option: "evacuate",
      });
    expect(out.result.status).toBe("partial");
    expect(out.result.remaining.join()).toContain("异常源尚未封印");
    const n = deserializeV2(serializeV2(out.game)),
      saved = n.machine.matters.find((x) => x.id === it.id)!;
    expect(saved.evacuated).toBe(true);
    expect(saved.lifecycle).toBe("partial");
    expect(matterProgress(saved).completed.join()).toContain("居民");
    expect(
      executeCommand(n, { type: "resolve", matter: it.id, option: "evacuate" })
        .result.status,
    ).toBe("failed");
    const first = end(n);
    expect(first.machine.matters.find((x) => x.id === it.id)?.stage).toBe(
      it.stage,
    );
    const second = end(first);
    expect(second.machine.matters.find((x) => x.id === it.id)?.lifecycle).toBe(
      "deteriorated",
    );
  });
  it("临时遏制明确返回持续危机且不允许当回合重复支付", () => {
    const g = oldgod(),
      it = g.machine.matters.find((x) => x.kind === "oldgod")!,
      a: Action = { type: "resolve", matter: it.id, option: "contain" },
      out = executeCommand(g, a);
    expect(out.result.status).toBe("changed");
    expect(
      out.game.machine.matters.find((x) => x.id === it.id)?.containment,
    ).toBe(1);
    const again = executeCommand(out.game, a);
    expect(again.result.status).toBe("failed");
    expect(again.game).toBe(out.game);
  });
  it("原v0.2存档补全新元数据，不丢掉已有目标、项目与持续进度", () => {
    const g = newV2("national", "spark"),
      old = JSON.parse(serializeV2(g));
    for (const k of [
      "goalPending",
      "revision",
      "archive",
      "results",
      "rulesVersion",
      "difficulty",
    ])
      delete old.machine[k];
    const migrated = deserializeV2(JSON.stringify(old));
    expect(migrated.machine.goal).toBe("spark");
    expect(migrated.machine.goalPending).toBe(false);
    expect(migrated.machine.results).toEqual([]);
  });
});
describe("v0.3 游戏内国家规划", () => {
  it("第1回合不立项，第2回合会议保留之前建设，其他项目仍可启动", () => {
    let g = startCampaign({
      mode: "national",
      seed: "联邦-v03-验收",
      difficulty: "standard",
      politics: "classic",
    });
    expect(g.machine.goalPending).toBe(true);
    expect(
      previewAction(g, { type: "selectGoal", goal: "spark" }).errors.join(),
    ).toContain("第2回合");
    g = go(g, { type: "project", project: "warning", province: "south" });
    g = end(g);
    expect(g.machine.works[0].completed).toBe(true);
    g = go(g, { type: "selectGoal", goal: "spark" });
    expect(g.machine.goal).toBe("spark");
    expect(g.machine.goalPending).toBe(false);
    expect(g.machine.works[0].completed).toBe(true);
    expect(
      previewAction(g, {
        type: "project",
        project: "warning",
        province: "north",
      }).errors,
    ).toEqual([]);
    expect(
      previewAction(g, { type: "selectGoal", goal: "accord" }).errors.length,
    ).toBeGreaterThan(0);
  });
  it("第3回合期限清晰，没有静默替玩家选择目标", () => {
    let g = startCampaign({
      mode: "national",
      seed: "联邦-v03-验收",
      difficulty: "standard",
      politics: "classic",
    });
    g = end(g);
    g = end(g);
    const out = executeCommand(g, { type: "end" });
    expect(out.result.status).toBe("failed");
    expect(out.result.errors.join()).toContain("规划期限");
    expect(out.game.core.turn).toBe(3);
  });
  it("相同种子与操作在保存恢复后仍得到完全相同的随机公报", () => {
    const g = startCampaign({
        mode: "national",
        seed: "联邦-v03-验收",
        difficulty: "standard",
        politics: "classic",
      }),
      a: Action = { type: "investigate", deck: "civic" };
    expect(go(g, a)).toEqual(go(deserializeV2(serializeV2(g)), a));
  });
});

describe("v0.3 随机政治开局", () => {
  it("100个种子均有有效行动、独立人物与可用核心人才；三模板改变实际行动集合", () => {
    const templates = new Set<string>(),
      signatures = new Set<string>(),
      actions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const g = startCampaign({
        mode: "national",
        seed: `开局-${i}`,
        difficulty: "standard",
        politics: "random",
      });
      templates.add(g.machine.regime);
      signatures.add(JSON.stringify(g.core.appointments));
      const warning = g.machine.matters.find((x) => x.kind === "warning")!;
      actions.add(
        ["public-check", "repair", "observe"]
          .filter(
            (option) =>
              !previewAction(g, { type: "resolve", matter: warning.id, option })
                .errors.length,
          )
          .join(),
      );
      const posts = Object.values(g.core.appointments).filter(Boolean);
      expect(new Set(posts).size).toBe(posts.length);
      expect(g.machine.opening?.summary.length).toBeGreaterThan(3);
      expect(g.machine.works.some((w) => w.completed)).toBe(true);
      expect(
        serializeV2(
          startCampaign({
            mode: "national",
            seed: `开局-${i}`,
            difficulty: "standard",
            politics: "random",
          }),
        ),
      ).toBe(serializeV2(g));
      expect(go(g, { type: "investigate", deck: "civic" })).toEqual(
        go(deserializeV2(serializeV2(g)), {
          type: "investigate",
          deck: "civic",
        }),
      );
    }
    expect(templates.size).toBe(3);
    expect(signatures.size).toBeGreaterThan(20);
    expect(actions.size).toBeGreaterThan(1);
  });
  it("教学和经典短战役不因随机开局变化", () => {
    const g = startCampaign({
      mode: "tutorial",
      seed: "任意",
      difficulty: "standard",
      politics: "random",
    });
    expect(g.machine.opening).toBeUndefined();
    expect(g.machine.regime).toBe("devolved");
    expect(g.core.appointments["gov-south"]).toBe("bai");
  });
});

const resolveKind = (g: V2Game, kind: string, option: string) =>
  go(g, {
    type: "resolve",
    matter: g.machine.matters.find((x) => x.kind === kind)!.id,
    option,
  });
function finishLong(goal: "spark" | "accord" | "night") {
  let g = startCampaign({
    mode: "experimental",
    seed: "联邦-v03-验收",
    difficulty: "standard",
    politics: "classic",
  });
  if (goal === "night") {
    g = go(g, { type: "regime", regime: "vertical" });
    g = resolveKind(g, "warning", "observe");
    for (const province of ["industry", "south", "north"] as const)
      g = go(g, { type: "project", project: "warning", province });
    g = end(g);
    g = go(g, { type: "selectGoal", goal });
    g = resolveKind(g, "accident", "seal");
    g = end(g);
    const it = g.machine.matters.find((x) => x.kind === "distrust")!;
    g = go(g, {
      type: "authorize",
      matter: it.id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    g = resolveKind(g, "distrust", "rights");
    g = end(g);
    g = resolveKind(g, "oldgod", "seal");
  } else if (goal === "accord") {
    g = go(g, { type: "department", department: "evacuation" });
    g = resolveKind(g, "warning", "public-check");
    g = resolveKind(g, "gazette", "rights");
    g = end(g);
    g = go(g, { type: "selectGoal", goal });
    g = resolveKind(g, "accident", "public");
    g = end(g);
    g = resolveKind(g, "supply", "priority");
    g = go(g, {
      type: "authorize",
      matter: g.machine.matters.find((x) => x.kind === "accident")!.id,
      lead: "anomaly",
      joint: true,
      emergency: false,
    });
    g = resolveKind(g, "accident", "seal");
    g = end(g);
    g = resolveKind(g, "oldgod", "evacuate");
  } else {
    g = resolveKind(g, "warning", "public-check");
    g = resolveKind(g, "gazette", "standard");
    g = go(g, { type: "investigate", deck: "ley" });
    g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
    g = go(g, { type: "project", project: "energy", province: "south" });
    g = end(g);
    g = go(g, { type: "selectGoal", goal });
    g = go(g, { type: "department", department: "transport" });
    g = end(g);
    g = resolveKind(g, "accident", "contain");
    g = end(g);
    g = resolveKind(g, "oldgod", "evacuate");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: g.machine.matters.find((x) => x.kind === "accident")!.id,
      lead: "gov-south",
      joint: true,
      emergency: false,
    });
    g = resolveKind(g, "accident", "seal");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: g.machine.matters.find((x) => x.kind === "distrust")!.id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    g = resolveKind(g, "distrust", "rights");
  }
  while (g.core.turn < 12) {
    const god = g.machine.matters.find((x) => x.kind === "oldgod");
    if (god && god.containment === 0) g = resolveKind(g, "oldgod", "contain");
    if (g.core.turn === 10) g = go(g, { type: "inspect" });
    g = end(g);
    expect(g.core.status).toBe("playing");
    if (g.core.turn === 8) {
      expect(g.machine.matters.some((x) => x.kind === "final")).toBe(false);
      expect(
        g.machine.history.some((h) => h.title === "本年度保留改革与建设窗口"),
      ).toBe(true);
    }
  }
  expect(g.machine.terminalInspected).toBe(true);
  g = resolveKind(g, "final", "activate");
  return end(g);
}
describe("v0.3 十二回合实验战役", () => {
  for (const goal of ["spark", "accord", "night"] as const)
    it(`${goal}真实建设、演练、终局可完成十二回合`, () => {
      const g = finishLong(goal);
      expect(g.core.status).toBe("won");
      expect(g.core.turn).toBe(12);
      expect(g.core.ending).toContain("正式完成");
      expect(deserializeV2(serializeV2(g))).toEqual(g);
    });
  it("候选事件由当前制度/能力决定；相同种子与读档结果不变", () => {
    let g = startCampaign({
      mode: "experimental",
      seed: "条件事件-3",
      difficulty: "standard",
      politics: "classic",
    });
    g = go(g, { type: "regime", regime: "vertical" });
    g = end(g);
    g = go(g, { type: "selectGoal", goal: "accord" });
    g = resolveKind(g, "accident", "seal");
    g = end(g);
    g = end(g);
    g = resolveKind(g, "oldgod", "seal");
    const altered = structuredClone(g);
    altered.machine.standards = true;
    altered.machine.permit = true;
    altered.machine.cooperation = true;
    const n = end(g),
      n2 = end(altered);
    expect(n).toEqual(end(deserializeV2(serializeV2(g))));
    const generated = (x: V2Game) =>
      x.machine.history
        .filter((h) => h.turn === 5 && h.title === "条件议程进入候选")
        .map((h) => h.conditions.join());
    expect(generated(n)).not.toEqual(generated(n2));
  });
});

describe("v0.3 随机模板的真实完整胜利", () => {
  it("三种随机政治模板都能经改革、实际施工、危机处置及演练完成长夜", () => {
    const covered = new Set<string>();
    for (let seedIndex = 0; seedIndex < 100 && covered.size < 3; seedIndex++) {
      let g = startCampaign({
        mode: "experimental",
        seed: `开局-${seedIndex}`,
        difficulty: "standard",
        politics: "random",
      });
      if (covered.has(g.machine.regime)) continue;
      covered.add(g.machine.regime);
      if (g.machine.regime !== "vertical")
        g = go(g, { type: "regime", regime: "vertical" });
      g = resolveKind(g, "warning", "observe");
      for (const province of ["industry", "south", "north"] as const)
        if (
          !g.machine.works.some(
            (w) => w.type === "warning" && w.province === province,
          )
        )
          g = go(g, { type: "project", project: "warning", province });
      g = end(g);
      g = go(g, { type: "selectGoal", goal: "night" });
      g = resolveKind(g, "accident", "seal");
      g = end(g);
      const distrust = g.machine.matters.find((x) => x.kind === "distrust")!;
      g = go(g, {
        type: "authorize",
        matter: distrust.id,
        lead: "plan",
        joint: false,
        emergency: false,
      });
      g = resolveKind(g, "distrust", "rights");
      g = end(g);
      g = resolveKind(g, "oldgod", "seal");
      while (g.core.turn < 12) {
        if (g.core.turn === 10) g = go(g, { type: "inspect" });
        g = end(g);
        expect(g.core.status).toBe("playing");
      }
      g = resolveKind(g, "final", "activate");
      g = end(g);
      expect(g.core.status).toBe("won");
    }
    expect(covered.size).toBe(3);
  });
  it("第3回合其他命令耗尽后，规划仍然可提交，不造成资源死锁", () => {
    let g = startCampaign({
      mode: "national",
      seed: "规划无死锁",
      difficulty: "standard",
      politics: "classic",
    });
    g = end(g);
    g = end(g);
    g.core.commands = 0;
    g.core.capital = 0;
    expect(
      previewAction(g, { type: "selectGoal", goal: "spark" }).errors,
    ).toEqual([]);
    g = go(g, { type: "selectGoal", goal: "spark" });
    expect(g.machine.goalPending).toBe(false);
  });
});
