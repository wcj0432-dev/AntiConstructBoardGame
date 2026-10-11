import { describe, expect, it } from "vitest";
import {
  deserializeV2,
  executeCommand,
  finance,
  milestones,
  newV2,
  serializeV2,
  startCampaign,
} from "./engine";
import { nationalForecast, newFiscal, settleFiscal } from "./fiscal";
import type { Action, Goal, V2Game, Work, WorkType } from "./model";
import { expandedMilestones } from "./strategies";
import type { ProvinceId } from "../types";

/** State fixtures isolate goal rechecking; these are not campaign balance runs. */
function developed(goal: Goal): V2Game {
  const g = newV2("experimental", goal, "v05-strategy-conditions");
  g.machine.fiscal = newFiscal();
  g.core.treasury = 30;
  g.machine.fiscal.locals = { industry: 12, south: 12, north: 12 };
  g.machine.cooperation = true;
  g.machine.surveyed = true;
  g.machine.standards = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.machine.trust = { industry: 3, south: 3, north: 3 };
  g.machine.departments.transport = ["industry", "south", "north"];
  g.core.policies.method = 1;
  g.core.appointments = {
    plan: "lin",
    anomaly: "sergei",
    defense: "lu",
    "gov-industry": "zhou",
    "gov-south": "yunsong",
    "gov-north": "ye",
  };
  return g;
}

function complete(
  g: V2Game,
  type: WorkType,
  province: ProvinceId,
  to?: ProvinceId,
): Work {
  const w: Work = {
    id: `fixture-${type}-${province}`,
    type,
    province,
    to,
    progress: 2,
    duration: 2,
    completed: true,
    paused: false,
    cancelled: false,
    source: "goal-condition-fixture",
    ...(type === "grid" ? { network: { active: true, fault: false } } : {}),
  };
  g.machine.works.push(w);
  return w;
}

function traffic() {
  const g = developed("traffic");
  complete(g, "rail", "south", "north");
  complete(g, "port", "north");
  complete(g, "energy", "south");
  complete(g, "grid", "south");
  return g;
}

function learning() {
  const g = developed("learning");
  complete(g, "academy", "south");
  complete(g, "academy", "north");
  complete(g, "energy", "south");
  complete(g, "grid", "south");
  g.machine.milestones.push("training:leywork", "training:mobilize");
  g.machine.trainings!.push(
    ...(["leywork", "mobilize"] as const).map((cap, i) => ({
      id: `qualification-${cap}`,
      mentor: i === 0 ? "mo" : "taoqi",
      student: i === 0 ? "yunsong" : "zhou",
      cap,
      province: "south" as const,
      method: "field" as const,
      start: 0,
      progress: 3,
      duration: 3,
      state: "completed" as const,
      completedAt: 0,
      reason: "已完成专业资格夹具，非平衡通关",
      source: "fixture",
    })),
  );
  g.core.policies.disclosure = 1;
  return g;
}

function prosperity() {
  const g = developed("prosperity");
  complete(g, "energy", "south");
  complete(g, "grid", "south");
  complete(g, "cooperative", "industry");
  for (let i = 0; i < 3; i++) {
    settleFiscal(g, nationalForecast(g), `actual-unit-settlement-${i}`);
    g.core.turn++;
  }
  return g;
}

