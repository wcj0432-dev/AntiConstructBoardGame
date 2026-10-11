import { getOffice, getPerson } from "../data";
import { random } from "../engine";
import type { ProvinceId } from "../types";
import type {
  Action,
  Condition,
  Department,
  Matter,
  V2Game,
  V2Preview,
  Work,
  WorkType,
} from "./model";
export const provinces: ProvinceId[] = ["industry", "south", "north"];
export const workSpecs: Record<
  WorkType,
  {
    name: string;
    cost: number;
    stock: number;
    duration: number;
    income: number;
    output: number;
    maintenance: number;
    skill: number;
    benefit: string;
  }
> = {
  energy: {
    name: "宗门灵脉能源工程",
    cost: 2,
    stock: 1,
    duration: 2,
    income: 1,
    output: 2,
    maintenance: 0,
    skill: 3,
    benefit: "产出+2、税收+1，偶数回合异常压力+1；解锁能源目标",
  },
  warning: {
    name: "异常预警站",
    cost: 1,
    stock: 0,
    duration: 1,
    income: 0,
    output: 0,
    maintenance: 0,
    skill: 0,
    benefit: "本省持续危机升级最多增加1全国危机",
  },
  farm: {
    name: "地方农业合作改良",
    cost: 3,
    stock: 1,
    duration: 2,
    income: 0,
    output: 2,
    maintenance: 0,
    skill: 1,
    benefit: "长期产出+2；地方收益权与群众信任必须维持",
  },
  factory: {
    name: "工业设施改造",
    cost: 4,
    stock: 2,
    duration: 3,
    income: 1,
    output: 2,
    maintenance: 1,
    skill: 3,
    benefit: "产出+2、税收+1、维护1；依赖兼容标准，生产压力每两回合+1",
  },
  port: {
    name: "浮空贸易港",
    cost: 5,
    stock: 1,
    duration: 3,
    income: 2,
    output: 0,
    maintenance: 1,
    skill: 1,
    benefit: "税收+2、维护1；需交通调查、合作及本地收益权，地方信任过低会停运",
  },
  cooperative: {
    name: "地方合作企业",
    cost: 3,
    stock: 1,
    duration: 2,
    income: 1,
    output: 1,
    maintenance: 0,
    skill: 1,
    benefit: "税收+1、产出+1；依赖地方收益权、信任及协商政策",
  },
  rail: {
    name: "跨省符阵铁路",
    cost: 4,
    stock: 2,
    duration: 3,
    income: 0,
    output: 0,
    maintenance: 1,
    skill: 1,
    benefit: "连接两省并解锁真实物资调运；失控异常可能沿铁路传播，维护1",
  },
};
export const departmentLabels = {
  plan: "计划委员会",
  anomaly: "异常事务局",
  defense: "国家安全委员会",
};
export function officerOffice(g: V2Game, id: string) {
  return Object.entries(g.core.appointments).find(([, p]) => p === id)?.[0];
}
export function assignmentFor(g: V2Game, id: string, except?: string) {
  return g.machine.works.find(
    (w) =>
      w.id !== except &&
      w.worker === id &&
      !w.completed &&
      !w.paused &&
      !w.cancelled,
  );
}
export function availableOfficer(g: V2Game, id: string | null | undefined) {
  return (
    !!id &&
    !!officerOffice(g, id) &&
    g.core.grievances[id] < 3 &&
    !g.machine.occupied[id] &&
    assignmentFor(g, id)?.assignment !== "dedicated"
  );
}
export function hasDepartment(g: V2Game, type: Department, pid?: ProvinceId) {
  const regions = g.machine.departments?.[type] || [];
  return regions.length
    ? pid
      ? regions.includes(pid)
      : provinces.every((p) => regions.includes(p))
    : g.machine.department === type;
}
const c = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
export function workReadiness(g: V2Game, w: Work): Condition[] {
  if (w.type === "warning")
    return [
      c(
        "施工调度预算",
        (g.machine.departmentBudgets?.plan ?? 1) > 0,
        "恢复计划部门基本预算才能继续施工",
      ),
    ];
  const worker = w.worker || (w.type === "energy" ? "mo" : ""),
    person = getPerson(worker),
    job = officerOffice(g, worker),
    dedicated = w.assignment === "dedicated";
  return [
    c(
      "项目专业能力",
      !!person &&
        (w.type !== "energy" || worker === "mo") &&
        person.skills.production >= workSpecs[w.type].skill,
      "能源工程须由墨玄主持；其他项目须具备所列生产专业能力",
    ),
    c(
      "职位与任务分配",
      dedicated || (!!job && ["plan", `gov-${w.province}`].includes(job)),
      "顾问须在计划委或项目所在省任职；空闲人物可专职派遣，调离顾问岗位会中断工程",
    ),
    c(
      "兼容的工作占用",
      !!person &&
        g.core.grievances[worker] < 3 &&
        !g.machine.occupied[worker] &&
        !assignmentFor(g, worker, w.id),
      "人物不能拒绝履职、被即时事务抽调或同时承担其他活动项目；暂停/取消其他项目可释放占用",
    ),
    c(
      "计划部门施工预算",
      (g.machine.departmentBudgets?.plan ?? 1) > 0,
      "计划部门预算为0时停止施工与专业调度；恢复基本预算即可继续",
    ),
  ];
}
export function projectConditions(
  g: V2Game,
  a: Extract<Action, { type: "project" }>,
): Condition[] {
  const m = g.machine,
    p = g.core.provinces.find((p) => p.id === a.province),
    spec = workSpecs[a.project];
  if (!p || !spec) return [c("真实项目与地区", false, "选择现有地区和项目")];
  const w: Work = {
    id: "new",
    type: a.project,
    province: a.province,
    progress: 0,
    duration: spec.duration,
    paused: false,
    completed: false,
    source: "",
    worker:
      a.worker ||
      (a.project === "energy"
        ? "mo"
        : g.core.appointments[`gov-${a.province}`] || undefined),
    assignment: a.assignment || "advisor",
    to: a.to,
  };
  const out = [
    c(
      "无重复工程",
      !m.works.some((w) => w.type === a.project && w.province === a.province),
      "同省同类工程不能从建设或事件入口重复开工；已取消工程请在原项目恢复",
    ),
    ...workReadiness(g, w),
  ];
  if (a.project === "energy")
    out.push(
      c(
        "灵脉调查与所在地",
        m.surveyed && a.province === "south",
        "先勘探南岭灵脉，墨玄提供专业能力",
      ),
      c(
        "地方工程审批",
        m.regime !== "vertical" || hasDepartment(g, "anomaly", a.province),
        "垂直体制地方能源工程需全国/本省异常管理改革的工程审批接口",
      ),
    );
  if (a.project === "farm")
    out.push(
      c(
        "农业地区与地方权利",
        a.province !== "industry" &&
          m.rights[a.province] &&
          m.trust[a.province] >= 2,
        "农业改良在南岭/北境实施，先保留本地收益权并获得信任2",
      ),
    );
  if (a.project === "factory")
    out.push(
      c(
        "工业所在地与兼容标准",
        a.province === "industry" && m.standards,
        "工业改造位于工业省，先建立兼容标准",
      ),
      c(
        "生产潜力已普查",
        m.discoveries.industry.includes("resources"),
        "先在工业省资源普查，确认生产改造的实际对象",
      ),
    );
  if (a.project === "port")
    out.push(
      c(
        "交通调查",
        m.discoveries?.[a.province]?.includes("routes") || false,
        "先调查本地运输网络",
      ),
      c(
        "合作贸易权",
        m.cooperation &&
          m.rights[a.province] &&
          m.trust[a.province] >= 2 &&
          g.core.policies.method === 1,
        "须有真实合作、地方收益权、信任2和协商政策",
      ),
    );
  if (a.project === "cooperative")
    out.push(
      c(
        "合作企业组织基础",
        m.rights[a.province] &&
          m.trust[a.province] >= 2 &&
          g.core.policies.method === 1,
        "地方收益权、信任2及协商政策决定合作企业合法性",
      ),
    );
  if (a.project === "rail")
    out.push(
      c(
        "无反向重复线路",
        !m.works.some(
          (w) =>
            w.type === "rail" && w.province === a.to && w.to === a.province,
        ),
        "同一条两省连接不能从反向重复建设",
      ),
      c(
        "两个真实地区",
        !!a.to && provinces.includes(a.to) && a.to !== a.province,
        "选择不同的铁路目的省",
      ),
      c(
        "跨省组织与技术接口",
        m.standards &&
          m.cooperation &&
          m.rights[a.province] &&
          !!a.to &&
          m.rights[a.to],
        "需要兼容标准、合作协议和两端收益权；铁路不会自动创造征调权限",
      ),
    );
  return out;
}
export function workOperating(g: V2Game, w: Work) {
  const m = g.machine;
  if (
    w.cancelled ||
    !w.completed ||
    m.matters.some((x) => x.province === w.province && x.isolated)
  )
    return false;
  if (
    ["farm", "port", "cooperative"].includes(w.type) &&
    (!m.rights[w.province] ||
      m.trust[w.province] < 2 ||
      m.suppressed[w.province])
  )
    return false;
  if (w.type === "cooperative" && g.core.policies.method !== 1) return false;
  if (w.type === "factory" && !m.standards) return false;
  return true;
}
export function incomeSources(g: V2Game) {
  const rows = [
    { label: "中央工业省 · 工业与商业基础税", amount: 2 },
    { label: "南岭修仙省 · 灵脉资源基础税", amount: 2 },
    { label: "北境异常省 · 边境基础税", amount: 1 },
  ];
  for (const w of g.machine.works)
    if (workOperating(g, w) && workSpecs[w.type].income)
      rows.push({
        label: `${g.core.provinces.find((p) => p.id === w.province)!.name} · ${workSpecs[w.type].name}`,
        amount: workSpecs[w.type].income,
      });
  for (const pid of provinces)
    if ((g.machine.audits?.[pid]?.bonusUntil ?? -1) >= g.core.turn)
      rows.push({
        label: `${g.core.provinces.find((p) => p.id === pid)!.name} · 稽核后税制整顿（至第${g.machine.audits[pid]!.bonusUntil}回合）`,
        amount: 1,
      });
  return rows;
}
export type AdministrativeAction = Extract<
  Action,
  {
    type:
      "audit" | "budget" | "survey" | "coordinate" | "transfer" | "workControl";
  }
