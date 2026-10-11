import { describe, expect, it } from "vitest";
import { executeAction, executeCommand, newV2, previewAction } from "./engine";
import type { Action, V2Game, Work } from "./model";
import {
  applyBorder,
  borderPreview,
  borderSealActors,
  type BorderAction,
} from "./border";

function supplyState() {
  const g = newV2("experimental", "night", "运输边防联动-v05");
  g.core.treasury = 20;
  g.core.capital = 20;
  g.core.policies.method = 1;
  g.core.policies.disclosure = 0;
  g.machine.standards = true;
  g.machine.cooperation = true;
  g.machine.knowledge = true;
  g.machine.rights.industry = true;
  g.machine.rights.north = true;
  g.machine.trust.north = 2;
  for (const p of g.core.provinces) p.stock = 6;
  const base: Omit<Work, "type" | "province" | "id"> = {
    progress: 3,
    duration: 3,
    completed: true,
    paused: false,
    source: "真实工程历史",
  };
  g.machine.works = [
    {
      ...base,
      id: "南岭电网",
      type: "grid",
      province: "south",
      to: "industry",
      network: { active: true, fault: false },
    },
    { ...base, id: "设备产线", type: "factory", province: "industry" },
    {
      ...base,
      id: "工业北境铁路",
      type: "rail",
      province: "industry",
      to: "north",
    },
  ];
  return g;
}

/** Same interface boundary as the engine: validated preview fees precede effects. */
function payAndApply(g: V2Game, a: BorderAction) {
  const p = borderPreview(g, a);
  if (p.conditions.some((c) => !c.met))
    throw new Error(
      p.conditions
        .filter((c) => !c.met)
        .map((c) => c.label)
        .join("；"),
    );
  g.core.commands -= p.costs.commands;
  g.core.treasury -= p.costs.treasury;
  g.core.capital -= p.costs.capital;
  if (p.costs.province)
    g.core.provinces.find((r) => r.id === p.costs.province)!.stock -=
      p.costs.stock;
  return applyBorder(g, a, "防线补给登记");
}

