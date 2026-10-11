import { describe, expect, it } from "vitest";
import {
  newV2,
  executeCommand,
  deserializeV2,
  serializeV2,
  milestones,
} from "./engine";
import {
  nationalForecast,
  settleFiscal,
  makeFunding,
  fundingPayments,
} from "./fiscal";
import { workSpecs, workOperating, workReadiness } from "./administration";
import { facilityStatus } from "./operations";
import { transportConditions } from "./qualifications";
import {
  hasCredential,
  trainingPreview,
  applyTraining,
  advanceTrainings,
} from "./training";
import { projectCandidate, specialistCapability } from "./traits";
import type { Action, FundingMode, V2Game, WorkType, Work } from "./model";

export function fixture() {
  const g = newV2("experimental", "spark", "v06-causal-fixture");
  g.core.treasury = 40;
  g.core.commands = 12;
  g.core.capital = 12;
  g.machine.matters = [];
  g.machine.backlog = [];
  g.machine.surveyed = true;
  g.machine.standards = true;
  g.machine.cooperation = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.machine.trust = { industry: 3, south: 3, north: 3 };
  g.machine.fiscal!.locals = { industry: 30, south: 30, north: 30 };
  g.machine.fiscal!.cultTreasury = 30;
  g.machine.fiscal!.agreements = ["industry", "south", "north"];
  g.core.policies.method = 1;
  g.core.policies.disclosure = 0;
  g.core.appointments["gov-south"] = "mo";
  return deserializeV2(serializeV2(g));
}
export function complete(
  g: V2Game,
  type: WorkType,
  mode: FundingMode = "central",
  pid: "south" | "industry" | "north" = "south",
  to?: "industry" | "north",
) {
  const w: Work = {
    id: `work-${g.core.nextId++}`,
    type,
    province: pid,
    to,
    completed: true,
    cancelled: false,
    assignment: "advisor" as const,
    paused: false,
    progress: workSpecs[type].duration,
    duration: workSpecs[type].duration,
    source: "fixture-construction",
    contract: makeFunding(g, {
      type: "project",
      project: type,
      province: pid,
      to,
      funding: mode,
      partner: "industry",
    }),
    maintenance: {
      turn: -1,
      fee: workSpecs[type].maintenance,
      due: 0,
      paid: 0,
      arrears: 0,
      payments: [],
      source: "fixture-construction",
    },
    ...(type === "grid" ? { network: { active: true, fault: false } } : {}),
  };
  g.machine.works.push(w);
  return w;
}
const run = (g: V2Game, a: Action) => {
  const r = executeCommand(g, a);
  expect(r.result.status, JSON.stringify(r.result)).not.toBe("failed");
  return r.game;
};
const money = (g: V2Game) =>
  g.core.treasury +
  Object.values(g.machine.fiscal!.locals).reduce((n, v) => n + v, 0) +
  g.machine.fiscal!.cultTreasury;