>;
export function isAdministrative(a: Action): a is AdministrativeAction {
  return [
    "audit",
    "budget",
    "survey",
    "coordinate",
    "transfer",
    "workControl",
  ].includes(a.type);
}
export function administrativePreview(
  g: V2Game,
  a: AdministrativeAction,
): Pick<
  V2Preview,
  "title" | "costs" | "conditions" | "effects" | "actors" | "institutions"
> {
  const m = g.machine,
    s = g.core,
    out = {
      title: "主动治理",
      costs: {
        commands: 1,
        treasury: 0,
        capital: 0,
        stock: 0,
        province: undefined as ProvinceId | undefined,
      },
      conditions: [] as Condition[],
      effects: [] as string[],
      actors: [] as string[],
      institutions: [] as string[],
    };
  const officer = (office: string) => {
    const id = s.appointments[office];
    out.institutions.push(office);
    if (id) out.actors.push(id);
    out.conditions.push(
      c(
        "实际主管与工作状态",
        availableOfficer(g, id),
        `${getOffice(office)?.name || office}须有人履职，且未被占用、专职派遣或拒绝协办`,
      ),
    );
    return id;
  };
  if (a.type === "audit") {
    out.title = "财政稽核与税制整顿";
    const id = officer(a.lead),
      p = s.provinces.find((p) => p.id === a.province)!,
      old = m.audits[a.province];
    out.conditions.push(
      c(
        "稽核预算",
        a.lead !== "plan" || m.departmentBudgets.plan > 0,
        "计划委稽核需要基本预算，地方税务工作由本省负责",
      ),
      c(
        "本地财政资格",
        ["plan", `gov-${a.province}`].includes(a.lead) &&
          !!id &&
          (getPerson(id)!.skills.production >= 2 ||
            getPerson(id)!.skills.social >= 2),
        "由本省政府或计划委组织，需生产/社会能力至少2",
      ),
      c(
        "有限稽核窗口",
        !old || (old.rounds < 2 && s.turn - old.last >= 3),
        "同省最多两轮稽核，间隔至少3回合；第二轮只回收1财政，不重复长期税收",
      ),
    );
    const gain = old
      ? 1
      : Math.min(
          4,
          1 +
            Math.floor(p.districts.reduce((n, d) => n + d.output, 0) / 2) +
            (id && getPerson(id)!.skills.production >= 2 ? 1 : 0) +
            (s.policies.economy === 0 ? 1 : 0),
        );
    out.effects = [
      `实际回收漏税${gain}财政；首轮另在本回合及下回合结算各增加1税收`,
      `主管本回合被稽核占用；地方信任-1、负责人积怨+1，信任降至0会揭示财政利益争议`,
    ];
  } else if (a.type === "budget") {
    out.title = `调整${departmentLabels[a.department]}预算`;
    const old = m.departmentBudgets[a.department];
    out.costs.treasury = a.level > old ? 2 : 0;
    out.costs.capital = a.level < old ? 1 : 0;
    out.conditions.push(
      c(
        "实际预算变更",
        a.level !== old && [0, 1, 2].includes(a.level),
        "预算分为紧缩0、基本1、专项2，不能重复执行同一档位",
      ),
    );
    out.effects = [
      `预算${old} → ${a.level}，立即影响之后的财政承诺与能力；削减不会返还历史支出`,
      a.department === "plan"
        ? "紧缩停止施工、计划委稽核与调运；专项每期维护+1，可执行工程进度+1"
        : a.department === "anomaly"
          ? "紧缩暂停高级封印和档案调查；专项维护+1，非预警站地区异常升级危机伤害减少1（最低1）"
          : "紧缩暂停军事隔离与联合演习；专项维护+1，联合演习保护可延长一回合",
      "削减会增加该部门负责人积怨1；政治代价不能用额外财政抵消",
    ];
  } else if (a.type === "survey") {
    out.title = {
      resources: "地区资源普查",
      routes: "地方运输网络调查",
      anomaly: "异常地质勘探",
    }[a.field];
    officer(a.field === "anomaly" ? "anomaly" : `gov-${a.province}`);
    out.conditions.push(
      c(
        "首次专项调查",
        !m.discoveries[a.province].includes(a.field),
        "同省同类调查只进行一次，结果及风险保存在存档中",
      ),
    );
    out.effects = [
      `揭示本地${a.field === "routes" ? "运输网络并解锁贸易投资" : a.field === "resources" ? "生产潜力与资源记录" : "异常档案与本省风险测绘（未来升级伤害-1，最低1）"}；不直接兑换财政`,
      `调查者本回合占用；按保存的随机序列，可能揭开利益诉求/异常公报并增加异常压力，预览不会消耗随机数`,
    ];
  } else if (a.type === "coordinate") {
    out.title = {
      agreement: "中央—地方合作磋商",
      exercise: "跨部门应急演习",
      prepare: "国家体制改革协商准备",
    }[a.kind];
    officer("plan");
    officer(`gov-${a.province}`);
    out.costs.treasury = 1;
    out.costs.capital = 1;
    out.conditions.push(
      c(
        "协调冷却",
        (m.coordination[a.province] ?? -9) + 2 <= s.turn,
        "同省每两回合最多协调一次",
      ),
    );
    if (a.kind === "agreement")
      out.conditions.push(
        c(
          "协商与地方信任",
          s.policies.method === 1 &&
            m.trust[a.province] >= 2 &&
            !m.suppressed[a.province],
          "须采用协商路线、信任2且地方组织未被压制",
        ),
      );
    if (a.kind === "exercise")
      out.conditions.push(
        c(
          "安全部门能力",
          m.departmentBudgets.defense > 0 &&
            availableOfficer(g, s.appointments.defense),
          "安全部门须保留基本预算及在任负责人",
        ),
      );
    if (a.kind === "prepare")
      out.conditions.push(
        c(
          "具体改革方向",
          !!a.regime && a.regime !== m.regime && s.policies.method === 1,
          "先选不同于现行体制的改革方向并采用协商政策",
        ),
      );
    out.effects = [
      a.kind === "agreement"
        ? "签订本省收益权和中央—地方合作接口，形成未来运输/投资所需实际组织条件"
        : a.kind === "exercise"
          ? `应急演习在至第${s.turn + (m.departmentBudgets.defense === 2 ? 2 : 1)}回合结算降低持续危机升级伤害1（最低1）`
          : "三回合内相应体制改革政治成本-1，参与协商者积怨-1；仍需国家改革本身与过渡期",
      "参与主管本回合占用；磋商并不消除危机、不会凭空建立专业能力",
    ];
  } else if (a.type === "transfer") {
    out.title = "沿铁路跨省调运";
    officer("plan");
    out.costs.stock = a.amount + 1;
    out.costs.province = a.from;
    out.conditions.push(
      c(
        "真实数量",
        Number.isInteger(a.amount) && a.amount >= 1 && a.amount <= 3,
        "每次调运1～3物资，另消耗源省1物资作为运输损耗",
      ),
      c(
        "已完工且畅通的铁路",
        m.works.some(
          (w) =>
            w.type === "rail" &&
            w.completed &&
            !w.cancelled &&
            ((w.province === a.from && w.to === a.to) ||
              (w.province === a.to && w.to === a.from)),
        ) &&
          !m.matters.some(
            (x) =>
              [a.from, a.to].includes(x.province) &&
              (x.isolated || x.stage >= 3),
          ),
        "两省须有竣工铁路且没有隔离或阶段3以上危机阻断",
      ),
      c(
        "收益权与调配组织",
        a.from !== a.to &&
          m.cooperation &&
          m.rights[a.from] &&
          m.rights[a.to] &&
          m.departmentBudgets.plan > 0,
        "保留两端收益权、实际合作协议及计划委基本预算",
      ),
    );
    out.effects = [
      `源省支付${a.amount + 1}物资，目的省获得${a.amount}；全国总物资减少1，不可循环刷取`,
      `铁路维护每期1，异常失控也可能沿连接传播`,
    ];
  } else {
    const w = m.works.find((w) => w.id === a.work);
    out.title = a.operation === "cancel" ? "撤销工程与派遣" : "恢复已取消工程";
    out.costs.treasury = a.operation === "restart" ? 1 : 0;
    out.conditions.push(
      c(
        "可调整的实际工程",
        !!w &&
          !w.completed &&
          (a.operation === "restart" ? !!w.cancelled : !w.cancelled),
        "竣工工程不能撤销；恢复只针对已取消工程",
      ),
    );
    if (w && a.operation === "restart")
      out.conditions.push(
        ...projectConditions(
          {
            ...g,
            machine: { ...m, works: m.works.filter((x) => x.id !== w.id) },
          },
          {
            type: "project",
            project: w.type,
            province: w.province,
            worker: w.worker,
            assignment: w.assignment,
            to: w.to,
          },
        ),
      );
    out.effects = [
      a.operation === "cancel"
        ? "施工进度清零，立即停止承诺并释放人员；已付开工费和物资不退还"
        : "支付1财政组织重新开工；原专业人员、审批与技术仍须满足，不重复收取原始投资费",
    ];
  }
  return out;
}
export function applyAdministrative(
  g: V2Game,
  a: AdministrativeAction,
  source: string,
):
  { kind: Matter["kind"]; province: ProvinceId; variant?: string } | undefined {
  const m = g.machine,
    s = g.core;
  const occupy = (office: string) => {
    const id = s.appointments[office];
    if (id) m.occupied[id] = source;
  };
  if (a.type === "audit") {
    const old = m.audits[a.province],
      p = s.provinces.find((p) => p.id === a.province)!,
      id = s.appointments[a.lead]!;
    s.treasury += old
      ? 1
      : Math.min(
          4,
          1 +
            Math.floor(p.districts.reduce((n, d) => n + d.output, 0) / 2) +
            (getPerson(id)!.skills.production >= 2 ? 1 : 0) +
            (s.policies.economy === 0 ? 1 : 0),
        );
    m.audits[a.province] = {
      last: s.turn,
      rounds: (old?.rounds || 0) + 1,
      bonusUntil: old ? old.bonusUntil : s.turn + 1,
    };
    occupy(a.lead);
    m.trust[a.province] = Math.max(0, m.trust[a.province] - 1);
    const governor = s.appointments[`gov-${a.province}`];
    if (governor) s.grievances[governor]++;
    if (
      m.trust[a.province] === 0 &&
      ![...m.matters, ...m.backlog].some(
        (x) => x.kind === "distrust" && x.province === a.province,
      )
    )
      return { kind: "distrust", province: a.province, variant: "fiscal" };
  } else if (a.type === "budget") {
    const old = m.departmentBudgets[a.department];
    m.departmentBudgets[a.department] = a.level;
    const actor = s.appointments[a.department];
    if (a.level < old && actor) s.grievances[actor]++;
  } else if (a.type === "survey") {
    m.discoveries[a.province].push(a.field);
    occupy(a.field === "anomaly" ? "anomaly" : `gov-${a.province}`);
    if (a.field === "anomaly") {
      m.knowledge = true;
      m.origins.knowledge = source;
    }
    if (a.field === "resources" && a.province === "south") {
      m.surveyed = true;
      m.origins.surveyed = source;
    }
    const die = random(s);
    if (die < 0.45) {
      s.provinces.find((p) => p.id === a.province)!.pressure.anomaly++;
      return {
        kind: "gazette",
        province: a.province,
        variant: a.field === "routes" ? "meeting" : "dream",
      };
    }
    m.discoveries[a.province].push(
      a.field === "resources" ? "production-potential" : "stable-findings",
    );
  } else if (a.type === "coordinate") {
    m.coordination[a.province] = s.turn;
    const actors = [
      s.appointments.plan,
      s.appointments[`gov-${a.province}`],
    ].filter((x): x is string => !!x);
    if (a.kind === "agreement") {
      m.rights[a.province] = true;
      m.cooperation = true;
      m.origins.cooperation = source;
    }
    if (a.kind === "exercise")
      m.drillsUntil = s.turn + (m.departmentBudgets.defense === 2 ? 2 : 1);
    if (a.kind === "prepare") {
      m.prepared = { regime: a.regime!, until: s.turn + 2, supporters: actors };
      for (const id of actors)
        s.grievances[id] = Math.max(0, s.grievances[id] - 1);
    }
    occupy("plan");
    occupy(`gov-${a.province}`);
  } else if (a.type === "transfer")
    s.provinces.find((p) => p.id === a.to)!.stock += a.amount;
  else {
    const w = m.works.find((w) => w.id === a.work)!;
    w.cancelled = a.operation === "cancel";
    w.paused = w.cancelled;
    if (w.cancelled) w.progress = 0;
  }
  return;
}
