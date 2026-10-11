import { facilityOperating } from "./operations";
import { getOffice } from "../data";
import type { ProvinceId } from "../types";
import {
  availableOfficer,
  workOperating,
  workReadiness,
  workSpecs,
} from "./administration";
import { officePerson } from "./personnel";
import type {
  Action,
  Condition,
  FiscalAccount,
  FiscalState,
  FundingContract,
  FundingMode,
  LedgerEntry,
  TaxSystem,
  V2Game,
  V2Preview,
  Work,
  Maintenance,
} from "./model";

export const fiscalProvinces: ProvinceId[] = ["industry", "south", "north"];
export const taxSystems: Record<
  TaxSystem,
  { name: string; description: string; gain: string; loss: string }
> = {
  split: {
    name: "分税与专项财政",
    description:
      "同一税源按份分配，工业/灵脉地区中央约三分之二、地方保留其余；边境各半。",
    gain: "支持签约联合工程，央地各有日常预算。",
    loss: "共同项目仍须地方协议和专业规划；税源争议不能自动消失。",
  },
  central: {
    name: "中央统一征税",
    description: "全部常规税源进入中央，地方依靠现有余额及专项拨款。",
    gain: "全国工程的付款能力集中，法定中央征调渠道开放。",
    loss: "地方日常支出不消失；地方亏空会提出援助诉求，自主项目缺少资金。",
  },
  autonomy: {
    name: "地方财政自治",
    description: "每个产税省向中央交纳至多1税，剩余税源留地方。",
    gain: "地方可以自主建设并承担当地项目。",
    loss: "中央机关与全国工程须通过合作、融资和实际资金上缴维持。",
  },
};
export const fundingLabels: Record<FundingMode, string> = {
  central: "中央独资",
  local: "地方自主投资",
  joint: "中央—地方分担",
  multi: "多省联合出资",
  cult: "国家—宗门合资",
};
export function newFiscal(): FiscalState {
  return {
    taxSystem: "split",
    locals: { industry: 6, south: 6, north: 6 },
    cultTreasury: 5,
    agreements: [],
    autonomous: { industry: false, south: false, north: false },
    localFacilities: { industry: false, south: false, north: false },
    ledger: [],
    settlements: 0,
    stableTurns: 0,
    localDefaults: { industry: 0, south: 0, north: 0 },
    claims: [],
  };
}
export function accountLabel(g: V2Game, a: string) {
  return a === "central"
    ? "中央财政"
    : a === "cult"
      ? "宗门合作基金"
      : a === "economy"
        ? "地区经济税源"
        : a === "public"
          ? "公共支出"
          : g.core.provinces.find((p) => p.id === a)?.name || a;
}
export function accountBalance(g: V2Game, a: FiscalAccount) {
  return a === "central"
    ? g.core.treasury
    : a === "cult"
      ? (g.machine.fiscal?.cultTreasury ?? 0)
      : (g.machine.fiscal?.locals[a] ?? 0);
}
export function addLedger(
  g: V2Game,
  from: LedgerEntry["from"],
  to: LedgerEntry["to"],
  amount: number,
  reason: string,
  source: string,
  category: LedgerEntry["category"],
) {
  if (amount <= 0 || !g.machine.fiscal) return;
  g.machine.fiscal.ledger.unshift({
    id: `ledger-${g.core.nextId++}`,
    turn: g.core.turn,
    from,
    to,
    amount,
    reason,
    source,
    category,
  });
}
export function setBalance(g: V2Game, a: FiscalAccount, n: number) {
  if (a === "central") g.core.treasury = n;
  else if (a === "cult") g.machine.fiscal!.cultTreasury = n;
  else g.machine.fiscal!.locals[a] = n;
}
export function moveMoney(
  g: V2Game,
  from: FiscalAccount,
  to: FiscalAccount,
  amount: number,
  reason: string,
  source: string,
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    accountBalance(g, from) < amount
  )
    throw new Error("财政转移账户或余额无效");
  setBalance(g, from, accountBalance(g, from) - amount);
  setBalance(g, to, accountBalance(g, to) + amount);
  addLedger(g, from, to, amount, reason, source, "transfer");
}
export function makeFunding(
  _g: V2Game,
  a: Extract<Action, { type: "project" }>,
  source = "",
): FundingContract {
  const mode = a.funding ?? "central",
    pid = a.province;
  const shares: FundingContract["shares"] =
    mode === "central"
      ? [{ account: "central", weight: 1 }]
      : mode === "local"
        ? [{ account: pid, weight: 1 }]
        : mode === "joint"
          ? [
              { account: "central", weight: 1 },
              { account: pid, weight: 1 },
            ]
          : mode === "cult"
            ? [
                { account: "central", weight: 1 },
                { account: "cult", weight: 1 },
              ]
            : [
                { account: "central", weight: 1 },
                { account: pid, weight: 1 },
                { account: a.partner ?? a.to ?? "industry", weight: 1 },
              ];
  return {
    mode,
    shares,
    owner:
      mode === "local"
        ? pid
        : mode === "cult"
          ? "cult"
          : mode === "central"
            ? "central"
            : "joint",
    beneficiary: a.project === "grid" ? (a.to ?? "industry") : a.to,
    source,
  };
}
export function workFunding(_g: V2Game, w: Work): FundingContract {
  return (
    w.contract ?? {
      mode: "central",
      shares: [{ account: "central", weight: 1 }],
      owner: "central",
      source: w.source,
    }
  );
}
export function fundingPayments(
  contract: FundingContract,
  amount: number,
  offset = 0,
) {
  const wheel = contract.shares.flatMap((s) =>
      Array.from({ length: s.weight }, () => s.account),
    ),
    sums = new Map<FiscalAccount, number>();
  for (let i = 0; i < amount; i++) {
    const account = wheel[(i + offset) % wheel.length];
    sums.set(account, (sums.get(account) ?? 0) + 1);
  }
  return [...sums].map(([account, amount]) => ({ account, amount }));
}
const c = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
export function fundingConditions(
  g: V2Game,
  a: Extract<Action, { type: "project" }>,
): Condition[] {
  const mode = a.funding ?? "central",
    f = g.machine.fiscal,
    contract = makeFunding(g, a),
    payments = fundingPayments(contract, workSpecs[a.project].cost);
  const out = [
    c(
      "可追踪的出资方式",
      Object.hasOwn(fundingLabels, mode),
      "选择中央、地方、央地、多省或宗门出资",
    ),
  ];
  if (mode !== "central")
    out.push(
      c(
        "地方/宗门融资制度",
        !!f && g.machine.cooperation && g.core.policies.method === 1,
        "须先建立合作与协商政策；资金不等于地方同意",
      ),
    );
  if (["local", "joint", "multi"].includes(mode))
    out.push(
      c(
        "本省投资协议",
        !!f?.agreements.includes(a.province) &&
          g.machine.rights[a.province] &&
          g.machine.trust[a.province] >= 2,
        "保留当地收益权、信任至少2，签署财政共同承担协议",
      ),
    );
  if (mode === "multi")
    out.push(
      c(
        "另一出资省的有效协议",
        !!a.partner &&
          a.partner !== a.province &&
          !!f?.agreements.includes(a.partner),
        "选择另一个已签约省，不能用一个账户重复出资",
      ),
    );
  if (mode === "cult")
    out.push(
      c(
        "宗门经营条件",
        a.province === "south" &&
          g.machine.surveyed &&
          g.machine.rights.south &&
          g.machine.trust.south >= 2,
        "宗门合资须南岭勘探、地方收益权和信任；宗门取得经营与停机控制权",
      ),
    );
  for (const p of payments)
    out.push(
      c(
        `${accountLabel(g, p.account)}出资${p.amount}`,
        accountBalance(g, p.account) >= p.amount,
        "出资方当前余额不足；本期税收尚未到账，不能提前透支",
      ),
    );
  return out;
}
export function debitProjectPartners(
  g: V2Game,
  a: Extract<Action, { type: "project" }>,
  source: string,
) {
  const contract = makeFunding(g, a, source);
  for (const p of fundingPayments(contract, workSpecs[a.project].cost)) {
    if (p.account !== "central")
      setBalance(g, p.account, accountBalance(g, p.account) - p.amount);
    addLedger(
      g,
      p.account,
      "public",
      p.amount,
      `开工：${workSpecs[a.project].name}（${fundingLabels[contract.mode]}）`,
      source,
      "investment",
    );
  }
  return contract;
}
export const gridOperating = (g: V2Game, w: Work) =>
  w.type === "grid" && facilityOperating(g, w);

