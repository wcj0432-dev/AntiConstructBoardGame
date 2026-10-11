import { describe, expect, it } from "vitest";
import { workSpecs } from "./administration";
import {
  deserializeV2,
  executeCommand,
  finance,
  newV2,
  previewAction,
  serializeV2,
  startCampaign,
} from "./engine";
import {
  accountBalance,
  fiscalProvinces,
  fundingPayments,
  gridOperating,
  makeFunding,
  moveMoney,
  nationalForecast,
  newFiscal,
  settleFiscal,
} from "./fiscal";
import type { Action, FiscalAccount, TaxSystem, V2Game } from "./model";

const accounts: FiscalAccount[] = ["central", ...fiscalProvinces, "cult"];
const money = (g: V2Game) =>
  accounts.reduce((sum, account) => sum + accountBalance(g, account), 0);
const go = (g: V2Game, action: Action): V2Game => {
  const result = executeCommand(g, action);
  expect(result.result.status, JSON.stringify(result.result)).not.toBe(
    "failed",
  );
  return result.game;
};

/** Qualification fixtures deliberately isolate ownership and solvency rules.
 * The complete campaign below must use the unmodified starting resources. */
function qualified(seed = "v05-融资与权限资格") {
  const g = newV2("experimental", "prosperity", seed);
  g.machine.fiscal ??= newFiscal();
  g.machine.fiscal.agreements = [...fiscalProvinces];
  g.machine.surveyed = true;
  g.machine.standards = true;
  g.machine.cooperation = true;
  g.machine.rights = { industry: true, south: true, north: true };
  g.machine.trust = { industry: 3, south: 3, north: 3 };
  g.core.policies.method = 1;
  g.machine.matters = [];
  g.machine.backlog = [];
  g.machine.milestones.push("accident-managed");
  g.core.treasury = 40;
  g.machine.fiscal.locals = { industry: 30, south: 30, north: 30 };
  g.machine.fiscal.cultTreasury = 30;
  return g;
}

const gridAction = (
  funding: "central" | "joint" | "cult" | "local" | "multi" = "joint",
): Action => ({
  type: "project",
  project: "grid",
  province: "south",
  to: "industry",
  worker: "mo",
  assignment: "dedicated",
  funding,
  partner: funding === "multi" ? "industry" : undefined,
});

function completedGrid(
  funding: "central" | "joint" | "cult" | "local" = "joint",
) {
  let g = qualified();
  g = go(g, gridAction(funding));
  const id = g.machine.works[0].id;
  for (
    let i = 0;
    i < workSpecs.grid.duration + 1 && !g.machine.works[0].completed;
    i++
  ) {
    g = go(g, { type: "end" });
  }
  g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
  const work = g.machine.works.find((item) => item.id === id)!;
  expect(work.completed).toBe(true);
  return { g, work };
}

