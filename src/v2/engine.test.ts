import { describe, expect, it } from "vitest";
import {
  capability,
  deserializeV2,
  executeAction,
  finance,
  milestones,
  newV2,
  previewAction,
  serializeV2,
} from "./engine";
import { plansFor } from "./data";
import { newGame as oldGame, serialize as oldSerialize } from "../engine";
import type { Action, Matter, V2Game } from "./model";
const go = (g: V2Game, a: Action) => executeAction(g, a);
const end = (g: V2Game) => go(g, { type: "end" });
const find = (g: V2Game, kind: Matter["kind"]) =>
  g.machine.matters.find((x) => x.kind === kind)!;
const resolve = (g: V2Game, kind: Matter["kind"], option: string) =>
  go(g, { type: "resolve", matter: find(g, kind).id, option });
const enabled = (g: V2Game, m: Matter) =>
  plansFor(m, g.machine.goal)
    .filter(
      (p) =>
        previewAction(g, { type: "resolve", matter: m.id, option: p.id }).errors
          .length === 0,
    )
    .map((p) => p.id);
function scene() {
  const g = newV2();
  g.machine.matters = [
    {
      id: "oldgod",
      kind: "oldgod",
      province: "north",
      title: "旧神",
      description: "",
      stage: 2,
      containment: 0,
      evacuated: false,
      isolated: false,
      age: 0,
    },
  ];
  g.core.appointments["gov-north"] = "xing";
  g.core.appointments["gov-south"] = "bai";
  return g;
}
describe("v0.2 权力改变行动集合", () => {
  it("相同人才资源下三个体制拥有真实不同方案", () => {
    const devolved = scene();
    const vertical = structuredClone(devolved);
    vertical.machine.regime = "vertical";
    const joint = structuredClone(devolved);
    joint.machine.regime = "joint";
    joint.machine.permit = true;
    joint.core.policies.method = 1;
    const d = enabled(devolved, devolved.machine.matters[0]),
      v = enabled(vertical, vertical.machine.matters[0]),
      j = enabled(joint, joint.machine.matters[0]);
    expect(d).toContain("public");
    expect(d).not.toContain("seal");
    expect(v).toContain("seal");
    expect(v).not.toContain("public");
    expect(j).toContain("joint");
    expect(j).not.toContain("seal");
    expect(devolved.core.treasury).toBe(vertical.core.treasury);
  });
  it("有群众人才不代表任何职位都能发挥作用", () => {
    const g = scene();
    const m = g.machine.matters[0];
    expect(capability(g, "mobilize", m, 1).every((c) => c.met)).toBe(true);
    g.core.appointments["gov-north"] = "ye";
    g.core.appointments.plan = "xing";
    expect(capability(g, "mobilize", m, 1).every((c) => c.met)).toBe(false);
  });
  it("保密政策真实关闭群众动员，并解释来源", () => {
    let g = scene();
    g = go(g, { type: "policy", issue: "disclosure", side: 0 });
    const c = capability(g, "mobilize", g.machine.matters[0], 1);
    expect(c.every((c) => c.met)).toBe(false);
    expect(c.some((c) => c.reason.includes("保密") && !!c.source)).toBe(true);
  });
  it("不相关人物不会在普通运输事务触发路线否决", () => {
    const g = scene();
    g.machine.matters[0].kind = "supply";
    g.machine.standards = true;
    g.machine.department = "transport";
    const p = previewAction(g, {
      type: "resolve",
      matter: "oldgod",
      option: "transport",
    });
    expect(p.opponents).toEqual([]);
  });
  it("垂直制度解决全国封印，但中央瓶颈阻断地方救援", () => {
    const g = scene();
    g.machine.regime = "vertical";
    expect(enabled(g, g.machine.matters[0])).toContain("seal");
    g.core.paralysis = 2;
    expect(enabled(g, g.machine.matters[0])).not.toContain("seal");
    expect(
      previewAction(g, {
        type: "resolve",
        matter: "oldgod",
        option: "seal",
      }).errors.join(),
    ).toContain("阻塞");
  });
  it("改革需要过渡，并覆盖多个地区而非改变费用", () => {
    let g = newV2();
    const before = capability(g, "rapid", find(g, "warning")).every(
      (c) => c.met,
    );
    g = go(g, { type: "regime", regime: "vertical" });
    expect(g.machine.regime).toBe("devolved");
    expect(g.machine.pending?.due).toBe(2);
    expect(() => go(g, { type: "regime", regime: "joint" })).toThrow();
    g = end(g);
    expect(g.machine.regime).toBe("vertical");
    expect(before).toBe(true);
    for (const pid of ["south", "north"] as const)
      expect(
        capability(g, "rapid", { ...find(g, "accident"), province: pid }).every(
          (c) => c.met,
        ),
      ).toBe(false);
  });
  it("临时授权邀请专家，但不会凭资源造出跨省制度", () => {
    let g = scene();
    expect(enabled(g, g.machine.matters[0])).not.toContain("seal");
    g = go(g, {
      type: "authorize",
      matter: "oldgod",
      lead: "gov-north",
      joint: true,
      emergency: true,
    });
    expect(
      previewAction(g, {
        type: "resolve",
        matter: "oldgod",
        option: "seal",
        force: true,
      }).errors.join(),
    ).toContain("跨省");
    g.machine.cooperation = true;
    expect(
      previewAction(g, {
        type: "resolve",
        matter: "oldgod",
        option: "seal",
        force: true,
      }).errors,
    ).toEqual([]);
  });
  it("强制必须有真实紧急权，且不能越过秘密能力条件", () => {
    let g = scene();
    g.machine.regime = "joint";
    const a: Action = {
      type: "resolve",
      matter: "oldgod",
      option: "public",
      force: true,
    };
    expect(previewAction(g, a).errors.join()).toContain("紧急");
    g = go(g, {
      type: "authorize",
      matter: "oldgod",
      lead: "gov-north",
      joint: true,
      emergency: true,
    });
    expect(previewAction(g, a).errors).toEqual([]);
    g = go(g, a);
    expect(g.core.grievances.sergei).toBe(1);
    expect(g.machine.cooperation).toBe(false);
    g.core.policies.disclosure = 1;
    expect(
      capability(g, "seal", g.machine.matters[0], 0).every((c) => c.met),
    ).toBe(false);
  });
  it("没有真实紧急事件时不能购买强制权", () => {
    const g = newV2();
    expect(() =>
      go(g, {
        type: "authorize",
        matter: find(g, "warning").id,
        lead: "anomaly",
        joint: true,
        emergency: true,
      }),
    ).toThrow("阶段");
  });
  it("联合能力需要双方实际共识，通用资本无法替代", () => {
    const g = scene();
    g.machine.regime = "joint";
    expect(enabled(g, g.machine.matters[0])).not.toContain("joint");
    g.machine.permit = true;
    g.core.policies.method = 1;
    expect(enabled(g, g.machine.matters[0])).toContain("joint");
  });
});
describe("真实后果、工程与因果", () => {
  it("事故公开和秘密方案产生不同类型后续局势", () => {
    let pub = newV2();
    pub = end(pub);
    pub = resolve(pub, "accident", "public");
    pub = end(pub);
    expect(find(pub, "supply")).toBeTruthy();
    let secret = newV2();
    secret = go(secret, { type: "regime", regime: "vertical" });
    secret = end(secret);
    secret = resolve(secret, "accident", "seal");
    secret = end(secret);
    expect(find(secret, "distrust")).toBeTruthy();
    expect(find(pub, "supply").source).toBe(pub.machine.origins.accident);
    expect(find(secret, "distrust").source).toBe(
      secret.machine.origins.accident,
    );
  });
  it("同一次利益受损提出收益权或长期预算，而非通用冲突费", () => {
    let g = end(newV2());
    const m = find(g, "accident");
    const ownership = go(g, {
      type: "resolve",
      matter: m.id,
      option: "public",
      exchange: "ownership",
    });
    const budget = go(g, {
      type: "resolve",
      matter: m.id,
      option: "public",
      exchange: "budget",
    });
    expect(ownership.machine.rights.south).toBe(true);
    expect(ownership.machine.budgets).toEqual([]);
    expect(budget.machine.budgets).toContain("south");
    expect(finance(budget).maintenance).toBe(1);
    expect(ownership.core.commands).toBe(budget.core.commands);
  });
  it("财政预测与实际结算完全一致，暂停会取消真实承诺", () => {
    let g = newV2();
    g = go(g, { type: "project", project: "warning", province: "industry" });
    const f = finance(g),
      p = previewAction(g, { type: "end" });
    const n = end(g);
    expect(n.core.treasury).toBe(f.next);
    expect(n.core.treasury).toBe(p.after.treasury);
    expect(n.core.commands).toBe(p.after.commands);
    g = go(g, { type: "pause", work: g.machine.works[0].id });
    expect(finance(g).projectCosts).toBe(0);
  });
  it("施工工程师被抽调会真的中断，而非继续获得进度", () => {
    let g = newV2();
    g = go(g, { type: "investigate", deck: "ley" });
    g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
    g = go(g, { type: "project", project: "energy", province: "south" });
    g = resolve(g, "warning", "repair");
    const n = end(g);
    expect(n.machine.works[0].progress).toBe(0);
    expect(n.machine.history.some((h) => h.title.includes("中断"))).toBe(true);
    expect(finance(g).projectCosts).toBe(0);
  });
  it("能力限制的因果指向真实决策，不编造故事", () => {
    let g = scene();
    g = go(g, { type: "policy", issue: "disclosure", side: 0 });
    const source = capability(g, "mobilize", g.machine.matters[0], 1).find(
      (c) => !!c.source,
    )!.source;
    expect(g.machine.history.find((h) => h.id === source)?.title).toContain(
      "保密",
    );
    for (const h of g.machine.history)
      for (const id of h.parents)
        expect(g.machine.history.some((x) => x.id === id)).toBe(true);
  });
  it("持续危机有可见阶段，撤离后仍在地图且可受控", () => {
    let g = scene();
    g = resolve(g, "oldgod", "evacuate");
    const n = end(g);
    expect(n.machine.matters.find((m) => m.id === "oldgod")?.evacuated).toBe(
      true,
    );
    expect(n.machine.matters.find((m) => m.id === "oldgod")?.stage).toBe(2);
    expect(n.machine.milestones).toContain("north-managed");
  });
  it("额外压力只检测一次，新增事项最多3，超出公开排队", () => {
    const g = newV2();
    for (const p of g.core.provinces) {
      p.pressure.anomaly = 4;
      p.pressure.production = 4;
      p.pressure.social = 4;
    }
    const n = end(g);
    expect(n.machine.admitted).toBe(3);
    expect(n.machine.backlog.length).toBeGreaterThan(0);
    expect(n.machine.history.length).toBeLessThan(40);
  });
  it("存档恢复工程、授权、过渡、随机与因果，并明确拒绝v0.1", () => {
    let g = newV2();
    g = go(g, { type: "regime", regime: "joint" });
    g = go(g, {
      type: "authorize",
      matter: find(g, "warning").id,
      lead: "gov-south",
      joint: true,
      emergency: false,
    });
    expect(deserializeV2(serializeV2(g))).toEqual(g);
    expect(end(deserializeV2(serializeV2(g)))).toEqual(end(g));
    expect(() => deserializeV2(oldSerialize(oldGame()))).toThrow("v0.1");
  });
  it("预览无副作用，实际资源和预览一致，非法任命被拒绝", () => {
    const g = newV2(),
      raw = serializeV2(g);
    const a: Action = { type: "regime", regime: "vertical" },
      p = previewAction(g, a);
    expect(serializeV2(g)).toBe(raw);
    const n = go(g, a);
    expect({
      commands: n.core.commands,
      treasury: n.core.treasury,
      capital: n.core.capital,
    }).toEqual(p.after);
    expect(() =>
      go(g, { type: "appoint", office: "anomaly", person: "lin" }),
    ).toThrow("一人");
  });
});
describe("可完成的治理路线", () => {
  it("地方路线完成4回合：公开救援与北境撤离", () => {
    let g = newV2();
    g = resolve(g, "warning", "public-check");
    g = end(g);
    g = resolve(g, "accident", "public");
    g = end(g);
    g = resolve(g, "supply", "priority");
    g = end(g);
    g = resolve(g, "oldgod", "evacuate");
    g = end(g);
    expect(g.core.status).toBe("won");
  });
  it("垂直路线完成4回合：全国秘密封印", () => {
    let g = newV2();
    g = go(g, { type: "regime", regime: "vertical" });
    g = resolve(g, "warning", "observe");
    g = end(g);
    g = resolve(g, "accident", "seal");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: find(g, "distrust").id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    g = resolve(g, "distrust", "rights");
    g = end(g);
    g = resolve(g, "oldgod", "seal");
    g = end(g);
    expect(g.core.status).toBe("won");
  });
  it("委员会路线完成4回合：有限公开与联合处置", () => {
    let g = newV2();
    g = go(g, { type: "regime", regime: "joint" });
    g = go(g, { type: "policy", issue: "method", side: 1 });
    g = go(g, { type: "investigate", deck: "archive" });
    g = resolve(g, "gazette", "permit");
    g = resolve(g, "warning", "observe");
    g = end(g);
    g = resolve(g, "accident", "joint");
    g = end(g);
    g = end(g);
    g = go(g, { type: "appoint", office: "gov-south", person: null });
    g = go(g, { type: "appoint", office: "gov-north", person: "xing" });
    g = go(g, { type: "appoint", office: "gov-south", person: "bai" });
    g = resolve(g, "oldgod", "joint");
    g = end(g);
    expect(g.core.status).toBe("won");
  });
  it("三种目标不能凭大量通用资源达成", () => {
    for (const goal of ["spark", "accord", "night"] as const) {
      const g = newV2("national", goal);
      g.core.treasury = 999;
      g.core.capital = 999;
      expect(milestones(g).every((c) => c.met)).toBe(false);
    }
  });
});

