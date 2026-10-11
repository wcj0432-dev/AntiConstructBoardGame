import { describe, expect, it } from "vitest";
import { getPerson, people } from "../data";
import type { ProvinceId } from "../types";
import { newV2 } from "./engine";
import type { V2Game, Work } from "./model";
import {
  applySpecialistSkill,
  auditTrait,
  eligibleSpecialists,
  heldOffices,
  personMechanics,
  personTraits,
  projectCandidate,
  specialistCapability,
  specialistPreview,
  traitFor,
  workSpeedBonus,
} from "./traits";

function context(id: string, province?: ProvinceId) {
  const t = traitFor(id)!;
  const pid =
    province ||
    t.provinces?.[0] ||
    (["ye", "yanxingzhou"].includes(id) ? "north" : "industry");
  const g = newV2("experimental", "spark", "人物机制-v05");
  g.core.treasury = 30;
  g.core.capital = 30;
  g.core.commands = 10;
  g.core.policies = { method: 1, disclosure: 1, economy: 1, authority: 1 };
  if (id === "xuzhao") g.core.policies.disclosure = 0;
  for (const p of g.core.provinces) {
    p.stock = 10;
    p.pressure = { production: 2, social: 2, anomaly: 3 };
  }
  for (const office of Object.keys(g.core.appointments))
    g.core.appointments[office] = null;
  const office = t.offices[0] === "local" ? `gov-${pid}` : t.offices[0];
  g.core.appointments[office] = id;
  if (!g.core.appointments[`gov-${pid}`])
    g.core.appointments[`gov-${pid}`] = id === "bai" ? "zhou" : "bai";
  g.machine.occupied = {};
  g.machine.cooperation = true;
  g.machine.standards = true;
  g.machine.surveyed = true;
  g.machine.knowledge = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.machine.trust = { industry: 2, south: 2, north: 2 };
  g.machine.suppressed = { industry: false, south: false, north: false };
  g.machine.discoveries = { industry: [], south: [], north: [] };
  if (id === "shenyue") g.machine.discoveries[pid].push("routes");
  return { g, pid };
}

function operativeState(g: V2Game) {
  return {
    provinces: g.core.provinces,
    grievances: g.core.grievances,
    trust: g.machine.trust,
    rights: g.machine.rights,
    discoveries: g.machine.discoveries,
    standards: g.machine.standards,
    surveyed: g.machine.surveyed,
    cooperation: g.machine.cooperation,
    knowledge: g.machine.knowledge,
    reserve: g.machine.reserve,
    permit: g.machine.permit,
    training: g.machine.milestones.filter((m) => m.startsWith("training:")),
  };
}