describe("v0.5 测试A：税源与财政流转守恒", () => {
  it.each<TaxSystem>(["split", "central", "autonomy"])(
    "%s税制只分配一次真实税源，不把实物库存当作现金",
    (system) => {
      const g = qualified();
      g.machine.fiscal!.taxSystem = system;
      const plan = nationalForecast(g);
      for (const row of plan.locals) {
        const taxable = g.core.provinces
          .find((p) => p.id === row.province)!
          .districts.reduce((sum, district) => sum + district.output, 0);
        expect(row.taxGross).toBe(taxable);
        expect(row.centralShare + row.localShare).toBe(taxable);
        const taxes = plan.entries.filter(
          (entry) =>
            entry.category === "tax" &&
            entry.reason.includes(
              g.core.provinces.find((p) => p.id === row.province)!.name,
            ),
        );
        expect(taxes.reduce((sum, entry) => sum + entry.amount, 0)).toBe(
          taxable,
        );
      }
      const issued = plan.entries
        .filter((entry) => entry.from === "economy")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const spent = plan.entries
        .filter((entry) => entry.to === "public")
        .reduce((sum, entry) => sum + entry.amount, 0);
      expect(
        accounts.reduce((sum, account) => sum + plan.balances[account], 0),
      ).toBe(money(g) + issued - spent);
      const stockRich = structuredClone(g);
      for (const p of stockRich.core.provinces) p.stock += 100;
      expect(nationalForecast(stockRich)).toEqual(plan);
    },
  );
  it("真实转移同时减少来源、增加接收方，记录同一笔钱的去向且不创造财富", () => {
    let g = qualified();
    const total = money(g),
      local = accountBalance(g, "south"),
      central = g.core.treasury;
    g = go(g, {
      type: "fiscalTransfer",
      direction: "grant",
      province: "south",
      amount: 3,
    });
    expect(g.core.treasury).toBe(central - 3);
    expect(accountBalance(g, "south")).toBe(local + 3);
    expect(money(g)).toBe(total);
    expect(g.machine.fiscal!.ledger[0]).toMatchObject({
      from: "central",
      to: "south",
      amount: 3,
      category: "transfer",
    });
    const before = structuredClone(g);
    expect(() =>
      moveMoney(g, "south", "central", local + 4, "非法超额", "test"),
    ).toThrow();
    expect(g).toEqual(before);
  });
  it("无权征调及超额资金转移失败时不扣命令、不改账本或库存", () => {
    const g = qualified();
    g.machine.fiscal!.agreements = [];
    const action: Action = {
      type: "fiscalTransfer",
      direction: "levy",
      province: "south",
      amount: 3,
    };
    const result = executeCommand(g, action);
    expect(result.result.status).toBe("failed");
    expect(result.game).toBe(g);
    expect(result.result.errors.join()).toMatch(/权限|协议|签约/);
    expect(
      executeCommand(g, { ...action, direction: "grant", amount: 99 }).game,
    ).toBe(g);
  });
  it.each(["central", "local", "joint", "multi", "cult"] as const)(
    "%s合同的开工投资只扣真实参与账户，份额总和等于工程成本",
    (funding) => {
      const g = qualified();
      const action = gridAction(funding) as Extract<
        Action,
        { type: "project" }
      >;
      const expected = fundingPayments(
        makeFunding(g, action),
        workSpecs.grid.cost,
      );
      const before = new Map(
        accounts.map((account) => [account, accountBalance(g, account)]),
      );
      const n = go(g, action);
      for (const account of accounts)
        expect(accountBalance(n, account)).toBe(
          before.get(account)! -
            (expected.find((p) => p.account === account)?.amount ?? 0),
        );
      const investments = n.machine.fiscal!.ledger.filter(
        (entry) => entry.category === "investment",
      );
      expect(investments.reduce((sum, entry) => sum + entry.amount, 0)).toBe(
        workSpecs.grid.cost,
      );
      expect(money(g) - money(n)).toBe(workSpecs.grid.cost);
      expect(n.machine.works[0].contract).toMatchObject({
        mode: funding,
        source: n.machine.works[0].source,
      });
    },
  );
  it("多省出资不能通过重复同一账户伪造另一出资省", () => {
    const g = qualified();
    const action = { ...gridAction("multi"), partner: "south" } as Action;
    expect(executeCommand(g, action).game).toBe(g);
  });
});