describe("v0.6 逐设施维护与真实经营", () => {
  it.each<FundingMode>(["central", "local", "joint", "multi", "cult"])(
    "%s合同正常履约后供能、税源、收入与储存一致",
    (mode) => {
      const g = fixture(),
        w = complete(g, "grid", mode, "south", "industry"),
        before = serializeV2(g),
        p = nationalForecast(g);
      expect(serializeV2(g)).toBe(before);
      expect(p.facilities[0].maintenance.arrears).toBe(0);
      const due = fundingPayments(w.contract!, 1, g.core.turn);
      expect(
        p.facilities[0].maintenance.payments.map((x) => ({
          account: x.account,
          amount: x.due,
        })),
      ).toEqual(due);
      expect(p.totalTax).toBe(11);
      settleFiscal(g, p, "settlement");
      expect(workOperating(g, w)).toBe(true);
      expect(deserializeV2(serializeV2(g))).toEqual(g);
    },
  );
  it.each<FundingMode>(["central", "local", "joint", "multi", "cult"])(
    "%s实际责任账户欠付立即停止供能和相关税源",
    (mode) => {
      const g = fixture(),
        w = complete(g, "grid", mode, "south", "industry");
      const payer = fundingPayments(w.contract!, 1, g.core.turn)[0].account;
      if (payer === "central") g.core.treasury = 0;
      else if (payer === "cult") g.machine.fiscal!.cultTreasury = 0;
      else g.machine.fiscal!.locals[payer] = 0;
      const p = nationalForecast(g);
      expect(p.facilities[0].maintenance.arrears).toBe(1);
      expect(p.totalTax).toBe(9);
      expect(p.entries.some((e) => e.reason.includes("投资收益"))).toBe(false);
      settleFiscal(g, p, "settlement");
      expect(facilityStatus(g, w).state).toBe("maintenance");
      expect(workOperating(g, w)).toBe(false);
      expect(deserializeV2(serializeV2(g))).toEqual(g);
    },
  );
  it("宗门欠付不由中央代付，正常地方设施仍经营", () => {
    const g = fixture(),
      grid = complete(g, "grid", "cult", "south", "industry"),
      plant = complete(g, "factory", "local", "industry");
    g.machine.fiscal!.cultTreasury = 0;
    const p = nationalForecast(g);
    settleFiscal(g, p, "settlement");
    expect(grid.maintenance!.arrears).toBe(1);
    expect(workOperating(g, plant)).toBe(true);
    expect(workOperating(g, grid)).toBe(false);
    expect(
      p.entries.filter(
        (e) =>
          e.category === "maintenance" &&
          e.source === grid.source &&
          e.from === "cult",
      ),
    ).toHaveLength(0);
  });
  it("本期收入不能倒填维护；明确补缴不追溯补发营业收入", () => {
    let g = fixture();
    const w = complete(g, "grid", "local", "south", "industry");
    g.machine.fiscal!.locals.south = 0;
    const p = nationalForecast(g);
    settleFiscal(g, p, "settlement");
    expect(p.locals.find((r) => r.province === "south")!.next).toBeGreaterThan(
      0,
    );
    expect(workOperating(g, w)).toBe(false);
    const total = money(g);
    g = run(g, { type: "maintain", work: w.id });
    expect(money(g)).toBe(total - 1);
    expect(workOperating(g, g.machine.works[0])).toBe(true);
    expect(g.machine.fiscal!.ledger[0].category).toBe("maintenance");
  });
  it("停运欠款结转到下期，由同一责任账户偿还", () => {
    const g = fixture(),
      w = complete(g, "grid", "local", "south", "industry");
    g.machine.fiscal!.locals.south = 0;
    settleFiscal(g, nationalForecast(g), "first");
    g.core.turn++;
    const p = nationalForecast(g);
    expect(p.facilities[0].maintenance.due).toBe(2);
    expect(p.facilities[0].maintenance.paid).toBe(1);
    expect(p.facilities[0].maintenance.arrears).toBe(1);
    expect(w.maintenance!.arrears).toBe(1);
  });
  it("明确接管维护保留产权、收益合同并实际支付", () => {
    let g = fixture();
    const w = complete(g, "grid", "local", "south", "industry");
    g.machine.fiscal!.locals.south = 0;
    settleFiscal(g, nationalForecast(g), "first");
    const contract = structuredClone(w.contract);
    g = run(g, { type: "maintenanceSponsor", work: w.id, account: "central" });
    expect(g.machine.works[0].contract).toEqual(contract);
    expect(g.machine.works[0].maintenance!.arrears).toBe(1);
    g = run(g, { type: "maintain", work: w.id });
    expect(workOperating(g, g.machine.works[0])).toBe(true);
    expect(g.machine.works[0].contract!.owner).toBe("south");
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
  it.each<WorkType>(["rail", "factory", "port", "academy"])(
    "%s欠付失去真实运行资格",
    (type) => {
      const g = fixture(),
        w = complete(g, type, "local", "south", "industry");
      g.machine.fiscal!.locals.south = 0;
      settleFiscal(g, nationalForecast(g), "payment");
      expect(workOperating(g, w)).toBe(false);
      expect(facilityStatus(g, w).reason).toMatch(/维护欠付/);
    },
  );
  it("无维护设施不受账户不足影响，但隔离仍中断运行", () => {
    const g = fixture(),
      w = complete(g, "energy", "central");
    g.core.treasury = 0;
    settleFiscal(g, nationalForecast(g), "payment");
    expect(workOperating(g, w)).toBe(true);
    g.machine.matters.push({
      id: "isolation",
      province: "south",
      kind: "accident",
      title: "隔离",
      description: "",
      stage: 1,
      age: 0,
      containment: 1,
      isolated: true,
      evacuated: true,
    });
    expect(workOperating(g, w)).toBe(false);
  });
  it("实际回合产出不发放欠付工厂的生产加成", () => {
    let g = fixture();
    complete(g, "factory", "local", "industry");
    g.machine.fiscal!.locals.industry = 0;
    const old = g.core.provinces.find((p) => p.id === "industry")!.stock;
    g = run(g, { type: "end" });
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(
      old + 2,
    );
  });
  it("星火目标读取供能，不认可竣工但欠付电网", () => {
    const g = fixture(),
      w = complete(g, "grid", "local", "south", "industry");
    expect(milestones(g, "spark")[2].met).toBe(true);
    g.machine.fiscal!.locals.south = 0;
    settleFiscal(g, nationalForecast(g), "payment");
    expect(milestones(g, "spark")[2].met).toBe(false);
    expect(w.completed).toBe(true);
  });
});

describe("v0.6 行动与目标的共享资格", () => {
  it("计划主管离岗后运输能力和交通目标同步失效；正式兼职同步恢复", () => {
    let g = fixture();
    complete(g, "rail", "central", "south", "industry");
    complete(g, "port", "central", "south");
    complete(g, "grid", "central", "south", "industry");
    g.machine.regime = "joint";
    expect(
      transportConditions(g, "south", "industry").every((c) => c.met),
    ).toBe(true);
    expect(milestones(g, "traffic")[2].met).toBe(true);
    g = run(g, { type: "appoint", office: "plan", person: null });
    g = run(g, { type: "appoint", office: "gov-industry", person: "lin" });
    expect(
      transportConditions(g, "south", "industry").every((c) => c.met),
    ).toBe(false);
    expect(milestones(g, "traffic")[2].met).toBe(false);
    g = run(g, { type: "concurrent", office: "plan", person: "lin" });
    expect(
      transportConditions(g, "south", "industry").every((c) => c.met),
    ).toBe(true);
    expect(milestones(g, "traffic")[2].met).toBe(true);
    expect(
      transportConditions(deserializeV2(serializeV2(g)), "south", "industry"),
    ).toEqual(transportConditions(g, "south", "industry"));
  });
  it("网络能力不要求本次库存，但实际运输还检查库存与命令", () => {
    const g = fixture();
    complete(g, "rail", "central", "south", "industry");
    g.core.provinces.find((p) => p.id === "south")!.stock = 0;
    expect(
      transportConditions(g, "south", "industry").every((c) => c.met),
    ).toBe(true);
    expect(
      executeCommand(g, {
        type: "transfer",
        from: "south",
        to: "industry",
        amount: 3,
      }).result.status,
    ).toBe("failed");
  });
});

const course = (
  method: "field" | "academy" = "field",
): Extract<Action, { type: "train" }> => ({
  type: "train",
  mentor: "mo",
  student: "taoqi",
  cap: "leywork",
  province: "south",
  method,
  facility: undefined,
});
const ticks = (g: V2Game, n: number) => {
  for (let i = 0; i < n; i++) {
    advanceTrainings(g, () => {});
    g.core.turn++;
    g.machine.occupied = {};
  }
  return g;
};
describe("v0.6 指定学员与真实传承", () => {
  it("三期基层培养只授予指定学员，不瞬间或全局共享", () => {
    let g = fixture();
    g = run(g, course());
    expect(hasCredential(g, "taoqi", "leywork")).toBe(false);
    ticks(g, 2);
    expect(hasCredential(g, "taoqi", "leywork")).toBe(false);
    ticks(g, 1);
    expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
    expect(hasCredential(g, "zhou", "leywork")).toBe(false);
    expect(g.machine.trainings![0].mentor).toBe("mo");
  });
  it("学院降低实际费用、教材及培养周期，并有两人容量", () => {
    const g = fixture(),
      academy = complete(g, "academy", "local");
    const field = trainingPreview(g, course()),
      school = trainingPreview(g, {
        ...course("academy"),
        facility: academy.id,
      });
    expect(field.costs.treasury).toBe(2);
    expect(school.costs.treasury).toBe(1);
    expect(field.costs.stock).toBe(1);
    expect(school.costs.stock).toBe(0);
    applyTraining(g, { ...course("academy"), facility: academy.id }, "school");
    ticks(g, 2);
    expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
  });
  it("导师专职抽调会暂停，解除后保留进度并恢复", () => {
    const g = fixture();
    applyTraining(g, course(), "course");
    ticks(g, 1);
    g.machine.works.push({
      ...complete(g, "warning"),
      id: "assignment",
      completed: false,
      worker: "mo",
      assignment: "dedicated",
    });
    ticks(g, 1);
    expect(g.machine.trainings![0]).toMatchObject({
      progress: 1,
      state: "paused",
    });
    g.machine.works = g.machine.works.filter((w) => w.id !== "assignment");
    ticks(g, 2);
    expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
  });
  it("学院欠付暂停相关课程；基层教习仍有自己的合法渠道", () => {
    const g = fixture(),
      academy = complete(g, "academy", "local");
    applyTraining(g, { ...course("academy"), facility: academy.id }, "school");
    g.machine.fiscal!.locals.south = 0;
    settleFiscal(g, nationalForecast(g), "maintenance");
    ticks(g, 1);
    expect(g.machine.trainings![0]).toMatchObject({
      progress: 0,
      state: "paused",
    });
    expect(g.machine.trainings![0].reason).toMatch(/学院/);
  });
  it("完成后原导师离任不消除个人资质；继任者合法接替工程及目标", () => {
    let g = fixture();
    g = run(g, course());
    ticks(g, 3);
    g = run(g, { type: "appoint", office: "gov-south", person: "taoqi" });
    expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
    expect(projectCandidate(g, "taoqi", "grid", "south")).toBe(true);
    expect(specialistCapability(g, "leywork", "south")).toContain("taoqi");
    expect(milestones(g, "spark")[0].met).toBe(true);
    expect(
      workReadiness(g, {
        ...complete(g, "grid", "central", "south", "industry"),
        completed: false,
        worker: "taoqi",
        assignment: "advisor",
      }).every((c) => c.met),
    ).toBe(true);
  });
  it("已受训学员的当前占用仍阻止能力使用", () => {
    const g = fixture();
    applyTraining(g, course(), "course");
    ticks(g, 3);
    g.core.appointments["gov-south"] = "taoqi";
    g.machine.occupied.taoqi = "other-duty";
    expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
    expect(projectCandidate(g, "taoqi", "grid", "south")).toBe(false);
    expect(specialistCapability(g, "leywork", "south")).not.toContain("taoqi");
  });
  it("重复课程和重复资格不可刷取，记录与进度无损保存", () => {
    let g = fixture();
    g = run(g, course());
    expect(executeCommand(g, course()).result.status).toBe("failed");
    ticks(g, 3);
    expect(executeCommand(g, course()).result.status).toBe("failed");
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
  it("取消课程释放容量，保留历史但不退款", () => {
    let g = fixture();
    g = run(g, course());
    const total = money(g),
      id = g.machine.trainings![0].id;
    g = run(g, { type: "trainingControl", training: id, operation: "cancel" });
    expect(money(g)).toBe(total);
    expect(g.machine.trainings![0].state).toBe("cancelled");
    expect(hasCredential(g, "taoqi", "leywork")).toBe(false);
  });
});

describe("v0.6 旧档迁移与损坏拒绝", () => {
  it("旧教习保留历史而不虚构导师、学员或全球资质", () => {
    const g = fixture();
    g.machine.rulesVersion = "0.5.0";
    delete g.machine.trainings;
    delete g.machine.regionFeatures;
    delete g.machine.relationships;
    g.machine.milestones.push("training:leywork");
    const n = deserializeV2(serializeV2(g));
    expect(n.machine.trainings![0]).toMatchObject({
      state: "unassigned",
      method: "legacy",
    });
    expect(n.machine.trainings![0].mentor).toBeUndefined();
    expect(hasCredential(n, "taoqi", "leywork")).toBe(false);
    const restored = run(n, {
      type: "legacyTraining",
      training: n.machine.trainings![0].id,
      student: "taoqi",
    });
    expect(hasCredential(restored, "taoqi", "leywork")).toBe(true);
    expect(hasCredential(restored, "zhou", "leywork")).toBe(false);
  });
  it.each(["trainings", "regionFeatures", "relationships"])(
    "当前版本缺%s不静默重建",
    (field) => {
      const raw = JSON.parse(serializeV2(fixture()));
      delete raw.machine[field];
      expect(() => deserializeV2(JSON.stringify(raw))).toThrow();
    },
  );
  it("当前设施维护记录缺失或金额损坏不静默修复", () => {
    const g = fixture();
    complete(g, "grid", "local", "south", "industry");
    const raw = JSON.parse(serializeV2(g));
    delete raw.machine.works[0].maintenance;
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow(/维护/);
    raw.machine.works[0].maintenance = {
      ...g.machine.works[0].maintenance,
      arrears: 2,
    };
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow(/维护/);
  });
});

import { startSuccessionDemo, demoPhase, demoGrid } from "./demonstration";
import { conditionEvents } from "./conditionEvents";
import { regionalActions, cooperationLink } from "./regionalActions";
import { discoverFeature } from "./regions";
import { explorationPool } from "./exploration";
import { startCampaign, openingValidity, previewAction } from "./engine";
import { officePerson, assignmentsFor } from "./personnel";

describe("v0.6 地域、组织与条件事件", () => {
  it("已知地域特征决定可见机会，新发现灵脉不依赖省份白名单", () => {
    const g = fixture();
    expect(
      regionalActions(g, "industry", "south").some((a) => a.id === "ley"),
    ).toBe(false);
    discoverFeature(g, "industry", "leyline", "survey-record");
    expect(
      regionalActions(g, "industry", "south").some((a) => a.id === "ley"),
    ).toBe(true);
    expect(
      previewAction(g, {
        type: "investigate",
        deck: "ley",
        province: "industry",
      }).errors,
    ).toEqual([]);
    expect(
      conditionEvents(g).some(
        (e) => e.province === "industry" && e.panel === "local",
      ),
    ).toBe(true);
  });
  it("三省共享本地治理入口，跨省操作携带两端与真实运输条件", () => {
    const g = fixture();
    for (const pid of ["industry", "south", "north"] as const) {
      const rows = regionalActions(g, pid, pid === "south" ? "north" : "south");
      expect(rows.filter((r) => r.group === "local").map((r) => r.id)).toEqual([
        "warning",
        "resources",
        "audit",
        "anomaly",
        "agreement",
        "exercise",
      ]);
      expect(rows.find((r) => r.id === "transfer")!.scope).toHaveLength(2);
      expect(
        executeCommand(g, rows.find((r) => r.id === "transfer")!.action).result
          .status,
      ).toBe("failed");
    }
  });
  it("调查牌池按真实特征加权，读档不重新生成地理或随机数", () => {
    const g = fixture();
    expect(
      explorationPool(g, "north").filter((x) => x === "dream").length,
    ).toBeGreaterThan(
      explorationPool(g, "industry").filter((x) => x === "dream").length,
    );
    const action: Action = {
      type: "survey",
      province: "industry",
      field: "resources",
    };
    expect(run(g, action)).toEqual(run(deserializeV2(serializeV2(g)), action));
  });
  it("正式兼职与专职派遣同步改变组织岗位、可用调度和条件事件", () => {
    let g = fixture();
    g = run(g, { type: "appoint", office: "gov-industry", person: null });
    g = run(g, { type: "concurrent", office: "gov-industry", person: "lin" });
    expect(officePerson(g, "gov-industry")).toBe("lin");
    const w = complete(g, "factory", "central", "industry");
    w.completed = false;
    w.worker = "lin";
    w.assignment = "dedicated";
    expect(assignmentsFor(g, "lin").adminAvailable).toBe(false);
    expect(
      conditionEvents(g).some((e) => e.id === "position:gov-industry"),
    ).toBe(true);
    expect(
      transportConditions(g, "south", "industry").find((c) =>
        c.label.includes("计划"),
      )!.met,
    ).toBe(false);
  });
  it("合作加速只来自真实已完成联合项目且匹配现任双方", () => {
    const g = fixture();
    expect(cooperationLink(g, "south")).toBeUndefined();
    g.machine.relationships!.push({
      id: "real-joint-project",
      kind: "cooperation",
      actors: ["lin", "mo"],
      institutions: ["plan", "gov-south"],
      source: "finished-project",
      turn: 1,
      province: "south",
    });
    expect(cooperationLink(g, "south")?.source).toBe("finished-project");
    g.core.appointments["gov-south"] = "zhou";
    expect(cooperationLink(g, "south")).toBeUndefined();
  });
  it("设施欠付与课程受阻生成真实可处理提醒，消除原因后提醒撤回", () => {
    const g = fixture(),
      academy = complete(g, "academy", "local");
    applyTraining(
      g,
      {
        type: "train",
        mentor: "mo",
        student: "taoqi",
        cap: "leywork",
        province: "south",
        method: "academy",
        facility: academy.id,
      },
      "course",
    );
    g.machine.fiscal!.locals.south = 0;
    settleFiscal(g, nationalForecast(g), "settle");
    expect(conditionEvents(g).map((e) => e.panel)).toContain("finance");
    expect(conditionEvents(g).map((e) => e.panel)).toContain("staff");
    g.machine.fiscal!.locals.south = 3;
    g.machine.occupied = {};
    const n = run(g, { type: "maintain", work: academy.id });
    expect(conditionEvents(n)).toEqual([]);
  });
  it("100个新种子覆盖不同税制、正式兼职、产权与合法开局，存读无损", () => {
    const tax = new Set(),
      contracts = new Set();
    let sides = 0;
    for (let i = 0; i < 100; i++) {
      const g = startCampaign({
        mode: "experimental",
        seed: `v06-opening-${i}`,
        difficulty: "standard",
        politics: "random",
      });
      expect(openingValidity(g).every((c) => c.met)).toBe(true);
      tax.add(g.machine.fiscal!.taxSystem);
      for (const w of g.machine.works) contracts.add(w.contract!.owner);
      if (Object.keys(g.machine.secondaryAppointments!).length) sides++;
      expect(deserializeV2(serializeV2(g))).toEqual(g);
    }
    expect(tax.size).toBe(3);
    expect(contracts.size).toBeGreaterThan(2);
    expect(sides).toBeGreaterThan(0);
  });
});

describe("v0.6 南岭工程与人才接班：五合同实际十二回合演示", () => {
  it.each<FundingMode>(["central", "local", "joint", "multi", "cult"])(
    "%s：签约→学院继任→真实欠费→恢复运行→全国验收",
    (funding) => {
      let g = startSuccessionDemo();
      expect(demoPhase(g)).toBe(1);
      const initial = money(g);
      g = run(g, {
        type: "project",
        project: "grid",
        province: "south",
        to: "industry",
        partner: "industry",
        worker: "linruoxu",
        assignment: "dedicated",
        funding,
      });
      g = run(g, {
        type: "train",
        mentor: "mo",
        student: "taoqi",
        cap: "leywork",
        province: "south",
        method: "academy",
        facility: g.machine.works.find((w) => w.type === "academy")!.id,
      });
      expect(demoPhase(g)).toBe(2);
      g = run(g, { type: "end" });
      g = run(g, { type: "end" });
      expect(demoGrid(g)!.completed).toBe(true);
      expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
      expect(demoPhase(g)).toBe(3);
      const before = money(g),
        contract = structuredClone(demoGrid(g)!.contract);
      g = run(g, { type: "demoReserve" });
      expect(money(g)).toBe(before);
      expect(
        g.machine.fiscal!.ledger.find(
          (e) => e.reason === "演示：应急准备金调拨",
        )!.category,
      ).toBe("transfer");
      g = run(g, { type: "end" });
      expect(g.machine.demonstration!.failed).toBe(true);
      expect(workOperating(g, demoGrid(g)!)).toBe(false);
      expect(
        milestones(g).find((c) => c.label === "南岭能源工程竣工")!.met,
      ).toBe(false);
      if (funding === "central" || funding === "multi") {
        g = run(g, {
          type: "fiscalTransfer",
          province: "industry",
          direction: "levy",
          amount: 5,
        });
        g = run(g, { type: "end" });
      } else {
        g = run(g, {
          type: "maintenanceSponsor",
          work: demoGrid(g)!.id,
          account: "central",
        });
        g = run(g, { type: "maintain", work: demoGrid(g)!.id });
      }
      if (funding === "multi")
        g = run(g, {
          type: "maintenanceSponsor",
          work: demoGrid(g)!.id,
          account: "central",
        });
      expect(demoGrid(g)!.contract).toEqual(contract);
      // Qualification comes from the named completed student; the old mentor really leaves the role.
      g = run(g, { type: "appoint", office: "gov-south", person: "taoqi" });
      expect(officePerson(g, "gov-south")).toBe("taoqi");
      expect(specialistCapability(g, "leywork", "south")).toContain("taoqi");
      while (g.core.turn < 12) {
        if (g.core.treasury < 10 && g.core.turn !== 10) {
          g = run(g, {
            type: "fiscalTransfer",
            province: "industry",
            direction: "levy",
            amount: 5,
          });
          g = run(g, { type: "end" });
          continue;
        }
        const w = demoGrid(g)!;
        if (w.network?.fault) {
          if (
            !["central", "joint"].includes(w.contract!.owner) &&
            (w.network.consentUntil ?? -1) < g.core.turn
          ) {
            g = run(g, { type: "network", work: w.id, operation: "consent" });
            g = run(g, { type: "end" });
            continue;
          }
          g = run(g, { type: "network", work: w.id, operation: "repair" });
        }
        if (g.core.turn === 10) g = run(g, { type: "inspect" });
        g = deserializeV2(serializeV2(run(g, { type: "end" })));
        expect(g.core.status).toBe("playing");
      }
      expect(demoPhase(g)).toBe(4);
      expect(milestones(g).every((c) => c.met)).toBe(true);
      const final = g.machine.matters.find((m) => m.kind === "final")!;
      g = run(g, { type: "resolve", matter: final.id, option: "activate" });
      g = run(g, { type: "end" });
      expect(g.core.status).toBe("won");
      expect(money(g)).not.toBe(initial);
      expect(g.machine.history.some((h) => h.title.includes("培养完成"))).toBe(
        true,
      );
    },
  );
});

describe("v0.6 进一步交叉约束", () => {
  it("导师更换不能绕过现有基层师资容量", () => {
    const g = fixture();
    g.core.appointments.anomaly = "bai";
    applyTraining(g, course(), "mo-course");
    applyTraining(
      g,
      { ...course(), mentor: "bai", student: "yunsong" },
      "bai-course",
    );
    const t = g.machine.trainings![1];
    t.state = "paused";
    const p = trainingPreview(g, {
      type: "trainingControl",
      training: t.id,
      operation: "resume",
      mentor: "mo",
    });
    expect(p.conditions.find((c) => c.label === "替任导师教学容量")!.met).toBe(
      false,
    );
  });
  it("当前存档拒绝超容量课程而不丢弃记录", () => {
    const g = fixture();
    applyTraining(g, course(), "course");
    applyTraining(g, { ...course(), student: "yunsong" }, "second-course");
    expect(() => deserializeV2(serializeV2(g))).toThrow(/容量/);
  });
  it("新工业受益地区的电网税源和实物正确落在实际端点", () => {
    const g = fixture();
    discoverFeature(g, "north", "industrial", "discovered-industry");
    const w = complete(g, "grid", "central", "south", "north");
    const p = nationalForecast(g);
    expect(p.locals.find((r) => r.province === "north")!.taxGross).toBe(5);
    expect(p.locals.find((r) => r.province === "industry")!.taxGross).toBe(3);
    const noGrid = structuredClone(g);
    noGrid.machine.works = [];
    const actual = run(g, { type: "end" }),
      base = run(noGrid, { type: "end" });
    expect(
      actual.core.provinces.find((p) => p.id === "north")!.stock -
        base.core.provinces.find((p) => p.id === "north")!.stock,
    ).toBe(2);
    expect(w.contract!.beneficiary).toBe("north");
  });
  it("港口地理条件与调查记录分别检查，不能只靠路线调查开港", () => {
    const g = fixture();
    g.machine.regionFeatures!.industry = ["industrial", "civic"];
    g.machine.discoveries.industry.push("routes");
    const p = previewAction(g, {
      type: "project",
      project: "port",
      province: "industry",
      worker: "luchaosheng",
      assignment: "dedicated",
    });
    expect(
      p.conditions.find((c) => c.label === "港湾或浮空航线基础")!.met,
    ).toBe(false);
    discoverFeature(g, "industry", "coastal", "survey");
    expect(
      previewAction(g, p.action).conditions.find(
        (c) => c.label === "港湾或浮空航线基础",
      )!.met,
    ).toBe(true);
  });
});

describe("v0.6 演示中的不同继任选择", () => {
  it("基层培养云松使用三个实际周期，改任后只有本人接替工程", () => {
    let g = startSuccessionDemo();
    g = run(g, {
      type: "project",
      project: "grid",
      province: "south",
      to: "industry",
      worker: "linruoxu",
      assignment: "dedicated",
      funding: "central",
    });
    g = run(g, {
      type: "train",
      mentor: "mo",
      student: "yunsong",
      cap: "leywork",
      province: "south",
      method: "field",
    });
    g = run(g, { type: "end" });
    g = run(g, { type: "end" });
    expect(hasCredential(g, "yunsong", "leywork")).toBe(false);
    g = run(g, { type: "end" });
    expect(hasCredential(g, "yunsong", "leywork")).toBe(true);
    expect(hasCredential(g, "taoqi", "leywork")).toBe(false);
    g = run(g, { type: "appoint", office: "gov-south", person: "yunsong" });
    expect(specialistCapability(g, "leywork", "south")).toContain("yunsong");
    expect(specialistCapability(g, "leywork", "south")).not.toContain("taoqi");
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
});