describe("v0.5 国家路线的实际系统条件", () => {
  it("旧三条路线继续交给原有规则，新路线不能从空白开局直接完成", () => {
    for (const old of ["spark", "accord", "night"] as Goal[])
      expect(expandedMilestones(newV2("experimental", old), old)).toEqual([]);
    for (const goal of ["traffic", "learning", "prosperity"] as Goal[]) {
      const conditions = expandedMilestones(newV2("experimental", goal), goal);
      expect(conditions).toHaveLength(4);
      expect(conditions.every((item) => item.met)).toBe(false);
    }
  });

  it("万里通途要求真实连通的铁路、营业港口、电网和当前可用物流专家", () => {
    const g = traffic();
    expect(expandedMilestones(g, "traffic").every((item) => item.met)).toBe(
      true,
    );
    g.machine.works.find((work) => work.type === "port")!.province = "industry";
    expect(expandedMilestones(g, "traffic")[1].met).toBe(false);
  });

  it("危机实际阻断铁路后，终局立即失去通行条件", () => {
    const g = traffic();
    g.machine.matters.push({
      id: "rail-block",
      title: "未受控旧神",
      description: "阻断沿线",
      province: "north",
      kind: "oldgod",
      stage: 3,
      containment: 0,
      evacuated: false,
      isolated: false,
      age: 1,
    });
    const conditions = expandedMilestones(g, "traffic");
    expect(conditions[0].met).toBe(false);
    expect(conditions[1].met).toBe(false);
  });

  it("部分地区运输改革不能覆盖没有改革的另一端", () => {
    const g = traffic();
    g.machine.departments.transport = ["south"];
    expect(expandedMilestones(g, "traffic")[2].met).toBe(false);
    g.machine.regime = "joint";
    expect(expandedMilestones(g, "traffic")[2].met).toBe(true);
  });

  it("名义任职但被抽调的物流专家不算可用能力", () => {
    const g = traffic();
    g.machine.occupied.ye = "current-task";
    expect(expandedMilestones(g, "traffic")[3].met).toBe(false);
  });

  it("关闭和故障电网都会使三个新目标的供电条件失效", () => {
    for (const g of [traffic(), learning(), prosperity()]) {
      const work = g.machine.works.find((item) => item.type === "grid")!;
      work.network!.active = false;
      expect(expandedMilestones(g, g.machine.goal)[3].met).toBe(false);
      work.network!.active = true;
      work.network!.fault = true;
      expect(expandedMilestones(g, g.machine.goal)[3].met).toBe(false);
    }
  });

  it("同省两所学院不能替代跨省教育体系", () => {
    const g = learning();
    g.machine.works.find(
      (work) => work.type === "academy" && work.province === "north",
    )!.province = "south";
    expect(expandedMilestones(g, "learning")[0].met).toBe(false);
  });

  it("学院不会自动授予传承，已传承专业仍须有实际可用继任者", () => {
    const g = learning();
    expect(expandedMilestones(g, "learning").every((item) => item.met)).toBe(
      true,
    );
    g.machine.occupied.yunsong = "specialist-task";
    g.machine.occupied.zhou = "specialist-task";
    g.machine.occupied.ye = "specialist-task";
    expect(expandedMilestones(g, "learning")[3].met).toBe(false);
    g.machine.occupied = {};
    g.machine.milestones = [];
    expect(expandedMilestones(g, "learning")[1].met).toBe(true); // 个人已完成课程，不依赖全局标记
    g.machine.trainings = [];
    const conditions = expandedMilestones(g, "learning");
    expect(conditions[1].met).toBe(false);
    expect(conditions[3].met).toBe(false);
  });

  it("学习路线失去学院所在地信任时重新检查教学渠道", () => {
    const g = learning();
    g.machine.trust.north = 1;
    expect(expandedMilestones(g, "learning")[2].met).toBe(false);
  });

  it("财政余额不能替代稳定结算记录和持续产业", () => {
    const g = developed("prosperity");
    g.core.treasury = 999;
    const conditions = expandedMilestones(g, "prosperity");
    expect(conditions[1].met).toBe(false);
    expect(conditions[2].met).toBe(false);
    expect(conditions[3].met).toBe(false);
  });

  it("真实账本连续结算满足财政稳定，关停企业会撤销税基里程碑", () => {
    const g = prosperity();
    expect(g.machine.fiscal!.settlements).toBe(3);
    expect(g.machine.fiscal!.ledger.length).toBeGreaterThan(0);
    expect(expandedMilestones(g, "prosperity").every((item) => item.met)).toBe(
      true,
    );
    g.machine.rights.industry = false;
    expect(expandedMilestones(g, "prosperity")[1].met).toBe(false);
  });

  it("不同税制需要不同的实际行政条件", () => {
    const g = prosperity();
    g.machine.fiscal!.taxSystem = "central";
    expect(expandedMilestones(g, "prosperity")[0].met).toBe(false);
    g.machine.regime = "vertical";
    expect(expandedMilestones(g, "prosperity")[0].met).toBe(true);
    g.core.paralysis = 2;
    expect(expandedMilestones(g, "prosperity")[0].met).toBe(false);
    g.core.paralysis = 0;
    g.machine.fiscal!.taxSystem = "autonomy";
    expect(expandedMilestones(g, "prosperity")[0].met).toBe(false);
    g.core.policies.authority = 1;
    expect(expandedMilestones(g, "prosperity")[0].met).toBe(true);
  });

  it("地方公共支付缺口不能用中央现金遮盖，并中断稳定记录", () => {
    const g = prosperity();
    g.machine.fiscal!.locals.north = 0;
    const forecast = nationalForecast(g);
    expect(
      forecast.locals.find((row) => row.province === "north")!.default,
    ).toBe(true);
    expect(expandedMilestones(g, "prosperity")[3].met).toBe(false);
    settleFiscal(g, forecast, "actual-local-default");
    expect(expandedMilestones(g, "prosperity")[2].met).toBe(false);
  });
});