describe("v0.5 测试B：税制改变真实收支、政治与地方建设", () => {
  it("中央统一征税转走地方留成、停止自主投资，并留下真实地方政治诉求", () => {
    let g = qualified();
    g.machine.fiscal!.autonomous.south = true;
    const original = nationalForecast(g),
      grievances = { ...g.core.grievances };
    g = go(g, { type: "fiscalReform", system: "central" });
    const centralized = nationalForecast(g);
    expect(centralized.income).toBeGreaterThan(original.income);
    expect(centralized.totalTax).toBe(original.totalTax);
    expect(centralized.locals.every((row) => row.localShare === 0)).toBe(true);
    expect(g.machine.fiscal!.autonomous.south).toBe(false);
    expect(g.machine.fiscal!.claims).toEqual(
      expect.arrayContaining(fiscalProvinces),
    );
    for (const pid of fiscalProvinces) {
      const governor = g.core.appointments[`gov-${pid}`]!;
      expect(g.core.grievances[governor]).toBe(grievances[governor] + 1);
    }
    expect(
      g.machine.history.some(
        (entry) =>
          entry.title.includes("财政制度改革：中央统一征税") &&
          entry.effects.some((effect) => effect.includes("积怨")),
      ),
    ).toBe(true);
  });
  it("自治税制保留地方收入，依靠可履职主管和真实地方余额自动建设且每省只建一次", () => {
    let g = qualified();
    const original = nationalForecast(g);
    g = go(g, { type: "fiscalReform", system: "autonomy" });
    g = go(g, { type: "localAutonomy", province: "south", enabled: true });
    const plan = nationalForecast(g),
      before = g.core.provinces.find((p) => p.id === "south")!.stock;
    expect(plan.income).toBeLessThan(original.income);
    expect(
      plan.locals.find((p) => p.province === "south")!.autoInvestment,
    ).toBe(true);
    settleFiscal(g, plan, "自治建设结算");
    expect(g.machine.fiscal!.localFacilities.south).toBe(true);
    expect(g.core.provinces.find((p) => p.id === "south")!.stock).toBe(
      before - 1,
    );
    const second = nationalForecast(g);
    expect(
      second.locals.find((p) => p.province === "south")!.autoInvestment,
    ).toBe(false);
    expect(second.locals.find((p) => p.province === "south")!.taxGross).toBe(
      plan.locals.find((p) => p.province === "south")!.taxGross + 1,
    );
  });
  it("地方短款必须形成真实违约，后到账税收不倒填本期已无法支付的日常费用", () => {
    const g = qualified();
    g.machine.fiscal!.locals.south = 0;
    const plan = nationalForecast(g),
      row = plan.locals.find((p) => p.province === "south")!;
    expect(row.default).toBe(true);
    expect(row.paid).toBe(0);
    expect(row.next).toBe(row.income);
    settleFiscal(g, plan, "地方现金不足");
    expect(g.machine.fiscal!.localDefaults.south).toBe(1);
    expect(g.machine.fiscal!.stableTurns).toBe(0);
  });
  it("地方自主建设不能用货币余额代替不存在的实物材料", () => {
    const g = qualified();
    g.machine.fiscal!.taxSystem = "autonomy";
    g.machine.fiscal!.autonomous.south = true;
    g.core.provinces.find((p) => p.id === "south")!.stock = 0;
    const forecast = nationalForecast(g);
    expect(
      forecast.locals.find((p) => p.province === "south")!.autoInvestment,
    ).toBe(false);
    expect(
      forecast.entries.some(
        (entry) =>
          entry.reason.includes("地方自主公共设施") && entry.from === "south",
      ),
    ).toBe(false);
  });
});