describe("v0.5 交通—设备—北境防线因果链", () => {
  it("组织条件已达成后，实际开工与结算形成能源—设备—铁路链，停机立即撤销补给资格", () => {
    let g = supplyState();
    g.machine.works = [];
    // A solvent established-government scenario tests construction dependencies;
    // it does not claim that every fresh campaign can finance all three at once.
    g.machine.fiscal!.taxSystem = "central";
    const command = (action: Action) => {
      const result = executeCommand(g, action);
      expect(result.result.errors, JSON.stringify(action)).toEqual([]);
      expect(result.result.status, JSON.stringify(action)).not.toBe("failed");
      g = result.game;
    };
    command({ type: "investigate", deck: "ley" });
    command({ type: "reconcile", province: "south" });
    command({ type: "survey", province: "industry", field: "resources" });
    command({
      type: "project",
      project: "grid",
      province: "south",
      to: "industry",
      worker: "linruoxu",
      assignment: "dedicated",
    });
    command({
      type: "project",
      project: "factory",
      province: "industry",
      worker: "han",
      assignment: "dedicated",
    });
    expect(g.machine.works.every((work) => !work.completed)).toBe(true);
    command({ type: "end" });
    expect(
      g.machine.works.find((work) => work.type === "factory")!.completed,
    ).toBe(true);
    expect(
      g.machine.works.find((work) => work.type === "grid")!.completed,
    ).toBe(false);
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "实际工业供能",
      )?.met,
    ).toBe(false);
    command({
      type: "project",
      project: "rail",
      province: "industry",
      to: "north",
      worker: "guhe",
      assignment: "dedicated",
    });
    command({
      type: "resolve",
      matter: g.machine.matters.find(
        (m) => m.kind === "accident" && m.province === "south",
      )!.id,
      option: "contain",
    });
    command({ type: "end" });
    expect(g.machine.works.every((work) => work.completed)).toBe(true);
    expect(g.core.insolvency).toBe(0);
    const grid = g.machine.works.find((work) => work.type === "grid")!;
    const halted = structuredClone(g);
    const close = executeCommand(halted, {
      type: "network",
      work: grid.id,
      operation: "close",
    });
    expect(close.result.status).toBe("applied");
    expect(
      borderPreview(close.game, {
        type: "borderSupply",
        route: "rail",
      }).conditions.find((c) => c.label === "实际工业供能")?.met,
    ).toBe(false);
    const industry = g.core.provinces.find((p) => p.id === "industry")!.stock;
    const north = g.core.provinces.find((p) => p.id === "north")!.stock;
    command({ type: "borderSupply", route: "rail" });
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(
      industry - 3,
    );
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(
      north + 2,
    );
    const record = g.machine.history.find(
      (h) => h.title === "铁路运输防线设备",
    )!;
    expect(record.parents).toContain(grid.source);
    expect(
      g.machine.fiscal!.ledger.some(
        (entry) =>
          entry.category === "investment" &&
          entry.reason.includes("跨省灵能电网"),
      ),
    ).toBe(true);
  });
  it("真实命令管线支付本地库存费用一次，并使实际本地技术负责人取得后续收容方案", () => {
    let g = supplyState();
    g.core.appointments.defense = "hejing";
    g.core.appointments["gov-north"] = "lu";
    g.core.provinces.find((p) => p.id === "north")!.stock = 2;
    const oldNorth = g.core.provinces.find((p) => p.id === "north")!.stock;
    const r = executeCommand(g, { type: "borderSupply", route: "local" });
    expect(r.result.status).toBe("applied");
    expect(r.game.core.provinces.find((p) => p.id === "north")!.stock).toBe(
      oldNorth - 2,
    );
    expect(r.game.machine.occupied.lu).toBeDefined();
    g = executeAction(r.game, { type: "end" });
    g.machine.matters.push({
      id: "北境设施异常",
      title: "设备收容试验",
      description: "",
      kind: "accident",
      province: "north",
      stage: 1,
      containment: 0,
      isolated: false,
      evacuated: false,
      age: 0,
    });
    const preview = previewAction(g, {
      type: "resolve",
      matter: "北境设施异常",
      option: "seal",
    });
    expect(preview.errors).toEqual([]);
    const seal = executeCommand(g, {
      type: "resolve",
      matter: "北境设施异常",
      option: "seal",
    });
    expect(seal.result.status).toBe("resolved");
    expect(seal.game.machine.matters.some((m) => m.id === "北境设施异常")).toBe(
      false,
    );
    const central = structuredClone(g);
    central.machine.milestones = central.machine.milestones.filter(
      (m) => !m.startsWith("border-owner:"),
    );
    central.machine.milestones.push("border-owner:central");
    expect(
      previewAction(central, {
        type: "resolve",
        matter: "北境设施异常",
        option: "seal",
      }).errors.length,
    ).toBeGreaterThan(0);
  });
  it("真实江湖派遣让地方取得设备协办权，担当人员仍须完成任命并等待任务释放", () => {
    let g = supplyState();
    const act = (action: Action) => {
      const r = executeCommand(g, action);
      expect(r.result.errors, JSON.stringify(action)).toEqual([]);
      g = r.game;
    };
    act({ type: "appoint", office: "defense", person: "yanxingzhou" });
    act({ type: "appoint", office: "gov-north", person: "lu" });
    const industry = g.core.provinces.find((p) => p.id === "industry")!.stock;
    const north = g.core.provinces.find((p) => p.id === "north")!.stock;
    act({ type: "borderSupply", route: "jianghu" });
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(
      industry - 3,
    );
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(
      north + 2,
    );
    expect(g.machine.occupied.yanxingzhou).toBeDefined();
    expect(g.machine.occupied.lu).toBeDefined();
    expect(borderSealActors(g, ["lu"])).toEqual([]);
    act({ type: "end" });
    expect(borderSealActors(g, ["lu"])).toEqual(["lu"]);
    g.machine.matters.push({
      id: "运输装备异常",
      title: "北境设备异常",
      description: "",
      kind: "accident",
      province: "north",
      stage: 1,
      containment: 0,
      isolated: false,
      evacuated: false,
      age: 0,
    });
    const own = previewAction(g, {
      type: "resolve",
      matter: "运输装备异常",
      option: "seal",
    });
    expect(
      own.conditions.find((c) => c.label === "密封档案与异常收容资格")?.met,
    ).toBe(true);
    const centralOnly = structuredClone(g);
    centralOnly.machine.milestones = centralOnly.machine.milestones.filter(
      (m) => !m.startsWith("border-owner:"),
    );
    centralOnly.machine.milestones.push("border-owner:central");
    expect(
      previewAction(centralOnly, {
        type: "resolve",
        matter: "运输装备异常",
        option: "seal",
      }).conditions.find((c) => c.label === "密封档案与异常收容资格")?.met,
    ).toBe(false);
    act({ type: "resolve", matter: "运输装备异常", option: "seal" });
    expect(g.machine.matters.some((m) => m.id === "运输装备异常")).toBe(false);
    expect(
      g.machine.archive.find((m) => m.id === "运输装备异常")?.lifecycle,
    ).toBe("resolved");
  });
  it("铁路运输实际搬运物资并登记中央设备管理权", () => {
    const g = supplyState();
    expect(
      borderPreview(g, {
        type: "borderSupply",
        route: "rail",
      }).conditions.filter((c) => !c.met),
    ).toEqual([]);
    const old = g.core.provinces.reduce((sum, p) => sum + p.stock, 0);
    payAndApply(g, { type: "borderSupply", route: "rail" });
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(3);
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(8);
    expect(g.core.provinces.reduce((sum, p) => sum + p.stock, 0)).toBe(old - 1);
    expect(g.core.treasury).toBe(19);
    expect(g.machine.reserve).toBe(true);
    expect(g.machine.milestones).toContain("border-network");
    expect(g.machine.milestones).toContain("border-owner:central");
    expect(g.machine.occupied.lin).toBe("防线补给登记");
    delete g.machine.occupied.ye;
    expect(borderSealActors(g, ["ye"])).toEqual([]);
  });
  it("电网故障或未竣工工业设施中断设备制造，不只是少一项数值奖励", () => {
    const g = supplyState();
    g.machine.works.find((w) => w.type === "grid")!.network!.fault = true;
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "实际工业供能",
      )?.met,
    ).toBe(false);
    expect(() =>
      payAndApply(g, { type: "borderSupply", route: "rail" }),
    ).toThrow();
    expect(g.machine.reserve).toBe(false);
    g.machine.works.find((w) => w.type === "grid")!.network!.fault = false;
    g.machine.works.find((w) => w.type === "factory")!.completed = false;
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "实际工业设备产线",
      )?.met,
    ).toBe(false);
  });
  it("铁路必须实际连接工业与北境，兼容标准不能替代产权和调配协议", () => {
    const g = supplyState();
    g.machine.works.find((w) => w.type === "rail")!.to = "south";
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "实际跨省铁路",
      )?.met,
    ).toBe(false);
    g.machine.works.find((w) => w.type === "rail")!.to = "north";
    g.machine.rights.north = false;
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "运输标准与法定调配权",
      )?.met,
    ).toBe(false);
    g.machine.departments.transport = ["north"];
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.find(
        (c) => c.label === "运输标准与法定调配权",
      )?.met,
    ).toBe(true);
  });
  it("江湖护送可绕过未建铁路，但实际物流人员被任务占用", () => {
    const g = supplyState();
    g.machine.works = g.machine.works.filter((w) => w.type !== "rail");
    expect(
      borderPreview(g, { type: "borderSupply", route: "rail" }).conditions.some(
        (c) => !c.met,
      ),
    ).toBe(true);
    expect(
      borderPreview(g, {
        type: "borderSupply",
        route: "jianghu",
      }).conditions.filter((c) => !c.met),
    ).toEqual([]);
    payAndApply(g, { type: "borderSupply", route: "jianghu" });
    expect(g.core.capital).toBe(19);
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(8);
    expect(g.machine.occupied.ye).toBe("防线补给登记");
    expect(g.machine.milestones).toContain("border-owner:joint");
    expect(borderSealActors(g, ["ye"])).toEqual([]);
    delete g.machine.occupied.ye;
    expect(borderSealActors(g, ["ye"])).toEqual(["ye"]);
  });
  it("江湖组织不能在强制政策或本人专职派遣时作为无条件国家运输", () => {
    const g = supplyState();
    g.core.policies.method = 0;
    expect(
      borderPreview(g, {
        type: "borderSupply",
        route: "jianghu",
      }).conditions.find((c) => c.label === "江湖物流负责人实际参与")?.met,
    ).toBe(false);
    g.core.policies.method = 1;
    g.machine.works.push({
      id: "占用联络人",
      type: "cooperative",
      province: "north",
      worker: "ye",
      assignment: "dedicated",
      progress: 0,
      duration: 2,
      paused: false,
      completed: false,
      source: "正式专职派遣",
    });
    expect(
      borderPreview(g, {
        type: "borderSupply",
        route: "jianghu",
      }).conditions.find((c) => c.label === "江湖物流负责人实际参与")?.met,
    ).toBe(false);
  });
  it("隔离和严重失控阻断铁路与江湖通道，本地应急改装仍可使用已有库存", () => {
    const g = supplyState();
    g.machine.matters.push({
      id: "工业隔离",
      title: "工业事故",
      description: "",
      kind: "accident",
      province: "industry",
      stage: 3,
      containment: 0,
      isolated: true,
      evacuated: false,
      age: 1,
    });
    for (const route of ["rail", "jianghu"] as const)
      expect(
        borderPreview(g, { type: "borderSupply", route }).conditions.find(
          (c) => c.label === "工业库存与安全通道",
        )?.met,
      ).toBe(false);
    expect(
      borderPreview(g, {
        type: "borderSupply",
        route: "local",
      }).conditions.filter((c) => !c.met),
    ).toEqual([]);
    payAndApply(g, { type: "borderSupply", route: "local" });
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(4);
    expect(g.machine.milestones).toContain("border-owner:north");
  });
  it("只有两份库存的本地应急费用只扣一次，转换后不产生负物资", () => {
    const g = supplyState();
    g.core.provinces.find((p) => p.id === "north")!.stock = 2;
    const beforeIndustry = g.core.provinces.find(
      (p) => p.id === "industry",
    )!.stock;
    payAndApply(g, { type: "borderSupply", route: "local" });
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(0);
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(
      beforeIndustry,
    );
    expect(g.core.treasury).toBe(20);
    expect(g.machine.reserve).toBe(true);
  });
  it("同一种补给不能重复领取，所有三条方案均保留确定来源与后续管理差异", () => {
    const g = supplyState();
    payAndApply(g, { type: "borderSupply", route: "local" });
    delete g.machine.occupied.ye;
    const before = JSON.stringify(g);
    expect(() =>
      payAndApply(g, { type: "borderSupply", route: "local" }),
    ).toThrow();
    expect(JSON.stringify(g)).toBe(before);
    expect(g.machine.origins["border-reserve"]).toBe("防线补给登记");
  });
  it("地方设备不是自动封印：负责人须有技术、合法参与、档案、政策与预算", () => {
    const g = supplyState();
    payAndApply(g, { type: "borderSupply", route: "local" });
    delete g.machine.occupied.ye;
    expect(borderSealActors(g, ["ye"])).toEqual(["ye"]);
    expect(borderSealActors(g, ["lin"])).toEqual([]);
    g.core.appointments["gov-north"] = "wen";
    expect(borderSealActors(g, ["wen"])).toEqual([]);
    g.core.appointments["gov-north"] = "ye";
    g.core.policies.disclosure = 1;
    expect(borderSealActors(g, ["ye"])).toEqual([]);
    g.core.policies.disclosure = 0;
    g.machine.departmentBudgets.anomaly = 0;
    expect(borderSealActors(g, ["ye"])).toEqual([]);
    g.machine.departmentBudgets.anomaly = 1;
    g.machine.rights.north = false;
    expect(borderSealActors(g, ["ye"])).toEqual([]);
  });
});