describe("完整教学与八回合国家目标验收", () => {
  it("四个教学阶段由实际操作推进，保存不会跳过资格", () => {
    let g = newV2("tutorial");
    expect(
      previewAction(g, {
        type: "resolve",
        matter: find(g, "warning").id,
        option: "public-check",
      }).errors.length,
    ).toBeGreaterThan(0);
    g = go(g, { type: "appoint", office: "gov-south", person: "xing" });
    g = resolve(g, "warning", "public-check");
    expect(g.machine.tutorial).toBe(1);
    expect(() => resolve(g, "accident", "public")).toThrow("教学");
    g = go(g, {
      type: "authorize",
      matter: find(g, "accident").id,
      lead: "gov-south",
      joint: true,
      emergency: false,
    });
    g = resolve(g, "accident", "public");
    expect(g.machine.tutorial).toBe(2);
    g = go(g, { type: "forecast" });
    expect(g.machine.tutorial).toBe(3);
    expect(find(g, "supply").source).toBe(g.machine.origins.accident);
    g = resolve(g, "supply", "priority");
    expect(g.machine.tutorial).toBe(4);
    expect(g.core.commands).toBe(0);
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
  it("长夜：预警设施、全国封印及终局不是资源替代品", () => {
    let g = newV2("national", "night");
    g = go(g, { type: "regime", regime: "vertical" });
    g = resolve(g, "warning", "observe");
    for (const province of ["industry", "south", "north"] as const)
      g = go(g, { type: "project", project: "warning", province });
    g = end(g);
    g = resolve(g, "accident", "seal");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: find(g, "distrust").id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    g = resolve(g, "distrust", "rights");
    g = end(g);
    g = resolve(g, "oldgod", "seal");
    while (g.core.turn < 8) g = end(g);
    expect(milestones(g).every((c) => c.met)).toBe(true);
    g = resolve(g, "final", "activate");
    g = end(g);
    expect(g.core.status).toBe("won");
    expect(g.core.ending).toContain("正式完成");
  });
  it("协约：部门改革、合作协议和代表实际在任完成八回合", () => {
    let g = newV2("national", "accord");
    g = go(g, { type: "department", department: "evacuation" });
    g = resolve(g, "warning", "public-check");
    g = resolve(g, "gazette", "rights");
    g = end(g);
    g = resolve(g, "accident", "public");
    g = end(g);
    g = resolve(g, "supply", "priority");
    g = go(g, {
      type: "authorize",
      matter: find(g, "accident").id,
      lead: "anomaly",
      joint: true,
      emergency: false,
    });
    g = resolve(g, "accident", "seal");
    g = end(g);
    g = resolve(g, "oldgod", "evacuate");
    while (g.core.turn < 8) {
      if (find(g, "oldgod").containment === 0)
        g = resolve(g, "oldgod", "contain");
      g = end(g);
    }
    expect(milestones(g).every((c) => c.met)).toBe(true);
    g = resolve(g, "final", "activate");
    g = end(g);
    expect(g.core.status).toBe("won");
  });
  it("星火：不抽调工程师，完成能源网并维持工业运输和地方收益权", () => {
    let g = newV2("national", "spark");
    g = resolve(g, "warning", "public-check");
    g = resolve(g, "gazette", "standard");
    g = go(g, { type: "investigate", deck: "ley" });
    g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
    g = go(g, { type: "project", project: "energy", province: "south" });
    g = end(g);
    g = go(g, { type: "department", department: "transport" });
    g = end(g);
    expect(g.machine.works[0].completed).toBe(true);
    g = resolve(g, "accident", "contain");
    g = end(g);
    g = resolve(g, "oldgod", "evacuate");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: find(g, "accident").id,
      lead: "gov-south",
      joint: true,
      emergency: false,
    });
    g = resolve(g, "accident", "seal");
    g = end(g);
    g = go(g, {
      type: "authorize",
      matter: find(g, "distrust").id,
      lead: "plan",
      joint: false,
      emergency: false,
    });
    g = resolve(g, "distrust", "rights");
    while (g.core.turn < 8) {
      if (find(g, "oldgod").containment === 0)
        g = resolve(g, "oldgod", "contain");
      g = end(g);
    }
    expect(milestones(g).every((c) => c.met)).toBe(true);
    g = resolve(g, "final", "activate");
    g = end(g);
    expect(g.core.status).toBe("won");
    expect(finance(g).income).toBe(6);
  });
});