describe("v0.5 预测、结算与旧存档", () => {
  it("预测是无副作用的确定支付计划；中央与所有地方结算逐项一致", () => {
    let g = qualified();
    g = go(g, gridAction("joint"));
    const saved = serializeV2(g),
      forecast = nationalForecast(g);
    for (let i = 0; i < 4; i++) expect(nationalForecast(g)).toEqual(forecast);
    expect(serializeV2(g)).toBe(saved);
    expect(finance(g).next).toBe(forecast.next);
    const n = go(g, { type: "end" });
    expect(n.core.treasury).toBe(forecast.next);
    for (const account of fiscalProvinces)
      expect(accountBalance(n, account)).toBe(forecast.balances[account]);
    expect(accountBalance(n, "cult")).toBe(forecast.balances.cult);
    const settled = n.machine.fiscal!.ledger.filter(
      (entry) =>
        entry.turn === g.core.turn &&
        !g.machine.fiscal!.ledger.some((old) => old.id === entry.id),
    );
    expect(
      settled
        .map(({ id: _id, turn: _turn, source: _source, ...entry }) => entry)
        .reverse(),
    ).toEqual(forecast.entries.map(({ source: _source, ...entry }) => entry));
    for (const expected of forecast.entries.filter((entry) => entry.source))
      expect(settled).toEqual(
        expect.arrayContaining([expect.objectContaining(expected)]),
      );
  });
  it("旧v0.4保存原资金、库存、目标、随机数与工程，并只补全独立地方账户及中央融资合同", () => {
    let g = qualified();
    g = go(g, {
      type: "project",
      project: "energy",
      province: "south",
      worker: "mo",
      assignment: "dedicated",
    });
    const raw = JSON.parse(serializeV2(g));
    raw.machine.rulesVersion = "0.4.0";
    delete raw.machine.fiscal;
    delete raw.machine.secondaryAppointments;
    delete raw.machine.works[0].contract;
    const migrated = deserializeV2(JSON.stringify(raw));
    expect(migrated.machine.rulesVersion).toBe("0.6.0");
    expect(migrated.core.treasury).toBe(g.core.treasury);
    expect(migrated.core.provinces).toEqual(g.core.provinces);
    expect(migrated.core.rng).toBe(g.core.rng);
    expect(migrated.machine.goal).toBe(g.machine.goal);
    expect(migrated.machine.fiscal!.locals).toEqual({
      industry: 0,
      south: 0,
      north: 0,
    });
    expect(migrated.machine.works[0].contract).toMatchObject({
      owner: "central",
      mode: "central",
      shares: [{ account: "central", weight: 1 }],
    });
    expect(deserializeV2(serializeV2(migrated))).toEqual(migrated);
    expect(go(migrated, { type: "end" })).toEqual(
      go(deserializeV2(serializeV2(migrated)), { type: "end" }),
    );
  });
  it("当前v0.5存档缺失财政账本时必须拒绝，不能当旧档重新开户丢失账户余额", () => {
    const raw = JSON.parse(serializeV2(qualified()));
    delete raw.machine.fiscal;
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow();
  });
  it("当前v0.5既有地方工程缺失融资合同时拒绝读取，不得改成中央产权", () => {
    const g = go(qualified(), gridAction("local"));
    expect(g.machine.rulesVersion).toBe("0.6.0");
    expect(g.machine.works[0].contract!.owner).toBe("south");
    const raw = JSON.parse(serializeV2(g));
    delete raw.machine.works[0].contract;
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow(/融资合同/);
    expect(g.machine.works[0].contract!.owner).toBe("south");
  });
  it.each([
    "negativeBalance",
    "unknownTax",
    "negativeSettlements",
    "negativeStableTurns",
    "invalidAgreement",
    "badLedger",
  ])("拒绝损坏财政存档：%s，并不改动原始字符串", (caseName) => {
    const raw = JSON.parse(serializeV2(qualified()));
    if (caseName === "negativeBalance") raw.machine.fiscal.locals.south = -1;
    if (caseName === "unknownTax") raw.machine.fiscal.taxSystem = "free-money";
    if (caseName === "negativeSettlements") raw.machine.fiscal.settlements = -1;
    if (caseName === "negativeStableTurns") raw.machine.fiscal.stableTurns = -1;
    if (caseName === "invalidAgreement")
      raw.machine.fiscal.agreements = ["missing-province"];
    if (caseName === "badLedger")
      raw.machine.fiscal.ledger = [
        {
          id: "bad",
          turn: 1,
          from: "public",
          to: "central",
          amount: 99,
          reason: "虚构资金",
          source: "",
          category: "tax",
        },
      ];
    const text = JSON.stringify(raw);
    expect(() => deserializeV2(text)).toThrow();
    expect(JSON.stringify(raw)).toBe(text);
  });
  it.each([
    "unknownInvestor",
    "emptyShares",
    "negativeWeight",
    "unknownOwner",
    "invalidActive",
    "invalidFault",
    "negativeFaultTurn",
    "invalidConsent",
  ])("拒绝损坏的合同或电网状态：%s", (caseName) => {
    const { g } = completedGrid("joint");
    const raw = JSON.parse(serializeV2(g)),
      work = raw.machine.works[0];
    if (caseName === "unknownInvestor")
      work.contract.shares[0].account = "phantom-bank";
    if (caseName === "emptyShares") work.contract.shares = [];
    if (caseName === "negativeWeight") work.contract.shares[0].weight = -1;
    if (caseName === "unknownOwner") work.contract.owner = "phantom-operator";
    if (caseName === "invalidActive") work.network.active = "yes";
    if (caseName === "invalidFault") work.network.fault = 7;
    if (caseName === "negativeFaultTurn") work.network.faultAt = -1;
    if (caseName === "invalidConsent") work.network.consentUntil = "永不过期";
    expect(() => deserializeV2(JSON.stringify(raw))).toThrow();
  });
});