function realCampaign(goal: Goal) {
  let g = startCampaign({
    mode: "experimental",
    seed: `v05-no-cheat-${goal}`,
    difficulty: "standard",
    politics: "classic",
  });
  expect(g.core.treasury).toBe(12);
  expect(g.machine.fiscal!.locals).toEqual({
    industry: 6,
    south: 6,
    north: 6,
  });
  const settlements: ReturnType<typeof finance>[] = [];
  const action = (a: Action) => {
    const r = executeCommand(g, a);
    if (r.result.status === "failed")
      throw new Error(
        `第${g.core.turn}回合：${JSON.stringify(a)}；${r.result.errors.join("；")}；财政${g.core.treasury}/${JSON.stringify(g.machine.fiscal!.locals)}；设施${JSON.stringify(g.machine.works.map((w) => ({ id: w.id, type: w.type, maintenance: w.maintenance, network: w.network })))}`,
      );
    g = r.game;
    expect(g.core.status).not.toBe("lost");
  };
  const resolve = (kind: string, option: string) => {
    const matter = g.machine.matters.find((item) => item.kind === kind);
    expect(matter, `第${g.core.turn}回合应存在${kind}`).toBeDefined();
    action({ type: "resolve", matter: matter!.id, option });
  };
  const end = () => {
    settlements.push(finance(g));
    action({ type: "end" });
  };
  const readBack = () => {
    const n = deserializeV2(serializeV2(g));
    expect(n).toEqual(g);
    g = n;
  };
  // Only game actions below alter state; the condition fixtures above are separate.
  resolve("warning", "public-check");
  action({ type: "investigate", deck: "ley" });
  action({ type: "personSkill", person: "lin", province: "industry" });
  action({
    type: "project",
    project: "energy",
    province: "south",
    worker: "mo",
    assignment: "dedicated",
  });
  action({ type: "audit", province: "industry", lead: "gov-industry" });
  end();
  action({ type: "selectGoal", goal });
  return {
    get game() {
      return g;
    },
    action,
    resolve,
    end,
    readBack,
    settlements,
  };
}

function sealOpeningAccident(c: ReturnType<typeof realCampaign>) {
  c.action({
    type: "authorize",
    matter: c.game.machine.matters.find((item) => item.kind === "accident")!.id,
    lead: "anomaly",
    joint: false,
    emergency: false,
  });
  c.resolve("accident", "seal");
  c.action({ type: "personSkill", person: "xing", province: "south" });
}