describe("政治后果和主动公报", () => {
  it("五项荒诞公报均可主动揭开，随机状态可存档复现", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const g = newV2("national", "accord", `公报-${i}`);
      const n = go(g, { type: "investigate", deck: "civic" });
      seen.add(n.machine.matters.at(-1)!.variant!);
      expect(
        go(deserializeV2(serializeV2(g)), {
          type: "investigate",
          deck: "civic",
        }),
      ).toEqual(n);
    }
    expect([...seen].sort()).toEqual([
      "dream",
      "flying",
      "magic",
      "meeting",
      "sword",
    ]);
  });
  it("短期强制关闭承诺网络，改革共识保留后续联合行动资格", () => {
    let forced = scene();
    forced.machine.regime = "joint";
    forced.machine.cooperation = true;
    forced = go(forced, {
      type: "authorize",
      matter: "oldgod",
      lead: "gov-north",
      joint: true,
      emergency: true,
    });
    forced = resolveForced(forced);
    expect(forced.machine.cooperation).toBe(false);
    expect(forced.core.grievances.sergei).toBe(1);
    let agreement = scene();
    agreement.machine.regime = "joint";
    agreement.machine.permit = true;
    agreement.core.policies.method = 1;
    agreement.machine.cooperation = true;
    expect(enabled(agreement, agreement.machine.matters[0])).toContain("joint");
    agreement = resolve(agreement, "oldgod", "joint");
    expect(agreement.machine.cooperation).toBe(true);
    expect(agreement.core.grievances.sergei).toBe(0);
  });
  it("陆霆隔离产生真实生产停止并关闭当地群众能力", () => {
    let g = scene();
    g.machine.regime = "vertical";
    g = resolve(g, "oldgod", "isolate");
    const stock = g.core.provinces.find((p) => p.id === "north")!.stock;
    expect(
      capability(g, "mobilize", find(g, "oldgod"), 1).every((c) => c.met),
    ).toBe(false);
    g = end(g);
    expect(g.core.provinces.find((p) => p.id === "north")!.stock).toBe(stock);
    expect(find(g, "oldgod").isolated).toBe(true);
  });
  it("叶冬的协商网络可替代离岗计划负责人，但强制路线不能替代网络", () => {
    let g = newV2();
    g.machine.standards = true;
    g.machine.cooperation = true;
    g.machine.rights.south = true;
    g.machine.rights.north = true;
    g.core.policies.method = 1;
    g.core.appointments.plan = null;
    const m = find(g, "warning");
    expect(capability(g, "transport", m).every((c) => c.met)).toBe(false);
    g.machine.rights.industry = true;
    expect(capability(g, "transport", m).every((c) => c.met)).toBe(true);
    g = go(g, { type: "policy", issue: "method", side: 0 });
    expect(capability(g, "transport", m).every((c) => c.met)).toBe(false);
  });
});
function resolveForced(g: V2Game) {
  return go(g, {
    type: "resolve",
    matter: "oldgod",
    option: "public",
    force: true,
  });
}

describe("状态恢复边界", () => {
  it("拒绝会破坏UI的教学阶段和未知机构，保留终局状态", () => {
    for (const mutate of [
      (g: V2Game) => (g.machine.tutorial = 5),
      (g: V2Game) => (g.machine.overrides.south = "不存在的部门"),
    ]) {
      const g = newV2("tutorial");
      mutate(g);
      expect(() => deserializeV2(serializeV2(g))).toThrow();
    }
    let g = newV2();
    g = end(g);
    g = resolve(g, "accident", "public");
    g = end(g);
    g = resolve(g, "supply", "priority");
    g = end(g);
    g = resolve(g, "oldgod", "evacuate");
    g = end(g);
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
});