describe("v0.5 测试C/F：能源合同改变产权、产业和故障权限", () => {
  it("受益工业省隔离后电网停止运营，全国税源不再含隔离省的供能增益", () => {
    const { g, work } = completedGrid("central");
    const live = nationalForecast(g);
    const industrialTax = live.locals.find(
      (row) => row.province === "industry",
    )!.taxGross;
    expect(gridOperating(g, work)).toBe(true);
    const source = g.machine.matters.find(
      (matter) => matter.kind === "oldgod",
    )!;
    g.machine.matters.push({
      ...source,
      id: "beneficiary-isolation",
      province: "industry",
      isolated: true,
    });
    expect(gridOperating(g, work)).toBe(false);
    const isolated = nationalForecast(g);
    expect(
      isolated.locals.find((row) => row.province === "industry")!.taxGross,
    ).toBe(0);
    expect(isolated.totalTax).toBe(live.totalTax - industrialTax);
    expect(
      isolated.entries.some(
        (entry) => entry.category === "tax" && entry.source === work.source,
      ),
    ).toBe(false);
    expect(isolated.maintenance).toBe(live.maintenance);
  });
  it("真实供能增加工业实物产出和税源，停机同时关闭两者但继续履行维护", () => {
    const { g, work } = completedGrid("central");
    const closed = go(g, {
      type: "network",
      work: work.id,
      operation: "close",
    });
    expect(finance(closed).maintenance).toBe(finance(g).maintenance);
    expect(finance(g).income).toBeGreaterThan(finance(closed).income);
    const liveNext = go(g, { type: "end" }),
      closedNext = go(closed, { type: "end" });
    expect(
      liveNext.core.provinces.find((p) => p.id === "industry")!.stock,
    ).toBe(
      closedNext.core.provinces.find((p) => p.id === "industry")!.stock + 2,
    );
    expect(liveNext.core.treasury).toBe(finance(g).next);
    expect(closedNext.core.treasury).toBe(finance(closed).next);
  });
  it("中央无力独资时可签约联合投资，实际合同资金、供应关系与收益分成持续生效", () => {
    let g = qualified();
    g.core.treasury = workSpecs.grid.cost - 1;
    expect(executeCommand(g, gridAction("central")).game).toBe(g);
    g = go(g, gridAction("joint"));
    expect(g.machine.works[0].contract!.owner).toBe("joint");
    g = go(g, {
      type: "fiscalTransfer",
      province: "south",
      direction: "levy",
      amount: 5,
    });
    for (
      let i = 0;
      i < workSpecs.grid.duration + 1 && !g.machine.works[0].completed;
      i++
    ) {
      if (nationalForecast(g).default)
        g = go(g, {
          type: "fiscalTransfer",
          province: "south",
          direction: "levy",
          amount: 5,
        });
      g = go(g, { type: "end" });
    }
    const w = g.machine.works[0];
    expect(w.completed).toBe(true);
    expect(w.to).toBe("industry");
    expect(gridOperating(g, w)).toBe(true);
    const live = nationalForecast(g);
    w.network!.active = false;
    const closed = nationalForecast(g);
    expect(live.locals.find((p) => p.province === "industry")!.taxGross).toBe(
      closed.locals.find((p) => p.province === "industry")!.taxGross + 2,
    );
    expect(w.contract!.shares.map((share) => share.account)).toEqual([
      "central",
      "south",
    ]);
    expect(
      live.entries.some(
        (entry) => entry.source === w.source && entry.category === "tax",
      ),
    ).toBe(true);
    w.network!.active = true;
    expect(deserializeV2(serializeV2(g))).toEqual(g);
    g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
    g = go(g, { type: "end" });
    expect(g.machine.works[0].network!.fault).toBe(true);
    g = go(g, { type: "network", work: w.id, operation: "repair" });
    expect(
      nationalForecast(g).entries.some(
        (entry) =>
          entry.source === w.source &&
          entry.to === "south" &&
          entry.category === "tax",
      ),
    ).toBe(true);
  });
  it.each(["local", "cult"] as const)(
    "%s经营权使中央不能直接停机；真实同意后才打开中央操作权限",
    (funding) => {
      const { g: original, work } = completedGrid(funding);
      const close: Action = {
        type: "network",
        work: work.id,
        operation: "close",
      };
      const blocked = executeCommand(original, close);
      expect(blocked.result.status).toBe("failed");
      expect(blocked.game).toBe(original);
      expect(blocked.result.errors.join()).toMatch(/产权|同意|经营|管理/);
      const consented = go(original, {
        type: "network",
        work: work.id,
        operation: "consent",
      });
      expect(previewAction(consented, close).errors).toHaveLength(0);
      const closed = go(consented, close);
      expect(
        closed.machine.works.find((w) => w.id === work.id)!.network!.active,
      ).toBe(false);
      expect(gridOperating(closed, closed.machine.works[0])).toBe(false);
    },
  );
  it("能源工程真实故障在竣工后发生、降低受益省税源并记录工程来源，修复须满足实际组织资格", () => {
    let { g, work } = completedGrid("central");
    const before = nationalForecast(g).locals.find(
      (p) => p.province === "industry",
    )!.taxGross;
    for (let i = 0; i < 3 && !g.machine.works[0].network!.fault; i++)
      g = go(g, { type: "end" });
    work = g.machine.works[0];
    expect(work.network!.fault).toBe(true);
    expect(work.network!.faultSeen).toBe(true);
    expect(gridOperating(g, work)).toBe(false);
    expect(
      nationalForecast(g).locals.find((p) => p.province === "industry")!
        .taxGross,
    ).toBe(before - 2);
    expect(
      g.machine.history.some(
        (entry) =>
          entry.parents.includes(work.source) && entry.title.includes("电网"),
      ),
    ).toBe(true);
    const restored = deserializeV2(serializeV2(g));
    expect(
      go(restored, { type: "network", work: work.id, operation: "repair" }),
    ).toEqual(go(g, { type: "network", work: work.id, operation: "repair" }));
    g.core.appointments.plan = null;
    const repair: Action = {
      type: "network",
      work: work.id,
      operation: "repair",
    };
    expect(executeCommand(g, repair).game).toBe(g);
  });
  it("相同随机种子、合同与操作产生相同故障；预览和反复读取不提前消耗随机数", () => {
    const g = qualified("v05-电网风险种子"),
      rng = g.core.rng;
    for (let i = 0; i < 10; i++) previewAction(g, gridAction("joint"));
    expect(g.core.rng).toBe(rng);
    let a = go(g, gridAction("joint"));
    let b = go(deserializeV2(serializeV2(g)), gridAction("joint"));
    for (let turn = 0; turn < 5; turn++) {
      a = go(a, { type: "end" });
      b = go(deserializeV2(serializeV2(b)), { type: "end" });
      expect(b).toEqual(a);
    }
  });
});