describe("v0.5 人物内容：24人拥有受条件限制的实际机制", () => {
  it("每个正式人物均有唯一规则身份，原始12人保持专业数据", () => {
    expect(people).toHaveLength(24);
    expect(personTraits).toHaveLength(24);
    expect(new Set(personTraits.map((t) => t.mechanic)).size).toBe(24);
    expect(people.every((p) => !!traitFor(p.id))).toBe(true);
    expect(getPerson("mo")?.skills).toEqual({
      production: 3,
      social: 1,
      anomaly: 3,
    });
    expect(getPerson("xing")?.stance).toEqual({
      disclosure: 1,
      authority: 1,
      economy: 1,
      method: 1,
    });
  });
  for (const person of people) {
    it(`${person.name}在合法岗位执行个人特征会改变实际资格、设施或地方状态`, () => {
      const { g, pid } = context(person.id);
      expect(
        specialistPreview(g, person.id, pid).conditions.filter((c) => !c.met),
      ).toEqual([]);
      const before = JSON.stringify(operativeState(g));
      const effects = applySpecialistSkill(g, person.id, pid, "验证个人机制");
      expect(effects.length).toBeGreaterThan(0);
      expect(JSON.stringify(operativeState(g))).not.toBe(before);
      expect(g.machine.occupied[person.id]).toBe("验证个人机制");
      expect(g.machine.milestones).toContain(`person:${person.id}:${pid}`);
      delete g.machine.occupied[person.id];
      expect(
        specialistPreview(g, person.id, pid).conditions.find(
          (c) => c.label === "尚未履行这项个人承诺",
        )?.met,
      ).toBe(false);
      expect(() =>
        applySpecialistSkill(g, person.id, pid, "重复确认"),
      ).toThrow();
    });
  }
  it("调离、专职派遣、短期抽调与拒绝履职均使行政技能不可用", () => {
    const { g, pid } = context("wen");
    expect(personMechanics(g, "wen", pid).eligible).toBe(true);
    g.core.appointments.plan = null;
    expect(
      specialistPreview(g, "wen", pid).conditions.find(
        (c) => c.label === "个人特征所需职位",
      )?.met,
    ).toBe(false);
    g.core.appointments.plan = "wen";
    g.machine.works.push({
      id: "专职",
      type: "factory",
      province: "industry",
      progress: 0,
      duration: 3,
      paused: false,
      completed: false,
      worker: "wen",
      assignment: "dedicated",
      source: "派遣",
    });
    expect(personMechanics(g, "wen", pid).available).toBe(false);
    g.machine.works[0].assignment = "advisor";
    expect(personMechanics(g, "wen", pid).available).toBe(true);
    g.machine.occupied.wen = "紧急事务";
    expect(personMechanics(g, "wen", pid).available).toBe(false);
    delete g.machine.occupied.wen;
    g.core.grievances.wen = 3;
    expect(personMechanics(g, "wen", pid).available).toBe(false);
  });
  it("公开救援与协商关系不能在信息封锁、组织压制或强制政策下调用", () => {
    const { g, pid } = context("suyi");
    expect(eligibleSpecialists(g, "cooperation", pid)).toContain("suyi");
    g.core.policies.disclosure = 0;
    expect(specialistCapability(g, "mobilize", pid)).not.toContain("suyi");
    expect(eligibleSpecialists(g, "cooperation", pid)).not.toContain("suyi");
    g.core.policies.disclosure = 1;
    g.machine.suppressed[pid] = true;
    expect(specialistCapability(g, "mobilize", pid)).not.toContain("suyi");
    const meeting = context("zhou");
    meeting.g.core.policies.method = 0;
    expect(
      specialistPreview(meeting.g, "zhou", meeting.pid).conditions.find(
        (c) => c.label === "协商制度",
      )?.met,
    ).toBe(false);
  });
  it("江湖护送扣除源地库存，目标只收到两份，无法在工业省自我循环", () => {
    const { g, pid } = context("yanxingzhou", "north");
    const old = g.core.provinces.reduce((n, p) => n + p.stock, 0);
    applySpecialistSkill(g, "yanxingzhou", pid, "护送");
    expect(g.core.provinces.find((p) => p.id === "industry")!.stock).toBe(7);
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(12);
    expect(g.core.provinces.reduce((n, p) => n + p.stock, 0)).toBe(old - 1);
    const self = context("yanxingzhou", "industry");
    expect(
      specialistPreview(self.g, "yanxingzhou", "industry").conditions.find(
        (c) => c.label === "实际跨省护送",
      )?.met,
    ).toBe(false);
  });
  it("灵脉专家有不同组织条件，传承不对所有人自动授能", () => {
    const { g } = context("bai", "south");
    expect(projectCandidate(g, "bai", "grid", "south")).toBe(true);
    g.machine.rights.south = false;
    expect(projectCandidate(g, "bai", "energy", "south")).toBe(false);
    expect(projectCandidate(g, "mo", "energy", "south")).toBe(true);
    g.machine.rights.south = true;
    g.machine.milestones.push("training:leywork");
    expect(projectCandidate(g, "taoqi", "grid", "south")).toBe(true);
    expect(projectCandidate(g, "lin", "grid", "south")).toBe(false);
    expect(projectCandidate(g, "wen", "grid", "south")).toBe(false);
    g.machine.surveyed = false;
    expect(projectCandidate(g, "taoqi", "grid", "south")).toBe(false);
  });
  it("教习授予继任者行动资格，岗位或政策改变时仍会失效", () => {
    const { g, pid } = context("taoqi", "north");
    applySpecialistSkill(g, "taoqi", pid, "公开教习");
    g.core.appointments["gov-north"] = "zhou";
    expect(specialistCapability(g, "mobilize", "north", ["zhou"])).toEqual([
      "zhou",
    ]);
    g.core.appointments["gov-north"] = "wen";
    expect(specialistCapability(g, "mobilize", "north", ["wen"])).toEqual([]);
    g.core.appointments["gov-north"] = "zhou";
    g.machine.occupied.zhou = "已参加调查";
    expect(specialistCapability(g, "mobilize", "north", ["zhou"])).toEqual([]);
    delete g.machine.occupied.zhou;
    g.core.policies.disclosure = 0;
    expect(specialistCapability(g, "mobilize", "north", ["zhou"])).toEqual([]);
  });
  it("兼职读取同一职位持有人，主职空缺才由兼职履责", () => {
    const { g } = context("qi", "north");
    g.core.appointments.anomaly = "sergei";
    g.core.appointments["gov-north"] = null;
    g.machine.secondaryAppointments = { "gov-north": "qi", anomaly: "qi" };
    expect(heldOffices(g, "qi")).toEqual(["gov-north"]);
    expect(heldOffices(g, "sergei")).toEqual(["anomaly"]);
    expect(personMechanics(g, "qi", "north").available).toBe(true);
  });
  it("计划委能提供实际灵脉技术，而非仅允许异常职位替补", () => {
    const { g } = context("linruoxu", "south");
    expect(specialistCapability(g, "leywork", "south", ["linruoxu"])).toEqual([
      "linruoxu",
    ]);
    g.machine.standards = false;
    expect(specialistCapability(g, "leywork", "south", ["linruoxu"])).toEqual(
      [],
    );
  });
  it("税务专长改变有限稽核代价与期限，不直接制造财政收入", () => {
    const { g } = context("wen");
    expect(auditTrait(g, "wen").trustCost).toBe(0);
    g.core.appointments.plan = "chenjiliang";
    expect(auditTrait(g, "chenjiliang").bonusDuration).toBe(1);
    expect(auditTrait(g, "chenjiliang").exposesControl).toBe(true);
    g.machine.occupied.chenjiliang = "正在调查";
    expect(auditTrait(g, "chenjiliang").bonusDuration).toBe(0);
    const market = context("shenyue");
    expect(auditTrait(market.g, "shenyue").trustCost).toBe(0);
    market.g.core.policies.economy = 0;
    expect(auditTrait(market.g, "shenyue").trustCost).toBe(1);
  });
  it("专业加速取决于实际项目、派遣和组织，不是人物恒定加值", () => {
    const { g } = context("guhe");
    const w: Work = {
      id: "铁路",
      type: "rail",
      province: "industry",
      to: "north",
      progress: 0,
      duration: 3,
      paused: false,
      completed: false,
      worker: "guhe",
      assignment: "dedicated",
      source: "工程",
    };
    expect(workSpeedBonus(g, w)).toBe(1);
    w.assignment = "advisor";
    expect(workSpeedBonus(g, w)).toBe(0);
    w.assignment = "dedicated";
    g.machine.standards = false;
    expect(workSpeedBonus(g, w)).toBe(0);
    g.machine.standards = true;
    g.machine.occupied.guhe = "立即事务";
    expect(workSpeedBonus(g, w)).toBe(0);
  });
});
