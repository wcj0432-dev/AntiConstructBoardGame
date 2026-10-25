import { challengingSparkAlternative } from "../../scripts/challenging-alternative";
import { describe, it, expect } from "vitest";
import {
  executeCommand,
  previewAction,
  serializeV2,
  deserializeV2,
  milestones,
  startCampaign,
} from "./engine";
import { startGovernanceTrial, trialChecks } from "./governanceTrial";
import {
  governanceTargets,
  currentAffairs,
  organizationBoard,
  engineeringCard,
  protocolCards,
  crisisCards,
  workDependencies,
  constructionComparison,
  actionBottlenecks,
  personMarks,
} from "./governance";
import { crisisStep } from "./crisisTrack";
import {
  agendaOperation,
  agendaStanding,
  expireAgendas,
} from "./factionAgendas";
import { officePerson, assignmentsFor } from "./personnel";
import { nationalForecast, gridOperating } from "./fiscal";
import { hasCredential } from "./training";
import { advisorIssues, advisorAction } from "./advisor";
import { runGovernanceTrial } from "../../scripts/governance-trial";
import type { Action, V2Game } from "./model";
const cache = new Map<string, ReturnType<typeof runGovernanceTrial>>();
function witness(path: "central" | "local" | "professional" = "central") {
  if (!cache.has(path)) cache.set(path, runGovernanceTrial(path));
  return structuredClone(cache.get(path)!);
}
function run(g: V2Game, a: Action) {
  const r = executeCommand(g, a);
  expect(r.result.errors, JSON.stringify(a)).toEqual([]);
  return r.game;
}
function before(
  action: (a: Action) => boolean,
  path: "central" | "local" | "professional" = "central",
) {
  let g = startGovernanceTrial();
  for (const t of witness(path).trace) {
    if (action(t.action)) return g;
    g = run(g, t.action);
  }
  throw Error("No matching witness command");
}
function maintenanceRisk() {
  let g = before((a) => a.type === "maintenanceSponsor", "local");
  g = run(g, {
    type: "fiscalTransfer",
    province: "south",
    direction: "levy",
    amount: 2,
  });
  g = run(g, { type: "appoint", office: "plan", person: "wen" });
  return g;
}
function budgetAgenda() {
  return before((a) => a.type === "agendaDecision");
}
describe("v0.8.5 A/B/E/J：同一局面、职位与命令", () => {
  it("多次纯投影和构筑预览不改变存档、随机数、资源与原始顺序", () => {
    const g = startGovernanceTrial(),
      raw = serializeV2(g);
    for (let i = 0; i < 4; i++) {
      organizationBoard(g);
      crisisCards(g);
      protocolCards(g);
      for (const w of g.machine.works) {
        engineeringCard(g, w);
        workDependencies(g, w);
      }
      constructionComparison(g, {
        type: "appoint",
        office: "plan",
        person: "wen",
      });
      actionBottlenecks(g, {
        type: "fiscalTransfer",
        province: "south",
        direction: "grant",
        amount: 2,
      });
    }
    expect(serializeV2(g)).toBe(raw);
  });
  it("真实林铸占据计划槽，但专职派遣关闭行政资格；更换负责人不抹掉其工程", () => {
    const g = startGovernanceTrial(),
      slot = organizationBoard(g).find((o) => o.id === "plan")!;
    expect(slot.marks).toEqual(personMarks(g, "lin"));
    expect(slot.person).toBe("lin");
    expect(slot.marks.map((m) => m.id)).toContain("dedicated");
    expect(slot.marks.map((m) => m.id)).not.toContain("ready");
    const a: Action = { type: "appoint", office: "plan", person: "wen" },
      c = constructionComparison(g, a)!;
    expect(c.changed.find((x) => x.id === "plan")!.after.person).toBe("wen");
    const n = run(g, a);
    expect(officePerson(n, "plan")).toBe("wen");
    expect(assignmentsFor(n, "lin").activeProject!.assignment).toBe(
      "dedicated",
    );
    expect(
      organizationBoard(n)
        .find((o) => o.id === "plan")!
        .marks.map((m) => m.id),
    ).toContain("ready");
  });
  it("暂停真实工程可释放原职位，恢复后重新阻断；不增加第二套部门次数", () => {
    let g = startGovernanceTrial();
    const w = g.machine.works.find((w) => w.worker === "lin")!;
    g = run(g, { type: "pause", work: w.id });
    expect(assignmentsFor(g, "lin").adminAvailable).toBe(true);
    expect(
      organizationBoard(g)
        .find((o) => o.id === "plan")!
        .marks.map((m) => m.id),
    ).toContain("ready");
    g = run(g, { type: "pause", work: w.id });
    expect(assignmentsFor(g, "lin").adminAvailable).toBe(false);
    expect(g.core.commands).toBe(5);
  });
  it("正式兼职占据同一槽，两个真实职位共享同一人的占用", () => {
    let g = startGovernanceTrial();
    g = run(g, { type: "appoint", office: "gov-industry", person: "wen" });
    g = run(g, { type: "appoint", office: "plan", person: null });
    g = run(g, { type: "concurrent", office: "plan", person: "wen" });
    expect(officePerson(g, "plan")).toBe("wen");
    expect(organizationBoard(g).filter((o) => o.person === "wen")).toHaveLength(
      2,
    );
    g = run(g, {
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    for (const o of organizationBoard(g).filter((o) => o.person === "wen"))
      expect(o.marks.map((m) => m.id)).toContain("occupied");
  });
  it("仅预览或取消不扣命令；重复请求只执行一次，筹码直接来自core.commands", () => {
    const g = startGovernanceTrial(),
      a: Action = { type: "appoint", office: "plan", person: "wen" },
      raw = serializeV2(g);
    previewAction(g, a);
    expect(serializeV2(g)).toBe(raw);
    const request = { id: "board-double", revision: g.machine.revision },
      r = executeCommand(g, a, request);
    expect(r.game.core.commands).toBe(g.core.commands - 1);
    expect(executeCommand(r.game, a, request).game).toBe(r.game);
    expect(
      r.game.machine.results.filter((r) => r.id === request.id),
    ).toHaveLength(1);
  });
  it("组织瓶颈定位到实际专职计划主任和其工程，资源充足也不能越权", () => {
    const g = startGovernanceTrial(),
      a: Action = {
        type: "fiscalTransfer",
        province: "south",
        direction: "grant",
        amount: 2,
      },
      v = previewAction(g, a),
      b = actionBottlenecks(g, a);
    expect(v.errors.join()).toContain("履职");
    expect(b.find((b) => b.id === "plan")!.project).toBe(
      g.machine.works.find((w) => w.worker === "lin")!.id,
    );
    expect(b.find((b) => b.id === "plan")!.marks.map((m) => m.id)).toContain(
      "dedicated",
    );
    expect(advisorAction(g, a).preview).toEqual(v);
  });
  it("同种子国情与相同操作可复现，桌面投影不消耗随机序列", () => {
    const config = {
      mode: "experimental" as const,
      difficulty: "standard" as const,
      politics: "random" as const,
      seed: "v85-opening-projection",
    };
    let a = startCampaign(config),
      b = startCampaign(config);
    for (const command of [{ type: "end" }] as Action[]) {
      organizationBoard(a);
      crisisCards(a);
      protocolCards(a);
      a = run(a, command);
      b = run(b, command);
    }
    expect(serializeV2(a)).toBe(serializeV2(b));
  });
  it("随机政治遗产呈现真实不同的人事与协议，而不是只换卡牌颜色", () => {
    const starts = Array.from({ length: 12 }, (_, i) =>
      startCampaign({
        mode: "experimental",
        difficulty: "standard",
        politics: "random",
        seed: `v85-${i}`,
      }),
    );
    expect(
      new Set(
        starts.map((g) =>
          JSON.stringify(organizationBoard(g).map((o) => [o.id, o.person])),
        ),
      ).size,
    ).toBeGreaterThan(1);
    for (const g of starts)
      for (const o of organizationBoard(g))
        expect(o.person).toBe(officePerson(g, o.id));
  });
});
describe("v0.8.5 C/G：合同、维护与真实局部因果", () => {
  it("维护接管前后保留地方产权与收益，责任和财政预测真实更新", () => {
    const g = maintenanceRisk(),
      w = g.machine.works.find((w) => w.type === "grid")!,
      rawContract = structuredClone(w.contract),
      old = engineeringCard(g, w);
    expect(old.owner).toBe("south");
    expect(old.maintenance).toEqual(["south"]);
    expect(old.nextArrears).toBeGreaterThan(0);
    const n = run(g, {
        type: "maintenanceSponsor",
        work: w.id,
        account: "central",
      }),
      nw = n.machine.works.find((x) => x.id === w.id)!,
      next = engineeringCard(n, nw);
    expect(nw.contract).toEqual(rawContract);
    expect(next.owner).toBe("south");
    expect(next.maintenance).toEqual(["central"]);
    expect(next.nextArrears).toBe(0);
    expect(next.marks.some((m) => m.id === "due-risk")).toBe(false);
    expect(next.forecast).toEqual(
      nationalForecast(n).facilities.find((x) => x.work === w.id),
    );
  });
  it("图中仅画实际电网端点与对应税源，关停后不再显示供能", () => {
    const g = witness().snapshots[2],
      w = g.machine.works.find((w) => w.type === "grid")!;
    expect(gridOperating(g, w)).toBe(true);
    const beforeTax = nationalForecast(g).totalTax;
    const n = run(g, { type: "network", work: w.id, operation: "close" }),
      nodes = workDependencies(n, n.machine.works.find((x) => x.id === w.id)!);
    expect(nodes.find((x) => x.id === "supply")!.blocked).toBe(true);
    expect(nodes.find((x) => x.id === "tax")!.blocked).toBe(true);
    expect(nationalForecast(n).totalTax).toBe(beforeTax - 2);
    expect(nodes.filter((n) => n.id === "supply")).toHaveLength(1);
    expect(nodes.find((n) => n.id === "supply")!.target.province).toBe(
      "industry",
    );
  });
  it("地方真实欠款会停学院/电网，不把当前预计收入提前当维护资金", () => {
    const g = maintenanceRisk(),
      w = g.machine.works.find((w) => w.type === "grid")!;
    expect(engineeringCard(g, w).nextArrears).toBeGreaterThan(0);
    expect(
      engineeringCard(g, w).marks.find((m) => m.id === "due-risk")?.label,
    ).toBe("到期风险");
    const n = run(g, { type: "end" }),
      nw = n.machine.works.find((x) => x.id === w.id)!;
    expect((nw.maintenance?.arrears ?? 0) > 0).toBe(true);
    expect(gridOperating(n, nw)).toBe(false);
    expect(
      workDependencies(n, nw).find((n) => n.id === "operation")!.blocked,
    ).toBe(true);
  });
  it("生效协议、部门范围和临时授权的期限来自同一存档", () => {
    const g = witness("professional").snapshots[2];
    const auth = Object.entries(g.machine.authorization);
    for (const [id, a] of auth) {
      const p = protocolCards(g).find((x) => x.id === `auth:${id}`)!;
      expect(p.term).toContain(String(a.expires));
      expect(p.source).toBe(a.source);
    }
    expect(
      protocolCards(g).filter((x) => x.id.startsWith("fiscal:")),
    ).toHaveLength(g.machine.fiscal!.agreements.length);
  });
});
describe("v0.8.5 D：阶段轨与正式结算一致", () => {
  it("局部遏制只延缓原有升级，不产生额外视觉惩罚", () => {
    const g = witness("local").snapshots[1],
      m = g.machine.matters.find((m) => m.kind === "accident")!,
      step = crisisStep(g, m),
      crisis = g.core.crisis;
    expect(m.containment).toBe(1);
    expect(step.escalating).toBe(false);
    expect(step.crisis).toBe(0);
    const n = run(g, { type: "end" }),
      same = n.machine.matters.find((x) => x.id === m.id)!;
    expect(same.stage).toBe(m.stage);
    expect(same.containment).toBe(0);
    expect(n.core.crisis).toBe(crisis);
  });
  it("原危机跨入阶段2，卡牌和实际压力/实物变化对应", () => {
    const g = witness("local").snapshots[2],
      m = g.machine.matters.find((m) => m.kind === "supply")!,
      step = crisisStep(g, m),
      crisis = g.core.crisis;
    const n = run(g, { type: "end" }),
      same = n.machine.matters.find((x) => x.id === m.id)!;
    expect(same.stage).toBe(step.stage);
    expect(n.core.crisis).toBe(crisis + step.crisis);
    expect(crisisCards(n).find((c) => c.id === m.id)!.stage).toBe(same.stage);
  });
  it("隔离保持原阶段并停止升级，投影不会触发未知事件或多扣费用", () => {
    const g = witness().snapshots[3],
      m = g.machine.matters.find((m) => m.kind === "oldgod")!;
    // Isolated boundary fixture: this tests the original isolation rule, not a playable route.
    m.isolated = true;
    const raw = serializeV2(g);
    expect(crisisStep(g, m).escalating).toBe(false);
    expect(crisisStep(g, m).crisis).toBe(0);
    expect(serializeV2(g)).toBe(raw);
  });
});
describe("v0.8.5 F/H：有限派系议程与真实后果", () => {
  it("工程和实际主管发起一次议程，稳定来源、期限和秘书解释一致", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0];
    expect(a.kind).toBe("construction-budget");
    expect(a.issuer).toBe(officePerson(g, "plan"));
    expect(a.deadline).toBe(a.created + 2);
    expect(g.machine.history.find((h) => h.id === a.source)!.parents).toContain(
      a.trigger,
    );
    expect(
      advisorIssues(g).some((i) => i.agenda === a.id && i.work === a.work),
    ).toBe(true);
  });
  it("接受只执行一次真实预算操作，不双扣或发额外资金", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0],
      command: Action = {
        type: "agendaDecision",
        agenda: a.id,
        choice: "accept",
      };
    const child = agendaOperation(g, command)!,
      v = previewAction(g, command),
      underlying = run(g, child),
      n = run(g, command);
    expect(v.costs).toEqual(previewAction(g, child).costs);
    expect(n.core.commands).toBe(underlying.core.commands);
    expect(n.core.treasury).toBe(underlying.core.treasury);
    expect(n.machine.departmentBudgets.plan).toBe(2);
    expect(n.machine.agendas!.items[0].state).toBe("accepted");
    expect(executeCommand(n, command).result.status).toBe("failed");
  });
  it("谈判是暂停实际项目；付费延期仅一次；拒绝保留安排并增加指定人物积怨", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0];
    const negotiated = run(g, {
      type: "agendaDecision",
      agenda: a.id,
      choice: "negotiate",
    });
    expect(negotiated.machine.works.find((w) => w.id === a.work)!.paused).toBe(
      true,
    );
    expect(negotiated.machine.departmentBudgets.plan).toBe(1);
    expect(
      previewAction(negotiated, { type: "pause", work: a.work }).errors.join(),
    ).toContain("暂缓承诺");
    const delayed = run(g, {
      type: "agendaDecision",
      agenda: a.id,
      choice: "delay",
    });
    expect(delayed.core.capital).toBe(g.core.capital - 1);
    expect(delayed.machine.agendas!.items[0].deadline).toBe(a.deadline + 1);
    expect(
      previewAction(delayed, {
        type: "agendaDecision",
        agenda: a.id,
        choice: "delay",
      }).errors.join(),
    ).toContain("延期");
    expect(deserializeV2(serializeV2(delayed)).machine.agendas).toEqual(
      delayed.machine.agendas,
    );
    const rejected = run(g, {
      type: "agendaDecision",
      agenda: a.id,
      choice: "reject",
    });
    expect(rejected.core.grievances[a.issuer]).toBe(
      g.core.grievances[a.issuer] + 1,
    );
    expect(rejected.machine.departmentBudgets.plan).toBe(1);
    expect(rejected.machine.works.find((w) => w.id === a.work)!.paused).toBe(
      false,
    );
  });
  it("免职改变正式谈判资格，但不抹掉已经公开的利益与历史", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0];
    const n = run(g, { type: "appoint", office: "plan", person: null });
    expect(agendaStanding(n, n.machine.agendas!.items[0]).formal).toBe(false);
    expect(n.machine.agendas!.items[0].state).toBe("active");
    expect(agendaStanding(n, a).interest).toBe(true);
    expect(
      previewAction(n, {
        type: "agendaDecision",
        agenda: a.id,
        choice: "negotiate",
      }).errors.join(),
    ).toContain("正式谈判");
    const refused = run(n, {
      type: "agendaDecision",
      agenda: a.id,
      choice: "reject",
    });
    expect(refused.core.grievances[a.issuer]).toBe(
      g.core.grievances[a.issuer] + 1,
    );
  });
  it("实际安排先被外部合法操作满足后，议程关闭但不重复给政治奖励", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0],
      n = run(g, { type: "budget", department: "plan", level: 2 });
    expect(n.machine.agendas!.items[0].state).toBe("superseded");
    expect(n.core.grievances[a.issuer]).toBe(g.core.grievances[a.issuer]);
    expect(
      executeCommand(n, {
        type: "agendaDecision",
        agenda: a.id,
        choice: "accept",
      }).result.status,
    ).toBe("failed");
  });
  it("到期只发生一次指定人物积怨，不追加财政、危机或新资源", () => {
    const g = budgetAgenda(),
      a = g.machine.agendas!.items[0],
      n = structuredClone(g);
    n.core.turn = a.deadline;
    // Boundary fixture isolates expiry from unrelated crisis/finance settlements.
    let writes = 0;
    const writer = () => {
      writes++;
      return "exact-once-expiry";
    };
    const cash = n.core.treasury,
      crisis = n.core.crisis;
    expireAgendas(n, writer);
    expireAgendas(n, writer);
    expect(writes).toBe(1);
    expect(n.core.treasury).toBe(cash);
    expect(n.core.crisis).toBe(crisis);
    expect(n.core.grievances[a.issuer]).toBe(g.core.grievances[a.issuer] + 1);
  });
  it("维护后续诉求绑定实际地方产权，最多两种议程且处理后不会再刷同种", () => {
    const g = before(
      (a) => a.type === "agendaDecision" && a.choice === "accept",
      "local",
    );
    const n = witness("local").game;
    expect(n.machine.agendas!.items.map((a) => a.kind).sort()).toEqual([
      "construction-budget",
      "maintenance-voice",
    ]);
    expect(n.machine.agendas!.items).toHaveLength(2);
    const maintenance = n.machine.agendas!.items.find(
      (a) => a.kind === "maintenance-voice",
    )!;
    expect(maintenance.state).toBe("accepted");
    expect(
      n.machine.works.find((w) => w.id === maintenance.work)!.contract!.owner,
    ).toBe("south");
    expect(g.machine.agendas!.items.length).toBeLessThanOrEqual(2);
  });
});
describe("v0.8.5 K：明确迁移与当前坏档拒绝", () => {
  it("0.8.x旧档保留所有既有领域，只新增空议程，不重抽随机数或追索历史", () => {
    const g = witness("local").game,
      raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.8.0";
    delete raw.machine.agendas;
    delete raw.machine.governanceTrial;
    const n = deserializeV2(JSON.stringify(raw));
    expect(n.core).toEqual(g.core);
    for (const key of [
      "works",
      "trainings",
      "strategy",
      "storylines",
      "history",
      "rights",
      "secondaryAppointments",
    ] as const)
      expect(n.machine[key]).toEqual(g.machine[key]);
    expect(n.machine.agendas).toEqual({ seen: [], items: [] });
    expect(n.machine.rulesVersion).toBe("0.8.5");
  });
  it("缺失、重复、虚构资格、伪造延期或处理来源均拒绝，读取不修改原字符串", () => {
    const g = budgetAgenda();
    for (const mutate of [
      (x: V2Game) => {
        delete x.machine.agendas;
      },
      (x: V2Game) => {
        x.machine.agendas!.items.push(x.machine.agendas!.items[0]);
      },
      (x: V2Game) => {
        x.machine.agendas!.items[0].issuer = "unknown";
      },
      (x: V2Game) => {
        x.machine.agendas!.items[0].source = "fake";
      },
      (x: V2Game) => {
        x.machine.agendas!.items[0].deadline++;
      },
      (x: V2Game) => {
        x.machine.agendas!.items[0].deferred = true;
        x.machine.agendas!.items[0].deadline++;
      },
      (x: V2Game) => {
        x.machine.agendas!.items[0].state = "accepted";
        x.machine.agendas!.items[0].decisionSource = "fake";
      },
    ]) {
      const n = structuredClone(g);
      mutate(n);
      const raw = serializeV2(n);
      expect(() => deserializeV2(raw)).toThrow();
      expect(serializeV2(n)).toBe(raw);
    }
  });
});
describe("v0.8.5 四回合真实组织路线", () => {
  for (const path of ["central", "local", "professional"] as const)
    it(`${path}：原5命令、4真实结算、4存读及结算后复核`, () => {
      const r = witness(path);
      expect(r.opening.core.commands).toBe(5);
      expect(r.opening.core.treasury).toBe(32);
      expect(r.trace.filter((t) => t.action.type === "end")).toHaveLength(4);
      expect(r.settlements).toHaveLength(4);
      expect(r.game.core.status).toBe("won");
      expect(r.game.core.turn).toBe(4);
      expect(trialChecks(r.game).every((c) => c.met)).toBe(true);
      expect(milestones(r.game)).toEqual(trialChecks(r.game));
      expect(r.trace.every((t) => t.commands >= 0 && t.cash >= 0)).toBe(true);
      expect(deserializeV2(serializeV2(r.game))).toEqual(r.game);
    });
  it("三条路线确实改变产权、维护、授权、人物与未来资质，而不只是余额", () => {
    const central = witness("central").game,
      local = witness("local").game,
      professional = witness("professional").game;
    const grid = (g: V2Game) => g.machine.works.find((w) => w.type === "grid")!;
    expect(grid(central).contract!.owner).toBe("central");
    expect(grid(local).contract!.owner).toBe("south");
    expect(grid(local).maintenanceSponsor).toBe("central");
    expect(grid(professional).contract!.owner).toBe("joint");
    expect(central.machine.milestones).toContain("border-supply:rail");
    expect(local.machine.milestones).toContain("border-supply:jianghu");
    expect(hasCredential(professional, "yunsong", "leywork")).toBe(true);
    expect(professional.core.appointments["gov-south"]).toBe("yunsong");
    expect(professional.machine.secondaryAppointments!.plan).toBe("wen");
    expect(grid(professional).network!.faultSeen).not.toBe(true);
    expect(grid(central).network!.faultSeen).toBe(true);
  });
});