describe("v0.5 测试J：原始资源十二回合富国新政", () => {
  it("通过真实战略选择、协商、改革、联合融资、工程与维修完成完整任期", () => {
    let g = startCampaign({
      mode: "experimental",
      seed: "v05-真实财政富国新政",
      difficulty: "standard",
      politics: "classic",
    });
    const initial = {
      treasury: g.core.treasury,
      locals: { ...g.machine.fiscal!.locals },
    };
    const action = (a: Action) => {
      const preview = previewAction(g, a);
      if (preview.errors.length)
        throw new Error(
          `第${g.core.turn}回合（中央${g.core.treasury}，命令${g.core.commands}，资本${g.core.capital}）${JSON.stringify(a)}：${preview.errors.join("；")}`,
        );
      g = go(g, a);
    };
    const resolve = (kind: string, option: string) =>
      action({
        type: "resolve",
        matter: g.machine.matters.find((m) => m.kind === kind)!.id,
        option,
      });
    const end = () => {
      if (finance(g).default)
        throw new Error(
          `结算前第${g.core.turn}回合：${JSON.stringify(finance(g))}`,
        );
      action({ type: "end" });
      expect(
        g.core.status,
        `${g.core.ending}；第${g.core.turn}回合中央${g.core.treasury}`,
      ).toBe("playing");
    };
    expect(initial.treasury).toBe(12);
    expect(Object.values(initial.locals)).toEqual([6, 6, 6]);
    action({ type: "regime", regime: "vertical" });
    resolve("warning", "observe");
    resolve("gazette", "standard");
    action({ type: "investigate", deck: "ley" });
    action({ type: "policy", issue: "method", side: 1 });
    end();
    action({ type: "selectGoal", goal: "prosperity" });
    action({ type: "coordinate", province: "south", kind: "agreement" });
    resolve("accident", "seal");
    action({ type: "department", department: "anomaly", scope: "south" });
    end();
    action({
      type: "authorize",
      matter: g.machine.matters.find((m) => m.kind === "distrust")!.id,
      lead: "gov-south",
      joint: false,
      emergency: false,
    });
    resolve("distrust", "rights");
    action({
      type: "project",
      project: "energy",
      province: "south",
      worker: "mo",
      assignment: "dedicated",
    });
    action({ type: "audit", province: "industry", lead: "gov-industry" });
    action({ type: "budget", department: "defense", level: 0 });
    end();
    action({ type: "fiscalAgreement", province: "south" });
    action({ type: "survey", province: "industry", field: "resources" });
    resolve("oldgod", "seal");
    end();
    action({
      type: "project",
      project: "factory",
      province: "industry",
      worker: "han",
      assignment: "dedicated",
    });
    action(gridAction("joint"));
    action({
      type: "fiscalTransfer",
      province: "south",
      direction: "levy",
      amount: 4,
    });
    end();
    action({ type: "appoint", office: "gov-south", person: "mo" });
    action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 1,
    });
    end();
    end();
    action({
      type: "fiscalTransfer",
      province: "south",
      direction: "grant",
      amount: 2,
    });
    end();
    const grid = g.machine.works.find((w) => w.type === "grid")!;
    expect(grid.completed).toBe(true);
    while (g.core.turn < 12) {
      if (g.machine.works.find((w) => w.id === grid.id)!.network!.fault)
        action({ type: "network", work: grid.id, operation: "repair" });
      if (
        g.core.turn >= 10 &&
        !g.machine.terminalInspected &&
        previewAction(g, { type: "inspect" }).errors.length === 0
      )
        action({ type: "inspect" });
      end();
      if (g.core.turn === 10) g = deserializeV2(serializeV2(g));
    }
    expect(g.machine.terminalInspected).toBe(true);
    resolve("final", "activate");
    action({ type: "end" });
    expect(g.core.status).toBe("won");
    expect(g.core.turn).toBe(12);
    expect(g.core.insolvency).toBe(0);
    expect(g.machine.fiscal!.stableTurns).toBeGreaterThanOrEqual(3);
    expect(g.machine.works.filter((w) => w.completed)).toHaveLength(3);
    expect(g.machine.works.find((w) => w.type === "grid")!.contract!.mode).toBe(
      "joint",
    );
    expect(
      g.machine.history.some((entry) =>
        entry.title.includes("维修跨省灵能电网"),
      ),
    ).toBe(true);
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
});
