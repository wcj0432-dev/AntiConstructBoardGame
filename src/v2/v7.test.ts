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
import {
  advisorAction,
  advisorIssues,
  advisorOpening,
  advisorTurnReport,
  guidanceTopic,
  markAdvisorRead,
} from "./advisor";
import {
  branchCatalog,
  communicationReady,
  contractSignature,
  lawAuthority,
  realmIds,
  validLawRecord,
} from "./nationalStrategy";
import { facilityOperating } from "./operations";
import { makeFunding, nationalForecast, settleFiscal } from "./fiscal";
import { workSpecs } from "./administration";
import { hasCredential } from "./training";
import { politicalStories } from "./politicalStories";
import { expansionDesign } from "./expansion";
import { runV7Campaign } from "../../scripts/v7-campaigns";
import type {
  Action,
  FundingMode,
  Goal,
  V2Game,
  Work,
  WorkType,
} from "./model";
import type { ProvinceId } from "../types";
// Isolated high-resource condition fixtures below are not campaign/balance evidence.
function fixture(
  goal: Goal = "codex",
  branch: "central" | "plural" = "plural",
) {
  let g = newV2("experimental", goal, "v07-condition-fixture");
  g.core.treasury = 40;
  g.core.commands = 12;
  g.core.capital = 20;
  g.machine.matters = [];
  g.machine.backlog = [];
  g.machine.cooperation = true;
  g.machine.surveyed = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.machine.trust = { industry: 3, south: 3, north: 3 };
  g.machine.fiscal!.agreements = [...realmIds];
  g.machine.fiscal!.locals = { industry: 40, south: 40, north: 40 };
  g.core.policies.method = 1;
  g.core.policies.disclosure = 0;
  g = run(g, { type: "strategyBranch", branch });
  return g;
}
function run(g: V2Game, a: Action) {
  const r = executeCommand(g, a);
  expect(r.result.errors, JSON.stringify(a)).toEqual([]);
  return r.game;
}
function asset(
  g: V2Game,
  type: WorkType,
  pid: ProvinceId = "south",
  funding: FundingMode = "central",
) {
  const w: Work = {
    id: `work-${g.core.nextId++}`,
    type,
    province: pid,
    progress: workSpecs[type].duration,
    duration: workSpecs[type].duration,
    completed: true,
    paused: false,
    cancelled: false,
    assignment: "advisor",
    source: "fixture-real-contract",
    contract: makeFunding(g, {
      type: "project",
      project: type,
      province: pid,
      funding,
    }),
    maintenance: {
      turn: -1,
      fee: workSpecs[type].maintenance,
      due: 0,
      paid: 0,
      arrears: 0,
      payments: [],
      source: "fixture-real-contract",
    },
    ...(type === "grid"
      ? { to: "industry" as const, network: { active: true, fault: false } }
      : {}),
  };
  g.machine.works.push(w);
  return w;
}
describe("v0.7 正式任期秘书与事实一致性", () => {
  it("正式开局介绍；主题独立、乱序阅读、跳过不改变游戏规则状态", () => {
    const g = startCampaign({
      mode: "national",
      seed: "guide-order",
      difficulty: "standard",
      politics: "classic",
    });
    expect(guidanceTopic(g, undefined, "full")).toBe("welcome");
    let n = markAdvisorRead(g, "finance");
    n = markAdvisorRead(n, "welcome");
    expect(guidanceTopic(n, "staff", "full")).toBe("staff");
    n = markAdvisorRead(n, "staff");
    expect(guidanceTopic(n, "staff", "full")).toBeUndefined();
    expect(n.core).toEqual(g.core);
    expect(n.machine.revision).toBe(g.machine.revision);
    expect(n.machine.history).toEqual(g.machine.history);
    expect(g.machine.advisor!.seen).toEqual([]);
    expect(deserializeV2(serializeV2(n))).toEqual(n);
  });
  it.each(["manual", "off"] as const)(
    "%s关闭主动提示，但手动事实查询保持可用",
    (mode) => {
      const g = fixture();
      expect(guidanceTopic(g, "staff", mode)).toBeUndefined();
      expect(advisorOpening(g).length).toBeGreaterThan(0);
      expect(advisorIssues(g).length).toBeLessThanOrEqual(5);
    },
  );
  it("原教学和接班剧本不被正式任期秘书引导拦截", () => {
    const g = newV2("tutorial");
    expect(guidanceTopic(g, undefined, "full")).toBeUndefined();
    const n = fixture();
    n.machine.demonstration = { id: "succession", failed: false };
    expect(guidanceTopic(n, undefined, "full")).toBeUndefined();
  });
  it("财政提示是逐设施真实预测，读取不消耗RNG或改变账本", () => {
    const g = fixture();
    const w = asset(g, "relay");
    g.core.treasury = 0;
    const before = serializeV2(g),
      f = nationalForecast(g),
      issues = advisorIssues(g);
    expect(f.facilities.find((r) => r.work === w.id)!.maintenance.arrears).toBe(
      1,
    );
    expect(issues.some((x) => x.id === `next:${w.id}`)).toBe(true);
    expect(serializeV2(g)).toBe(before);
  });
  it("当前设施欠付恢复后旧提醒消失，未来预测同步", () => {
    let g = fixture();
    const w = asset(g, "relay");
    w.maintenance = {
      turn: 1,
      fee: 1,
      due: 1,
      paid: 0,
      arrears: 1,
      payments: [{ account: "central", due: 1, paid: 0, arrears: 1 }],
      source: "actual-unpaid",
    };
    expect(advisorIssues(g).some((x) => x.id === `maintenance:${w.id}`)).toBe(
      true,
    );
    g = run(g, { type: "maintain", work: w.id });
    expect(advisorIssues(g).some((x) => x.id === `maintenance:${w.id}`)).toBe(
      false,
    );
    expect(facilityOperating(g, g.machine.works[0])).toBe(true);
  });
  it("专职占用、人事摘要及受阻解释与执行预览完全一致", () => {
    const g = fixture();
    g.machine.works.push({
      id: "dedicated",
      type: "rail",
      province: "south",
      to: "north",
      worker: "lin",
      assignment: "dedicated",
      progress: 0,
      duration: 3,
      paused: false,
      completed: false,
      source: "dispatch-fixture",
    });
    const a: Action = {
      type: "coordinate",
      province: "south",
      kind: "agreement",
    };
    expect(advisorIssues(g).some((x) => x.id === "office:plan")).toBe(true);
    expect(advisorAction(g, a).preview).toEqual(previewAction(g, a));
    expect(advisorAction(g, a).facts).toEqual(previewAction(g, a).errors);
  });
  it("没有实际结算时不伪造回合流水，执行结算后有真实账目", () => {
    let g = fixture();
    expect(advisorTurnReport(g).factual).toBe(false);
    g = run(g, { type: "end" });
    const r = advisorTurnReport(g);
    expect(r.factual).toBe(true);
    expect(r.ledger.length).toBeGreaterThan(0);
    expect(r.ledger.every((e) => e.turn === r.turn)).toBe(true);
  });
});
describe("v0.7 十六分支与真实能力", () => {
  it.each(Object.keys(branchCatalog) as Goal[])(
    "%s的两个方向互斥且选择不重复授予资源/设施",
    (goal) => {
      for (const branch of ["central", "plural"] as const) {
        const g = fixture(goal, branch),
          before = serializeV2(g);
        expect(g.machine.strategy!.branch).toBe(branch);
        const r = executeCommand(g, {
          type: "strategyBranch",
          branch: branch === "central" ? "plural" : "central",
        });
        expect(r.result.status).toBe("failed");
        expect(serializeV2(r.game)).toBe(before);
        expect(g.machine.works).toHaveLength(0);
        expect(deserializeV2(before)).toEqual(g);
      }
    },
  );
  it.each(["spark", "traffic", "learning"] as const)(
    "%s融资分支实际改变行动资格，不改写原产权",
    (goal) => {
      const central = fixture(goal, "central"),
        plural = fixture(goal, "plural");
      const project =
        goal === "spark" ? "grid" : goal === "traffic" ? "rail" : "academy";
      const a: Action = {
        type: "project",
        project,
        province: "south",
        to: "industry",
        worker: "mo",
        funding: "local",
      };
      expect(
        previewAction(central, a).conditions.find(
          (c) => c.label === "战略确定的融资路径",
        )?.met,
      ).toBe(false);
      expect(
        previewAction(plural, a).conditions.find(
          (c) => c.label === "战略确定的融资路径",
        )?.met,
      ).toBe(true);
    },
  );
  it("财政分支改变税制可行性；不把地方资金当中央财富", () => {
    const a = fixture("prosperity", "central"),
      b = fixture("prosperity", "plural");
    expect(
      previewAction(a, {
        type: "fiscalReform",
        system: "autonomy",
      }).conditions.find((c) => c.label === "财政战略的税源安排")?.met,
    ).toBe(false);
    expect(
      previewAction(b, {
        type: "fiscalReform",
        system: "central",
      }).errors.join(),
    ).toContain("财政战略");
    expect(a.machine.fiscal!.locals).toEqual(b.machine.fiscal!.locals);
  });
  it("夜防公开和秘密分支检验不同实际政策与机构", () => {
    const a = fixture("night", "central"),
      b = fixture("night", "plural");
    a.machine.departments.anomaly = [...realmIds];
    expect(milestones(a).at(-1)!.met).toBe(true);
    a.core.policies.disclosure = 1;
    expect(milestones(a).at(-1)!.met).toBe(false);
    b.core.policies.disclosure = 1;
    b.core.appointments["gov-north"] = "xing";
    b.core.appointments["gov-south"] = "ye";
    b.machine.departments.evacuation = [...realmIds];
    expect(milestones(b).at(-1)!.met).toBe(true);
  });
});
it("终局通过后不能追认战略分支来绕过验收", () => {
  const g = newV2("experimental", "spark");
  g.machine.finalDone = true;
  expect(
    executeCommand(g, { type: "strategyBranch", branch: "central" }).result
      .status,
  ).toBe("failed");
});
describe("v0.7 万象法典：登记、合同与实际维修权", () => {
  it("登记三省真实合同，停运/合同更改使里程碑失效，不能凭花费资本完成", () => {
    let g = fixture();
    expect(milestones(g)[1].met).toBe(false);
    for (const pid of realmIds) {
      const w = asset(g, "warning", pid);
      g = run(g, { type: "lawRegister", province: pid, work: w.id });
    }
    expect(milestones(g).every((c) => c.met)).toBe(true);
    const w = g.machine.works[0];
    const signature = contractSignature(g, w);
    w.contract!.owner = "cult";
    expect(contractSignature(g, w)).not.toBe(signature);
    expect(validLawRecord(g, w.province)).toBeUndefined();
    expect(milestones(g)[1].met).toBe(false);
  });
  it("已登记的地方电网允许依法技术维修，仍不允许中央擅自停机", () => {
    let g = fixture();
    g.core.appointments["gov-south"] = "mo";
    const w = asset(g, "grid", "south", "local");
    g = run(g, { type: "lawRegister", province: "south", work: w.id });
    const current = g.machine.works[0];
    current.network!.fault = true;
    expect(lawAuthority(g, current)).toBe(true);
    expect(
      previewAction(g, { type: "network", work: w.id, operation: "close" })
        .errors.length,
    ).toBeGreaterThan(0);
    g = run(g, { type: "network", work: w.id, operation: "repair" });
    expect(g.machine.works[0].network!.fault).toBe(false);
    expect(g.machine.works[0].contract!.owner).toBe("south");
  });
  it("法域不能绕过债务、签约代表、预算或中央阻塞", () => {
    let g = fixture("codex", "central");
    g.machine.regime = "vertical";
    g.machine.departments.anomaly = [...realmIds];
    const w = asset(g, "warning");
    g = run(g, { type: "lawRegister", province: "south", work: w.id });
    const current = g.machine.works[0];
    expect(lawAuthority(g, current)).toBe(true);
    g.machine.departmentBudgets.plan = 0;
    expect(lawAuthority(g, current)).toBe(false);
    g.machine.departmentBudgets.plan = 1;
    g.core.paralysis = 2;
    expect(lawAuthority(g, current)).toBe(false);
    g.core.paralysis = 0;
    g.machine.fiscal!.agreements = [];
    expect(lawAuthority(g, current)).toBe(false);
  });
  it("重复登记同一合同失败且无资源变化", () => {
    let g = fixture();
    const w = asset(g, "warning");
    g = run(g, { type: "lawRegister", province: "south", work: w.id });
    const before = serializeV2(g),
      r = executeCommand(g, {
        type: "lawRegister",
        province: "south",
        work: w.id,
      });
    expect(r.result.status).toBe("failed");
    expect(serializeV2(r.game)).toBe(before);
  });
});
describe("v0.7 寰宇通讯：节点、韧性与统一授权", () => {
  it("集中枢纽停运中断全部远程指令，分布网络保留其他地方节点", () => {
    for (const branch of ["central", "plural"] as const) {
      const g = fixture("comms", branch);
      for (const pid of realmIds) asset(g, "relay", pid);
      expect(communicationReady(g, "south")).toBe(true);
      g.machine.works.find(
        (w) => w.province === "industry",
      )!.maintenance!.arrears = 1;
      expect(communicationReady(g, "south")).toBe(branch === "plural");
      expect(communicationReady(g, "industry")).toBe(false);
    }
  });
  it("中央阻塞不阻断分布式本地指令，但当地负责人被专职抽调后会阻断", () => {
    const g = fixture("comms", "plural");
    asset(g, "relay");
    g.core.paralysis = 3;
    expect(communicationReady(g, "south")).toBe(true);
    g.machine.occupied.xing = "real-task";
    expect(communicationReady(g, "south")).toBe(false);
  });
  it("通信确实传达本回合授权，重复记录被拒绝，未自动解决事务", () => {
    let g = fixture("comms", "plural");
    asset(g, "relay");
    const matter = {
      id: "real-test-matter",
      title: "真实地方事务",
      description: "",
      province: "south" as const,
      kind: "accident" as const,
      stage: 2,
      containment: 0,
      evacuated: false,
      isolated: false,
      age: 0,
    };
    g.machine.matters.push(matter);
    g = run(g, { type: "dispatch", matter: matter.id });
    expect(g.machine.authorization[matter.id]).toMatchObject({
      lead: "gov-south",
      joint: true,
      emergency: false,
      expires: g.core.turn,
    });
    expect(g.machine.matters[0].stage).toBe(2);
    expect(
      executeCommand(g, { type: "dispatch", matter: matter.id }).result.status,
    ).toBe("failed");
    expect(g.machine.strategy!.dispatches).toHaveLength(1);
  });
  it("节点真实付费，单节点欠付只关闭该节点；补缴恢复，预览与结算一致", () => {
    let g = fixture("comms", "plural");
    const w = asset(g, "relay", "south", "local");
    g.machine.fiscal!.locals.south = 0;
    const forecast = nationalForecast(g);
    settleFiscal(g, forecast, "real-settlement");
    expect(g.machine.works[0].maintenance!.arrears).toBeGreaterThan(0);
    expect(communicationReady(g, "south")).toBe(false);
    g = run(g, {
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 5,
    });
    g = run(g, { type: "maintain", work: w.id });
    expect(communicationReady(g, "south")).toBe(true);
  });
  it("通讯缩短协调间隔；离线后恢复原间隔，不创造独立协调资格", () => {
    const g = fixture("comms", "plural");
    asset(g, "relay");
    g.core.turn = 2;
    g.machine.coordination.south = 1;
    expect(
      previewAction(g, {
        type: "coordinate",
        province: "south",
        kind: "agreement",
      }).conditions.find((c) => c.label === "协调冷却")?.met,
    ).toBe(true);
    g.machine.works[0].maintenance!.arrears = 1;
    expect(
      previewAction(g, {
        type: "coordinate",
        province: "south",
        kind: "agreement",
      }).conditions.find((c) => c.label === "协调冷却")?.met,
    ).toBe(false);
  });
});
describe("v0.7 迁移、真实叙事及开局遗产", () => {
  it("v0.6档不改核心、工程合同、个人培养或RNG，新增主题未读且不替玩家选分支", () => {
    const g = fixture("spark");
    asset(g, "grid");
    const raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.6.0";
    delete raw.machine.advisor;
    delete raw.machine.strategy;
    const n = deserializeV2(JSON.stringify(raw));
    expect(n.core).toEqual(g.core);
    expect(n.machine.works).toEqual(g.machine.works);
    expect(n.machine.trainings).toEqual(g.machine.trainings);
    expect(n.machine.strategy!.branch).toBeUndefined();
    expect(n.machine.advisor!.seen).toEqual([]);
  });
  it.each(["advisor", "strategy"] as const)(
    "当前档缺少%s时明确拒绝，不静默重建",
    (field) => {
      const raw = JSON.parse(serializeV2(fixture()));
      delete raw.machine[field];
      expect(() => deserializeV2(JSON.stringify(raw))).toThrow(/v0.7/);
    },
  );
  it("损坏的主题冷却、重复合同省份和指令时间明确拒绝", () => {
    const raw = JSON.parse(serializeV2(fixture()));
    raw.machine.advisor.cooldowns.welcome = 100;
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow();
    raw.machine.advisor.cooldowns = {};
    raw.machine.strategy.dispatches = [
      { matter: "x", province: "north", turn: 100, source: "x" },
    ];
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow();
  });
  it("随机政治遗产带实际具名资质，保存后不扩散给其他人物", () => {
    let inherited = 0;
    for (let i = 0; i < 100; i++) {
      const g = startCampaign({
        mode: "experimental",
        seed: `v07-legacy-${i}`,
        difficulty: "standard",
        politics: "random",
      });
      expect(deserializeV2(serializeV2(g))).toEqual(g);
      if (g.machine.trainings!.some((t) => t.completedAt === 0)) {
        inherited++;
        expect(hasCredential(g, "taoqi", "leywork")).toBe(true);
        expect(hasCredential(g, "zhou", "leywork")).toBe(false);
        expect(advisorOpening(g).join()).toContain("陶祈");
      }
    }
    expect(inherited).toBeGreaterThan(0);
  });
  it("长期故事由真实合同与课程演变；扩图设计不冒充现有可玩地图", () => {
    const g = fixture();
    asset(g, "grid", "south", "local");
    expect(
      politicalStories(g).find((x) => x.id === "civilization-contract")?.phase,
    ).toBe("从建设走向经营");
    g.machine.works[0].maintenance!.arrears = 1;
    expect(
      politicalStories(g).find((x) => x.id === "civilization-contract")?.phase,
    ).toBe("履约与权利争议");
    expect(
      Object.values(expansionDesign).every(
        (x) => !x.playable && x.dependencies.length >= 2,
      ),
    ).toBe(true);
    expect(g.core.provinces).toHaveLength(3);
  });
});
describe("v0.7 正常资源完整十二回合新路线（不修改开局状态）", () => {
  it.each([
    ["codex", "central"],
    ["codex", "plural"],
    ["comms", "central"],
    ["comms", "plural"],
  ] as const)("%s / %s真实命令、账目、演练、存读和终局", (goal, branch) => {
    const r = runV7Campaign(goal, branch);
    expect(r.opening.core.treasury).toBe(12);
    expect(r.opening.machine.fiscal.locals).toEqual({
      industry: 6,
      south: 6,
      north: 6,
    });
    expect(r.game.core.status).toBe("won");
    expect(r.game.core.turn).toBe(12);
    expect(r.game.machine.terminalInspected).toBe(true);
    expect(r.checks.every((c) => c.met)).toBe(true);
    expect(r.reloads).toBe(12);
    expect(r.transcript.filter((x) => x.action.type === "end")).toHaveLength(
      12,
    );
    if (goal === "codex")
      expect(r.game.machine.strategy!.legalRecords).toHaveLength(3);
    else {
      expect(r.game.machine.strategy!.dispatches.length).toBeGreaterThanOrEqual(
        2,
      );
      expect(
        r.game.machine.works.filter(
          (w) => w.type === "relay" && facilityOperating(r.game, w),
        ),
      ).toHaveLength(3);
    }
    expect(deserializeV2(serializeV2(r.game))).toEqual(r.game);
  });
});