/** A single deterministic payment plan drives both the forecast and settlement. */
export function nationalForecast(g: V2Game) {
  const f = g.machine.fiscal ?? newFiscal(),
    balances: Record<FiscalAccount, number> = {
      central: g.core.treasury,
      industry: f.locals.industry,
      south: f.locals.south,
      north: f.locals.north,
      cult: f.cultTreasury,
    };
  const entries: Omit<LedgerEntry, "id" | "turn">[] = [],
    centralMaintenance: { label: string; amount: number }[] = [],
    centralSources: { label: string; amount: number }[] = [],
    constructionFunded: string[] = [];
  const facilities: { work: string; maintenance: Maintenance }[] = [];
  const operatingGame: V2Game = {
    ...g,
    machine: { ...g.machine, works: g.machine.works.map((w) => ({ ...w })) },
  };
  const localRows = fiscalProvinces.map((pid) => ({
    province: pid,
    current: balances[pid],
    income: 0,
    taxGross: 0,
    centralShare: 0,
    localShare: 0,
    operating: 1,
    maintenance: 0,
    projectCosts: 0,
    total: 0,
    paid: 0,
    next: 0,
    default: false,
    autoInvestment: false,
  }));
  const local = (pid: ProvinceId) => localRows.find((p) => p.province === pid)!;
  const emit = (
    from: LedgerEntry["from"],
    to: LedgerEntry["to"],
    amount: number,
    reason: string,
    category: LedgerEntry["category"],
    source = "",
  ) => {
    if (amount <= 0) return;
    if (from !== "economy") balances[from] -= amount;
    if (to !== "public") balances[to] += amount;
    entries.push({ from, to, amount, reason, category, source });
  };
  const pay = (
    account: FiscalAccount,
    amount: number,
    reason: string,
    category: LedgerEntry["category"],
    source = "",
  ) => {
    const paid = Math.min(balances[account], amount);
    emit(account, "public", paid, reason, category, source);
    return paid;
  };
  const fixed =
    4 -
    Object.values(g.machine.departmentBudgets).filter((x) => x === 0).length;
  const centralFixedPaid = pay(
    "central",
    fixed,
    "中央机关基本运作",
    "operation",
  );
  const maintenanceSources = [
    ...(g.machine.regime === "joint"
      ? [{ label: "联合委员会", amount: 1 }]
      : []),
    ...(g.machine.standards ? [{ label: "工业兼容标准", amount: 1 }] : []),
    ...(["plan", "anomaly", "defense"] as const)
      .filter((x) => g.machine.departmentBudgets[x] === 2)
      .map((x) => ({ label: `${getOffice(x).name}专项预算`, amount: 1 })),
  ];
  let centralObligation = fixed;
  for (const row of maintenanceSources) {
    centralObligation += row.amount;
    pay("central", row.amount, row.label, "maintenance");
    centralMaintenance.push(row);
  }
  for (const pid of g.machine.budgets) {
    centralObligation++;
    const amount = Math.min(1, balances.central);
    emit(
      "central",
      pid,
      amount,
      "既有地方合作预算转移",
      "transfer",
      g.machine.origins[`rights:${pid}`] ?? "",
    );
    centralMaintenance.push({
      label: `${accountLabel(g, pid)}合作转移`,
      amount: 1,
    });
  }
  for (const w of g.machine.works.filter((w) => w.completed && !w.cancelled)) {
    const fee = workSpecs[w.type].maintenance;
    if (!fee) continue;
    const current = w.maintenanceSponsor
      ? [{ account: w.maintenanceSponsor, amount: fee }]
      : fundingPayments(workFunding(g, w), fee, g.core.turn);
    const owed = new Map<FiscalAccount, number>();
    for (const row of w.maintenance?.payments ?? [])
      if (row.arrears) owed.set(row.account, row.arrears);
    for (const row of current)
      owed.set(row.account, (owed.get(row.account) ?? 0) + row.amount);
    const payments = [...owed].map(([account, due]) => {
      if (account === "central") {
        centralObligation += due;
        centralMaintenance.push({
          label: `${workSpecs[w.type].name}维护（含往期欠款）`,
          amount: due,
        });
      } else if (account !== "cult") local(account).maintenance += due;
      const paid = pay(
        account,
        due,
        `${workSpecs[w.type].name}设施维护`,
        "maintenance",
        w.source,
      );
      return { account, due, paid, arrears: due - paid };
    });
    const due = payments.reduce((n, p) => n + p.due, 0),
      paid = payments.reduce((n, p) => n + p.paid, 0);
    const maintenance: Maintenance = {
      turn: g.core.turn,
      fee,
      due,
      paid,
      arrears: due - paid,
      payments,
      lastPaidTurn: due === paid ? g.core.turn : w.maintenance?.lastPaidTurn,
      source: w.sponsorSource ?? w.source,
    };
    facilities.push({ work: w.id, maintenance });
    operatingGame.machine.works.find((x) => x.id === w.id)!.maintenance =
      maintenance;
  }
  for (const row of localRows) {
    const crisis = g.machine.matters.some(
      (m) =>
        m.province === row.province &&
        ["accident", "oldgod"].includes(m.kind) &&
        m.stage >= 2 &&
        !m.isolated &&
        m.containment === 0,
    );
    row.operating = 1 + (crisis ? 1 : 0);
    const paid = pay(
      row.province,
      row.operating,
      crisis ? "地方日常运作与应急配给" : "地方日常运作",
      "operation",
    );
    row.paid += paid;
    row.default = paid < row.operating;
  }
  let projectCosts = 0;
  for (const w of g.machine.works.filter(
    (w) =>
      !w.completed &&
      !w.cancelled &&
      !w.paused &&
      workReadiness(g, w).every((c) => c.met),
  )) {
    const payments = fundingPayments(workFunding(g, w), 1, w.progress);
    for (const p of payments) {
      if (p.account === "central") projectCosts += p.amount;
      else if (p.account !== "cult") local(p.account).projectCosts += p.amount;
    }
    if (
      payments.every((p) => balances[p.account] >= p.amount) &&
      centralFixedPaid === fixed
    ) {
      constructionFunded.push(w.id);
      for (const p of payments)
        pay(
          p.account,
          p.amount,
          `${workSpecs[w.type].name}本期施工`,
          "investment",
          w.source,
        );
    }
  }
  const splitTax = (pid: ProvinceId, gross: number) => {
    const central =
      f.taxSystem === "central"
        ? gross
        : f.taxSystem === "autonomy"
          ? Math.min(1, gross)
          : Math.floor(gross * (pid === "north" ? 0.5 : 2 / 3));
    return { central, local: gross - central };
  };
  for (const p of g.core.provinces) {
    const isolated = g.machine.matters.some(
      (m) => m.province === p.id && m.isolated,
    );
    let gross = isolated ? 0 : p.districts.reduce((a, d) => a + d.output, 0);
    if (!isolated && f.localFacilities[p.id] && g.machine.trust[p.id] > 0)
      gross++;
    if (
      !isolated &&
      operatingGame.machine.works.some(
        (w) => gridOperating(operatingGame, w) && (w.to ?? "industry") === p.id,
      )
    )
      gross += 2;
    const share = splitTax(p.id, gross),
      row = local(p.id);
    row.taxGross = gross;
    row.centralShare = share.central;
    row.localShare = share.local;
    row.income = share.local;
    emit("economy", "central", share.central, `${p.name}常规税源分配`, "tax");
    emit("economy", p.id, share.local, `${p.name}地方留成`, "tax");
    centralSources.push({
      label: `${p.name}税源${gross} → 中央${share.central} / 地方${share.local}`,
      amount: share.central,
    });
  }
  for (const w of g.machine.works) {
    const operating =
        w.type === "grid"
          ? gridOperating(
              operatingGame,
              operatingGame.machine.works.find((x) => x.id === w.id)!,
            )
          : workOperating(
              operatingGame,
              operatingGame.machine.works.find((x) => x.id === w.id)!,
            ),
      gross = operating ? workSpecs[w.type].income : 0;
    if (!gross) continue;
    const contract = workFunding(g, w),
      allocated =
        contract.owner === "central"
          ? [{ account: "central" as FiscalAccount, amount: gross }]
          : contract.owner === "joint"
            ? fundingPayments(contract, gross, g.core.turn)
            : [{ account: contract.owner as FiscalAccount, amount: gross }];
    for (const p of allocated) {
      emit(
        "economy",
        p.account,
        p.amount,
        `${workSpecs[w.type].name}投资收益分配`,
        "tax",
        w.source,
      );
      if (p.account === "central")
        centralSources.push({
          label: `${workSpecs[w.type].name}中央产权收入`,
          amount: p.amount,
        });
      else if (p.account !== "cult") local(p.account).income += p.amount;
    }
  }
  for (const pid of fiscalProvinces)
    if ((g.machine.audits[pid]?.bonusUntil ?? -1) >= g.core.turn) {
      emit(
        "economy",
        "central",
        1,
        `${accountLabel(g, pid)}限期税制整顿`,
        "audit",
        g.machine.origins[`audit:${pid}`] ?? "",
      );
      centralSources.push({
        label: `${accountLabel(g, pid)}稽核后税制整顿`,
        amount: 1,
      });
    }
  for (const row of localRows) {
    row.total = row.operating + row.maintenance + row.projectCosts;
    row.paid = entries
      .filter((e) => e.from === row.province && e.to === "public")
      .reduce((sum, e) => sum + e.amount, 0);
    row.default ||= row.paid < row.operating + row.maintenance;
    const gov = officePerson(g, `gov-${row.province}`);
    if (
      f.autonomous[row.province] &&
      f.taxSystem !== "central" &&
      !f.localFacilities[row.province] &&
      !row.default &&
      balances[row.province] >= 4 &&
      g.core.provinces.find((p) => p.id === row.province)!.stock >= 1 &&
      !g.machine.matters.some(
        (m) => m.province === row.province && m.isolated,
      ) &&
      availableOfficer(g, gov) &&
      g.machine.trust[row.province] >= 2 &&
      !g.machine.suppressed[row.province]
    ) {
      row.autoInvestment = true;
      emit(
        row.province,
        "public",
        3,
        "地方自主公共设施投资（每省一次）",
        "investment",
      );
    }
    row.next = balances[row.province];
  }
  const income = centralSources.reduce((s, r) => s + r.amount, 0),
    maintenance = centralMaintenance.reduce((s, r) => s + r.amount, 0),
    total = fixed + maintenance + projectCosts;
  const paid = entries
    .filter((e) => e.from === "central")
    .reduce((s, e) => s + e.amount, 0);
  return {
    current: g.core.treasury,
    income,
    fixed,
    maintenance,
    projectCosts,
    total,
    paid,
    next: balances.central,
    default: g.core.treasury < centralObligation + projectCosts,
    sources: centralSources,
    maintenanceSources: centralMaintenance,
    locals: localRows,
    totalTax: localRows.reduce((s, r) => s + r.taxGross, 0),
    constructionFunded,
    facilities,
    entries,
    balances,
  };
}
export function settleFiscal(
  g: V2Game,
  plan: ReturnType<typeof nationalForecast>,
  source: string,
) {
  const f = g.machine.fiscal!;
  for (const row of plan.facilities)
    g.machine.works.find((w) => w.id === row.work)!.maintenance =
      structuredClone(row.maintenance);
  g.core.treasury = plan.next;
  f.cultTreasury = plan.balances.cult;
  for (const p of plan.locals) {
    f.locals[p.province] = p.next;
    f.localDefaults[p.province] = p.default
      ? f.localDefaults[p.province] + 1
      : 0;
    if (p.autoInvestment) {
      f.localFacilities[p.province] = true;
      g.core.provinces.find((r) => r.id === p.province)!.stock = Math.max(
        0,
        g.core.provinces.find((r) => r.id === p.province)!.stock - 1,
      );
    }
  }
  for (const e of plan.entries)
    addLedger(
      g,
      e.from,
      e.to,
      e.amount,
      e.reason,
      e.source || source,
      e.category,
    );
  f.settlements++;
  f.stableTurns =
    plan.default ||
    plan.locals.some((p) => p.default) ||
    plan.facilities.some((x) => x.maintenance.arrears > 0)
      ? 0
      : f.stableTurns + 1;
}
export type FiscalAction = Extract<
  Action,
  {
    type:
      | "fiscalReform"
      | "fiscalTransfer"
      | "fiscalAgreement"
      | "localAutonomy";
  }