describe("v0.5 原始资源的十二回合交通与教育路线", () => {
  it("用正式物流职位、真实地方融资、多省铁路和电网维修完成万里通途", () => {
    const c = realCampaign("traffic");
    c.action({ type: "department", department: "transport" });
    c.action({ type: "policy", issue: "method", side: 1 });
    c.action({ type: "coordinate", province: "south", kind: "agreement" });
    c.end();
    sealOpeningAccident(c);
    c.action({ type: "budget", department: "defense", level: 0 });
    c.action({ type: "personSkill", person: "zhou", province: "industry" });
    c.end();
    c.resolve("oldgod", "contain");
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
    c.resolve("oldgod", "contain");
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
    c.resolve("oldgod", "contain");
    c.action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "coordinate", province: "industry", kind: "agreement" });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "fiscalAgreement", province: "industry" });
    c.action({
      type: "project",
      project: "rail",
      province: "south",
      to: "industry",
      partner: "industry",
      worker: "guhe",
      assignment: "dedicated",
      funding: "multi",
    });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "appoint", office: "anomaly", person: "linruoxu" });
    c.action({
      type: "network",
      work: c.game.machine.works.find((work) => work.type === "grid")!.id,
      operation: "repair",
    });
    c.action({ type: "appoint", office: "gov-south", person: "luchaosheng" });
    c.readBack();
    while (c.game.core.turn < 12) {
      c.end();
      c.resolve("oldgod", "contain");
      if (c.game.machine.goal === "traffic" && c.game.core.turn === 9) {
        c.action({
          type: "fiscalTransfer",
          province: "south",
          direction: "grant",
          amount: 2,
        });
        const port = c.game.machine.works.find((w) => w.type === "port")!;
        if (port.maintenance?.arrears)
          c.action({ type: "maintain", work: port.id });
      }
      if (c.game.machine.goal === "traffic" && c.game.core.turn === 11)
        c.action({
          type: "fiscalTransfer",
          province: "south",
          direction: "grant",
          amount: 4,
        });
      if (c.game.core.turn === 10) {
        if (c.game.machine.goal === "traffic")
          for (const w of c.game.machine.works.filter(
            (w) => (w.maintenance?.arrears ?? 0) > 0,
          ))
            c.action({ type: "maintain", work: w.id });
        if (c.game.machine.goal === "learning")
          c.action({ type: "appoint", office: "gov-industry", person: "zhou" });
        c.action({ type: "inspect" });
      }
    }
    expect(
      milestones(c.game).filter((c) => !c.met),
      JSON.stringify({
        turn: c.game.core.turn,
        central: c.game.core.treasury,
        local: c.game.machine.fiscal!.locals,
        works: c.game.machine.works.map((w) => ({
          type: w.type,
          m: w.maintenance,
        })),
      }),
    ).toEqual([]);
    c.resolve("final", "activate");
    c.end();
    expect(c.game.core.status).toBe("won");
    expect(c.game.machine.works.filter((work) => work.completed)).toHaveLength(
      4,
    );
    expect(
      c.game.machine.works.find((work) => work.type === "port")!.contract!
        .owner,
    ).toBe("south");
    expect(
      c.game.machine.works.find((work) => work.type === "rail")!.contract!
        .shares,
    ).toHaveLength(3);
    expect(
      c.game.machine.fiscal!.ledger.some(
        (entry) => entry.reason === "中央专项拨款",
      ),
    ).toBe(true);
    expect(
      c.game.machine.works.find((work) => work.type === "grid")!.network!.fault,
    ).toBe(false);
  });

  it("实际建设两省学院、双专业传承和持续公共补助完成百年树人且全程无欠付", () => {
    const c = realCampaign("learning");
    c.action({ type: "policy", issue: "method", side: 1 });
    c.action({ type: "coordinate", province: "south", kind: "agreement" });
    c.action({ type: "budget", department: "defense", level: 0 });
    c.end();
    sealOpeningAccident(c);
    c.action({ type: "personSkill", person: "zhou", province: "industry" });
    c.end();
    c.resolve("oldgod", "contain");
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
    c.action({ type: "coordinate", province: "industry", kind: "agreement" });
    c.action({ type: "appoint", office: "gov-south", person: "yunsong" });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "fiscalAgreement", province: "south" });
    c.action({
      type: "project",
      project: "academy",
      province: "south",
      worker: "xuzhao",
      assignment: "dedicated",
      funding: "local",
    });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "fiscalAgreement", province: "industry" });
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
      method: "academy",
      facility: c.game.machine.works.find(
        (w) => w.type === "academy" && w.province === "south",
      )!.id,
    });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "appoint", office: "gov-industry", person: "taoqi" });
    c.action({ type: "policy", issue: "disclosure", side: 1 });
    c.action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    c.end();
    c.resolve("oldgod", "contain");
    c.action({ type: "appoint", office: "gov-south", person: "yunsong" });
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
    c.action({
      type: "network",
      work: c.game.machine.works.find((work) => work.type === "grid")!.id,
      operation: "repair",
    });
    c.readBack();
    c.end();
    c.resolve("oldgod", "contain");
    c.action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    while (c.game.core.turn < 12) {
      c.end();
      c.resolve("oldgod", "contain");
      if (c.game.machine.goal === "traffic" && c.game.core.turn === 9) {
        c.action({
          type: "fiscalTransfer",
          province: "south",
          direction: "grant",
          amount: 2,
        });
        const port = c.game.machine.works.find((w) => w.type === "port")!;
        if (port.maintenance?.arrears)
          c.action({ type: "maintain", work: port.id });
      }
      if (c.game.core.turn === 10) {
        if (c.game.machine.goal === "traffic")
          for (const w of c.game.machine.works.filter(
            (w) => (w.maintenance?.arrears ?? 0) > 0,
          ))
            c.action({ type: "maintain", work: w.id });
        if (c.game.machine.goal === "learning")
          c.action({ type: "appoint", office: "gov-industry", person: "zhou" });
        c.action({ type: "inspect" });
      }
      if (c.game.core.turn === 11)
        c.action({
          type: "fiscalTransfer",
          province: "south",
          direction: "grant",
          amount: 2,
        });
    }
    expect(milestones(c.game).every((condition) => condition.met)).toBe(true);
    c.resolve("final", "activate");
    c.end();
    expect(c.game.core.status).toBe("won");
    expect(c.game.machine.milestones).toEqual(
      expect.arrayContaining(["training:leywork", "training:mobilize"]),
    );
    expect(c.settlements).toHaveLength(12);
    expect(
      c.settlements.every(
        (settlement) =>
          !settlement.default &&
          settlement.locals.every((local) => !local.default),
      ),
    ).toBe(true);
    expect(c.game.machine.fiscal!.stableTurns).toBe(12);
    expect(c.game.core.appointments["gov-south"]).toBe("yunsong");
    expect(c.game.core.appointments["gov-industry"]).toBe("zhou");
  });
});
