import { describe, expect, it } from "vitest";
import { executeAction, executeCommand, newV2 } from "./engine";
import type { Action, V2Game } from "./model";
const go = (g: V2Game, action: Action) => executeAction(g, action);
function engineerOpening() {
  let g = newV2("national", "spark", "工程回归-v04");
  g = go(g, { type: "investigate", deck: "ley" });
  g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
  return g;
}
describe("v0.4 第一阶段：工程入口一致性", () => {
  it("通过机会事务开工不会把同次开工标记为工程师抽调", () => {
    let g = engineerOpening();
    g = go(g, {
      type: "resolve",
      matter: g.machine.matters.find((x) => x.kind === "opportunity")!.id,
      option: "invest",
    });
    expect(g.machine.occupied.mo).toBeUndefined();
    g = go(g, { type: "end" });
    expect(g.machine.works[0].progress).toBe(1);
  });
  it("先在建设菜单开工后，旧机会事务不能再次开同省同类工程", () => {
    let g = engineerOpening();
    const id = g.machine.matters.find((x) => x.kind === "opportunity")!.id;
    g = go(g, { type: "project", project: "energy", province: "south" });
    const r = executeCommand(g, {
      type: "resolve",
      matter: id,
      option: "invest",
    });
    expect(r.result.status).toBe("failed");
    expect(r.game).toBe(g);
    expect(r.game.machine.works).toHaveLength(1);
  });
});

import {
  capability,
  deserializeV2,
  finance,
  previewAction,
  serializeV2,
} from "./engine";
import { assignmentFor, hasDepartment, workReadiness } from "./administration";
function developed(seed = "治理回归-v04") {
  const g = newV2("experimental", "spark", seed);
  g.machine.surveyed = true;
  g.machine.standards = true;
  g.machine.discoveries.industry = ["resources"];
  g.machine.cooperation = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.core.policies.method = 1;
  g.core.treasury = 30; // Solvent fixture isolates qualification/progression from bankruptcy.
  return g;
}
const energy = (g: V2Game, assignment: "advisor" | "dedicated" = "dedicated") =>
  go(g, {
    type: "project",
    project: "energy",
    province: "south",
    worker: "mo",
    assignment,
  });