>;
export function isFiscal(a: Action): a is FiscalAction {
  return [
    "fiscalReform",
    "fiscalTransfer",
    "fiscalAgreement",
    "localAutonomy",
  ].includes(a.type);
}
export function fiscalPreview(g: V2Game, a: FiscalAction): Partial<V2Preview> {
  const f = g.machine.fiscal!,
    conditions: Condition[] = [],
    costs = { commands: 1, treasury: 0, capital: 0, stock: 0 },
    effects: string[] = [],
    actors: string[] = [],
    institutions = ["plan"];
  let title = "财政安排";
  const officer = (o: string) => {
    const id = officePerson(g, o);
    if (id) actors.push(id);
    return availableOfficer(g, id);
  };
  if (a.type === "fiscalReform") {
    title = `财政制度改革：${taxSystems[a.system]?.name ?? "未知"}`;
    costs.capital = 2;
    costs.treasury = 1;
    conditions.push(
      c(
        "实际税制变更",
        !!taxSystems[a.system] && f.taxSystem !== a.system,
        "选择不同的税制",
      ),
      c(
        "中央税务组织可履职",
        officer("plan") && g.machine.departmentBudgets.plan > 0,
        "计划部门需可用负责人及基本预算",
      ),
    );
    if (a.system === "autonomy")
      conditions.push(
        c(
          "地方负责人实际在位",
          fiscalProvinces.every((pid) =>
            availableOfficer(g, officePerson(g, `gov-${pid}`)),
          ),
          "财政自治需要省政府能承担收支责任",
        ),
      );
    if (a.system === "split")
      conditions.push(
        c(
          "分税协调基础",
          g.machine.cooperation && g.core.policies.method === 1,
          "先建立协商政策和合作渠道",
        ),
      );
    effects.push(
      taxSystems[a.system]?.description ?? "",
      taxSystems[a.system]?.loss ?? "",
      "立即改变后续税收分配；统一征税使地方主管积怨+1、暂停地方自主投资，产生补偿谈判。",
    );
  } else if (a.type === "fiscalAgreement") {
    title = "签署地方共同出资协议";
    costs.capital = 1;
    institutions.push(`gov-${a.province}`);
    conditions.push(
      c(
        "双方可履职",
        officer("plan") && officer(`gov-${a.province}`),
        "中央计划主管与本省主管须未拒绝、未专职派遣或抽调",
      ),
      c(
        "收益权与协商基础",
        g.machine.rights[a.province] &&
          g.machine.trust[a.province] >= 2 &&
          g.machine.cooperation &&
          g.core.policies.method === 1,
        "先保留当地收益权、信任2、建立协商政策和合作",
      ),
      c(
        "未重复协议",
        !f.agreements.includes(a.province),
        "本省已有长期财政共同承担协议",
      ),
    );
    effects.push(
      "解锁该省地方独资、央地或多省融资及实际资金上缴；协议保留地方管理参与，不自动取得电网关闭权。",
    );
  } else if (a.type === "fiscalTransfer") {
    title = a.direction === "grant" ? "中央专项拨款" : "地方特别上缴";
    const from = a.direction === "grant" ? "central" : a.province,
      to = a.direction === "grant" ? a.province : "central";
    conditions.push(
      c(
        "真实资金与余额",
        Number.isSafeInteger(a.amount) &&
          a.amount >= 1 &&
          a.amount <= 5 &&
          accountBalance(g, from) >= a.amount,
        "每次1～5资金，来源账户必须有余额",
      ),
      c("财政主管可履职", officer("plan"), "中央计划主管须有实际行动能力"),
    );
    if (a.direction === "levy")
      conditions.push(
        c(
          "征调权限或签约",
          f.taxSystem === "central" || f.agreements.includes(a.province),
          "中央统一征税或该省共同承担协议允许上缴；资源库存不是资金",
        ),
        c(
          "地方履约能力",
          officer(`gov-${a.province}`) && g.machine.trust[a.province] > 0,
          "地方主管须可履职、信任不能归零",
        ),
      );
    effects.push(
      `${accountLabel(g, from)} -${a.amount}，${accountLabel(g, to)} +${a.amount}；全国资金守恒。`,
      a.direction === "levy" && f.taxSystem === "central"
        ? "强制统一征调使本地信任-1，缺钱地方会申请援助。"
        : "协议拨款/上缴按真实账本记录，不增加全国财富。",
    );
  } else {
    title = "地方自主投资安排";
    conditions.push(
      c(
        "实际计划变更",
        f.autonomous[a.province] !== a.enabled,
        "本省计划已是该状态",
      ),
      c("地方行政责任", officer(`gov-${a.province}`), "地方主管须可履职"),
    );
    if (a.enabled)
      conditions.push(
        c(
          "自主财政权限",
          f.taxSystem !== "central" && g.machine.rights[a.province],
          "自治/分税并保留地方权利才能自行投资",
        ),
      );
    effects.push(
      "允许后续结算在日常承诺得到履行、余额至少4且信任2时，用3地方资金与1物资建设一次公共设施；以后真实产出和税源+1，不重复无限建。",
    );
  }
  return { title, conditions, costs, effects, actors, institutions };
}
export function applyFiscal(g: V2Game, a: FiscalAction, source: string) {
  const f = g.machine.fiscal!;
  if (a.type === "fiscalReform") {
    f.taxSystem = a.system;
    g.machine.origins.taxSystem = source;
    if (a.system === "central")
      for (const pid of fiscalProvinces) {
        const id = officePerson(g, `gov-${pid}`);
        if (id) g.core.grievances[id]++;
        f.autonomous[pid] = false;
        if (!f.claims.includes(pid)) f.claims.push(pid);
      }
    g.machine.occupied[officePerson(g, "plan")!] = source;
  } else if (a.type === "fiscalAgreement") {
    f.agreements.push(a.province);
    g.machine.origins[`financeAgreement:${a.province}`] = source;
    for (const o of ["plan", `gov-${a.province}`])
      g.machine.occupied[officePerson(g, o)!] = source;
  } else if (a.type === "fiscalTransfer") {
    moveMoney(
      g,
      a.direction === "grant" ? "central" : a.province,
      a.direction === "grant" ? a.province : "central",
      a.amount,
      a.direction === "grant" ? "中央专项拨款" : "地方特别上缴",
      source,
    );
    if (a.direction === "levy" && f.taxSystem === "central")
      g.machine.trust[a.province] = Math.max(
        0,
        g.machine.trust[a.province] - 1,
      );
    g.machine.occupied[officePerson(g, "plan")!] = source;
  } else f.autonomous[a.province] = a.enabled;
}
export function validateFiscal(g: V2Game) {
  const f = g.machine.fiscal;
  const provincesValid = (values: ProvinceId[]) =>
    Array.isArray(values) &&
    values.every((pid) => fiscalProvinces.includes(pid)) &&
    new Set(values).size === values.length;
  if (
    !f ||
    !Object.hasOwn(taxSystems, f.taxSystem) ||
    !f.locals ||
    !f.autonomous ||
    !f.localFacilities ||
    !f.localDefaults ||
    !fiscalProvinces.every(
      (pid) =>
        Number.isSafeInteger(f.locals[pid]) &&
        f.locals[pid] >= 0 &&
        typeof f.autonomous[pid] === "boolean" &&
        typeof f.localFacilities[pid] === "boolean" &&
        Number.isSafeInteger(f.localDefaults[pid]) &&
        f.localDefaults[pid] >= 0,
    ) ||
    !Number.isSafeInteger(f.cultTreasury) ||
    f.cultTreasury < 0 ||
    !Number.isSafeInteger(f.settlements) ||
    f.settlements < 0 ||
    !Number.isSafeInteger(f.stableTurns) ||
    f.stableTurns < 0 ||
    f.stableTurns > f.settlements ||
    !provincesValid(f.agreements) ||
    !provincesValid(f.claims) ||
    !Array.isArray(f.ledger) ||
    f.ledger.some(
      (e) =>
        !e ||
        typeof e.id !== "string" ||
        !e.id ||
        !Number.isSafeInteger(e.turn) ||
        e.turn < 1 ||
        e.turn > g.core.turn ||
        !Number.isSafeInteger(e.amount) ||
        e.amount < 1 ||
        !["central", "cult", ...fiscalProvinces, "economy"].includes(e.from) ||
        !["central", "cult", ...fiscalProvinces, "public"].includes(e.to) ||
        e.from === e.to ||
        typeof e.reason !== "string" ||
        typeof e.source !== "string" ||
        ![
          "tax",
          "operation",
          "investment",
          "transfer",
          "maintenance",
          "audit",
        ].includes(e.category),
    ) ||
    new Set(f.ledger.map((e) => e.id)).size !== f.ledger.length
  )
    throw new Error("中央—地方财政账本无效");
  for (const w of g.machine.works) {
    const contract = w.contract;
    if (
      contract &&
      (!Object.hasOwn(fundingLabels, contract.mode) ||
        !Array.isArray(contract.shares) ||
        !contract.shares.length ||
        contract.shares.some(
          (s) =>
            !s ||
            !["central", "cult", ...fiscalProvinces].includes(s.account) ||
            !Number.isSafeInteger(s.weight) ||
            s.weight < 1 ||
            s.weight > 3,
        ) ||
        new Set(contract.shares.map((s) => s.account)).size !==
          contract.shares.length ||
        !["central", "cult", "joint", ...fiscalProvinces].includes(
          contract.owner,
        ) ||
        typeof contract.source !== "string" ||
        (contract.beneficiary !== undefined &&
          !fiscalProvinces.includes(contract.beneficiary)))
    )
      throw new Error("工程融资合同无效");
    const network = w.network;
    if (
      network &&
      (w.type !== "grid" ||
        typeof network.active !== "boolean" ||
        typeof network.fault !== "boolean" ||
        (network.faultSeen !== undefined &&
          typeof network.faultSeen !== "boolean") ||
        [network.faultAt, network.consentUntil].some(
          (n) => n !== undefined && (!Number.isSafeInteger(n) || n < 1),
        ))
    )
      throw new Error("电网运行状态无效");
    if (w.type === "grid" && w.completed && !w.cancelled && !network)
      throw new Error("已竣工电网缺少运行状态");
  }
}