describe("v0.8.5 既有规则与已知平衡边界", () => {
  it("普通四回合桌面采用原危机胜负事实，不误报成星火战略", () => {
    const g = startCampaign({
      mode: "campaign",
      difficulty: "standard",
      politics: "classic",
      seed: "v85-four-turn-facts",
    });
    expect(governanceTargets(g).map((c) => c.label)).toEqual([
      "灵脉事故已得到管理",
      "北境重大事务已得到管理",
    ]);
    expect(governanceTargets(g).every((c) => c.met)).toBe(false);
  });
  it("公开危机优先于未到期的预算要求，当前事务最多四项而非堆叠全部", () => {
    const g = budgetAgenda(),
      cards = currentAffairs(g);
    expect(cards.length).toBeLessThanOrEqual(4);
    expect(cards[0].kind).toBe("crisis");
    expect(cards.some((c) => c.kind === "agenda")).toBe(true);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });
  it("原挑战星火中央失败样本有真实替代通关：9初始财政，延后兼容标准", () => {
    const r = challengingSparkAlternative();
    expect(r.opening.core.treasury).toBe(9);
    expect(r.opening.machine.difficulty).toBe("challenging");
    expect(r.game.core.status).toBe("won");
    expect(r.settlements).toHaveLength(12);
    expect(r.trace.filter((t) => t.action.type === "end")).toHaveLength(12);
    expect(r.checks.every((c) => c.met)).toBe(true);
    expect(
      r.trace.find(
        (t) => t.action.type === "personSkill" && t.action.person === "lin",
      )!.turn,
    ).toBe(2);
  });
});