describe("v0.4 正式职位与项目工作", () => {
  it("空闲工程师可专职开工，保留名义身份并真实推进", () => {
    let g = energy(developed());
    expect(g.core.appointments["gov-south"]).not.toBe("mo");
    expect(workReadiness(g, g.machine.works[0]).every((c) => c.met)).toBe(true);
    g = go(g, { type: "end" });
    expect(g.machine.works[0].progress).toBe(1);
  });
  it("在职顾问保留行政能力，实际抽调后中断施工且不收费", () => {
    let g = go(developed(), {
      type: "appoint",
      office: "gov-south",
      person: "mo",
    });
    g = energy(g, "advisor");
    expect(
      previewAction(g, {
        type: "resolve",
        matter: g.machine.matters[0].id,
        option: "repair",
      }).errors,
    ).toHaveLength(0);
    g = go(g, {
      type: "resolve",
      matter: g.machine.matters[0].id,
      option: "repair",
    });
    expect(finance(g).projectCosts).toBe(0);
    g = go(g, { type: "end" });
    expect(g.machine.works[0].progress).toBe(0);
  });
  it("在职专职派遣保留名义职位，但暂停其行政能力", () => {
    let g = go(developed(), {
      type: "appoint",
      office: "gov-south",
      person: "mo",
    });
    g = energy(g);
    expect(g.core.appointments["gov-south"]).toBe("mo");
    expect(
      previewAction(g, {
        type: "resolve",
        matter: g.machine.matters[0].id,
        option: "repair",
      }).errors.join(),
    ).toContain("履职");
    expect(
      capability(g, "rapid", g.machine.matters[0]).every((c) => c.met),
    ).toBe(false);
    expect(finance(g).projectCosts).toBe(1);
  });
  it.each(["advisor", "dedicated"] as const)(
    "调任后%s模式遵循公开的派遣规则",
    (assignment) => {
      let g = go(developed(), {
        type: "appoint",
        office: "gov-south",
        person: "mo",
      });
      g = energy(g, assignment);
      g = go(g, { type: "appoint", office: "gov-south", person: null });
      g = go(g, { type: "end" });
      expect(g.machine.works[0].progress).toBe(
        assignment === "dedicated" ? 1 : 0,
      );
    },
  );
  it("工程完成释放人员，后续项目可以使用同一人才", () => {
    let g = energy(developed());
    g = go(g, { type: "end" });
    g = go(g, { type: "end" });
    expect(g.machine.works[0].completed).toBe(true);
    expect(assignmentFor(g, "mo")).toBeUndefined();
    expect(
      previewAction(g, {
        type: "project",
        project: "factory",
        province: "industry",
        worker: "mo",
        assignment: "dedicated",
      }).errors,
    ).toHaveLength(0);
  });
  it("不兼容的两工程不会同时占用人物；暂停释放，恢复须重新检验", () => {
    let g = energy(developed());
    const work = g.machine.works[0].id;
    const other: Action = {
      type: "project",
      project: "factory",
      province: "industry",
      worker: "mo",
      assignment: "dedicated",
    };
    expect(executeCommand(g, other).result.status).toBe("failed");
    g = go(g, { type: "pause", work });
    g = go(g, other);
    const r = executeCommand(g, { type: "pause", work });
    expect(r.result.status).toBe("failed");
    expect(r.game).toBe(g);
  });
  it("取消不退款，恢复重新检验；所有进度、派遣和预算可完整读回", () => {
    let g = energy(developed());
    const work = g.machine.works[0].id,
      paid = g.core.treasury;
    g = go(g, { type: "workControl", work, operation: "cancel" });
    expect(g.core.treasury).toBe(paid);
    expect(finance(g).projectCosts).toBe(0);
    expect(assignmentFor(g, "mo")).toBeUndefined();
    expect(
      executeCommand(g, {
        type: "project",
        project: "energy",
        province: "south",
        worker: "mo",
        assignment: "dedicated",
      }).result.status,
    ).toBe("failed");
    g = go(g, { type: "workControl", work, operation: "restart" });
    expect(g.core.treasury).toBe(paid - 1);
    const restored = deserializeV2(serializeV2(g));
    expect(restored).toEqual(g);
    expect(go(restored, { type: "end" })).toEqual(go(g, { type: "end" }));
  });
});
describe("v0.4 有限财政与长期投资", () => {
  it("同省连续稽核失败不扣费，首轮税制收益按期到期，第二轮不重复税制", () => {
    let g = developed();
    const a: Action = {
      type: "audit",
      province: "industry",
      lead: "gov-industry",
    };
    const baseline = finance(g).income,
      money = g.core.treasury;
    g = go(g, a);
    expect(g.core.treasury).toBeGreaterThan(money);
    expect(finance(g).income).toBe(baseline + 1);
    expect(executeCommand(g, a).game).toBe(g);
    g = go(g, { type: "end" });
    expect(finance(g).income).toBe(baseline + 1);
    g = go(g, { type: "end" });
    expect(finance(g).income).toBe(baseline);
    g = go(g, { type: "end" });
    g = go(g, a);
    expect(g.machine.audits.industry!.rounds).toBe(2);
    g.core.turn = 7;
    g.core.commands = 5;
    g.machine.occupied = {};
    expect(executeCommand(g, a).result.status).toBe("failed");
    expect(finance(g).income).toBe(baseline);
  });
  it("预算紧缩关闭真实封印能力，专项施工增加支出并加快工程", () => {
    let g = developed();
    g.machine.regime = "vertical";
    const event = {
      ...g.machine.matters[0],
      kind: "oldgod" as const,
      province: "north" as const,
    };
    expect(capability(g, "seal", event, 0).every((c) => c.met)).toBe(true);
    g = go(g, { type: "budget", department: "anomaly", level: 0 });
    expect(capability(g, "seal", event, 0).every((c) => c.met)).toBe(false);
    expect(finance(g).fixed).toBe(3);
    g = go(g, { type: "budget", department: "anomaly", level: 1 });
    g.machine.regime = "devolved";
    g = energy(g);
    g = go(g, { type: "budget", department: "plan", level: 2 });
    expect(finance(g).maintenance).toBe(2);
    g = go(g, { type: "end" });
    expect(g.machine.works[0].completed).toBe(true);
  });
  it.each(["farm", "factory", "port", "cooperative", "rail"] as const)(
    "%s投资先支付成本，按实际工期完成后才产生能力",
    (type) => {
      let g = developed();
      g.machine.discoveries.south = ["routes"];
      g.machine.discoveries.industry = ["resources", "routes"];
      const province = type === "factory" ? "industry" : "south",
        before = g.core.treasury;
      g = go(g, {
        type: "project",
        project: type,
        province,
        worker: "mo",
        assignment: "dedicated",
        to: type === "rail" ? "north" : undefined,
      });
      expect(g.core.treasury).toBeLessThan(before);
      expect(g.machine.works[0].completed).toBe(false);
      let count = 0;
      while (!g.machine.works[0].completed && count++ < 4)
        g = go(g, { type: "end" });
      expect(g.machine.works[0].completed).toBe(true);
      expect(assignmentFor(g, "mo")).toBeUndefined();
      expect(deserializeV2(serializeV2(g))).toEqual(g);
    },
  );
  it("合作企业的财政依赖实际信任及权利，压制后不会照常增收", () => {
    let g = go(developed(), {
      type: "project",
      project: "cooperative",
      province: "south",
      worker: "mo",
      assignment: "dedicated",
    });
    g = go(g, { type: "end" });
    g = go(g, { type: "end" });
    expect(finance(g).income).toBe(6);
    g.machine.suppressed.south = true;
    expect(finance(g).income).toBe(5);
  });
});
describe("v0.4 权力范围、主动探索与地区连接", () => {
  it("临时授权当回合到期，地区疏散改革仅覆盖所选省，其他领域改革并存", () => {
    let g = developed();
    g.machine.regime = "vertical";
    const matter = g.machine.matters[0];
    g = go(g, {
      type: "authorize",
      matter: matter.id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    expect(g.machine.authorization[matter.id]).toBeDefined();
    g = go(g, { type: "department", department: "evacuation", scope: "south" });
    g = go(g, { type: "end" });
    expect(g.machine.authorization).toEqual({});
    expect(hasDepartment(g, "evacuation", "south")).toBe(true);
    expect(hasDepartment(g, "evacuation", "north")).toBe(false);
    g = go(g, { type: "department", department: "transport" });
    g = go(g, { type: "end" });
    expect(hasDepartment(g, "evacuation", "south")).toBe(true);
    expect(hasDepartment(g, "transport")).toBe(true);
  });
  it("改革协商准备有真实人物占用和限时资本减免，无升级前置", () => {
    let g = developed();
    expect(
      previewAction(g, { type: "regime", regime: "joint" }).errors,
    ).toHaveLength(0);
    g = go(g, {
      type: "coordinate",
      province: "south",
      kind: "prepare",
      regime: "joint",
    });
    expect(
      previewAction(g, { type: "regime", regime: "joint" }).costs.capital,
    ).toBe(1);
    expect(g.machine.occupied.lin).toBeDefined();
    expect(
      executeCommand(g, {
        type: "coordinate",
        province: "south",
        kind: "agreement",
      }).result.status,
    ).toBe("failed");
    g.core.turn = 4;
    expect(
      previewAction(g, { type: "regime", regime: "joint" }).costs.capital,
    ).toBe(2);
  });
  it("主动调查揭示机会或风险，同种子和存档续玩相同；反复预览不消耗随机数", () => {
    const g = developed(),
      action: Action = { type: "survey", province: "south", field: "routes" },
      rng = g.core.rng;
    for (let i = 0; i < 5; i++) previewAction(g, action);
    expect(g.core.rng).toBe(rng);
    const n = go(g, action);
    expect(n.machine.discoveries.south).toContain("routes");
    expect(n).toEqual(go(deserializeV2(serializeV2(g)), action));
    expect(executeCommand(n, action).result.status).toBe("failed");
    const outcomes = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const x = developed(`探索样本${i}`);
      outcomes.add(
        go(x, action).core.provinces.find((p) => p.id === "south")!.pressure
          .anomaly,
      );
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });
  it("竣工铁路才可运输，搬运损耗使总资源减少；危机能阻断并沿连接传播", () => {
    let g = go(developed(), {
      type: "project",
      project: "rail",
      province: "south",
      to: "north",
      worker: "mo",
      assignment: "dedicated",
    });
    const transfer: Action = {
      type: "transfer",
      from: "south",
      to: "north",
      amount: 2,
    };
    expect(executeCommand(g, transfer).result.status).toBe("failed");
    g = go(g, { type: "end" });
    g = go(g, {
      type: "resolve",
      matter: g.machine.matters.find((x) => x.kind === "accident")!.id,
      option: "contain",
    });
    g = go(g, { type: "end" });
    const total = g.core.provinces.reduce((n, p) => n + p.stock, 0),
      north = g.core.provinces.find((p) => p.id === "north")!.stock;
    g = go(g, transfer);
    expect(g.core.provinces.reduce((n, p) => n + p.stock, 0)).toBe(total - 1);
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(
      north + 2,
    );
    const event = g.machine.matters.find((x) => x.kind === "accident")!;
    event.stage = 3;
    expect(executeCommand(g, transfer).result.status).toBe("failed");
    g = go(g, { type: "end" });
    expect(g.machine.history.some((x) => x.title === "铁路联动预警")).toBe(
      true,
    );
  });
  it("旧v0.3存档补全预算和工作分配，不重置种子、目标与项目", () => {
    const g = energy(developed()),
      raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.3.1";
    for (const key of [
      "departments",
      "departmentBudgets",
      "audits",
      "discoveries",
      "coordination",
      "drillsUntil",
    ])
      delete raw.machine[key];
    delete raw.machine.works[0].assignment;
    delete raw.machine.works[0].cancelled;
    const n = deserializeV2(JSON.stringify(raw));
    expect(n.machine.departmentBudgets.plan).toBe(1);
    expect(n.machine.works[0].worker).toBe("mo");
    expect(n.machine.goal).toBe(g.machine.goal);
    expect(n.core.rng).toBe(g.core.rng);
    const bad = JSON.parse(serializeV2(n));
    bad.machine.departmentBudgets.plan = 9;
    expect(() => deserializeV2(JSON.stringify(bad))).toThrow("v0.4");
  });
});

describe("v0.4 原始经济下完整治理路线", () => {
  it("有限稽核、空闲工程师派遣、合作磋商、撤销重开和专项预算仍可完成八回合星火", () => {
    let g = newV2("national", "spark", "v04-真实财政完整战役");
    const resolve = (kind: string, option: string) => {
      g = go(g, {
        type: "resolve",
        matter: g.machine.matters.find((x) => x.kind === kind)!.id,
        option,
      });
    };
    const end = () => {
      g = go(g, { type: "end" });
    };
    resolve("warning", "public-check");
    resolve("gazette", "standard");
    g = go(g, { type: "investigate", deck: "ley" });
    g = energy(g);
    g = go(g, { type: "audit", province: "industry", lead: "gov-industry" });
    end();
    g = go(g, { type: "department", department: "transport" });
    g = go(g, { type: "policy", issue: "method", side: 1 });
    g = go(g, { type: "coordinate", province: "south", kind: "agreement" });
    const work = g.machine.works[0].id;
    g = go(g, { type: "workControl", work, operation: "cancel" });
    g = go(g, { type: "workControl", work, operation: "restart" });
    end();
    resolve("accident", "contain");
    end();
    g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
    resolve("oldgod", "evacuate");
    g = go(g, { type: "survey", province: "industry", field: "resources" });
    g = go(g, { type: "budget", department: "defense", level: 0 });
    g = go(g, { type: "budget", department: "plan", level: 2 });
    end();
    g = go(g, {
      type: "authorize",
      matter: g.machine.matters.find((x) => x.kind === "accident")!.id,
      lead: "anomaly",
      joint: false,
      emergency: false,
    });
    resolve("accident", "seal");
    end();
    g = go(g, {
      type: "authorize",
      matter: g.machine.matters.find((x) => x.kind === "distrust")!.id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    resolve("distrust", "rights");
    while (g.core.turn < 8) {
      const god = g.machine.matters.find((x) => x.kind === "oldgod");
      if (god?.containment === 0) resolve("oldgod", "contain");
      end();
      expect(g.core.status).toBe("playing");
    }
    resolve("oldgod", "contain");
    resolve("final", "activate");
    end();
    expect(g.core.status).toBe("won");
    expect(g.machine.works[0].completed).toBe(true);
    expect(g.machine.audits.industry?.rounds).toBe(1);
    expect(g.core.insolvency).toBe(0);
  });
});

describe("v0.4 改革性质与旧冲突存档", () => {
  it("紧急临时授权成本可以高于经协商准备的国家体制改革", () => {
    let g = developed();
    const matter = {
      ...g.machine.matters[0],
      kind: "accident" as const,
      stage: 2,
    };
    g.machine.matters = [matter];
    g = go(g, {
      type: "coordinate",
      province: "south",
      kind: "prepare",
      regime: "joint",
    });
    const temporary = previewAction(g, {
      type: "authorize",
      matter: matter.id,
      lead: "anomaly",
      joint: false,
      emergency: true,
    });
    const constitution = previewAction(g, { type: "regime", regime: "joint" });
    expect(temporary.costs.capital).toBeGreaterThan(constitution.costs.capital);
    expect(
      previewAction(g, {
        type: "department",
        department: "transport",
        scope: "south",
      }).costs.treasury,
    ).toBe(0);
  });
  it("旧版重复开工存档保留记录、历史费用和随机状态，并停用重复设施", () => {
    const g = energy(developed()),
      raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.3.1";
    raw.machine.works.push({ ...raw.machine.works[0], id: "legacy-duplicate" });
    const restored = deserializeV2(JSON.stringify(raw));
    expect(restored.machine.works).toHaveLength(2);
    expect(restored.machine.works[1].cancelled).toBe(true);
    expect(restored.machine.migrationNotes?.length).toBe(1);
    expect(restored.core.treasury).toBe(g.core.treasury);
    expect(restored.core.rng).toBe(g.core.rng);
    expect(deserializeV2(serializeV2(restored))).toEqual(restored);
    raw.machine.works[1].completed = true;
    raw.machine.works[1].progress = raw.machine.works[1].duration;
    const completed = deserializeV2(JSON.stringify(raw));
    expect(completed.machine.works[0].cancelled).toBe(true);
    expect(completed.machine.works[1].cancelled).toBe(false);
    expect(finance(completed).income).toBe(6);
    expect(finance(completed).projectCosts).toBe(0);
  });
});
