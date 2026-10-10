import {
  appoint as baseAppoint,
  deserialize as baseDeserialize,
  mediate as baseMediate,
  newGame as baseNew,
  policy as basePolicy,
  random,
} from "../engine";
import { getOffice, getPerson, issueNames, offices, people } from "../data";
import { fiscalForecast } from "../finance";
import type { ProvinceId } from "../types";
import { gazettes, goals, plansFor, regimes } from "./data";
import type {
  Action,
  ActionResult,
  Difficulty,
  Capability,
  Condition,
  Goal,
  History,
  Matter,
  Mode,
  Plan,
  V2Game,
  V2Preview,
} from "./model";
export const SAVE_V2 = "federation-worlds-v2";
const pids: ProvinceId[] = ["industry", "south", "north"];
const province = (g: V2Game, id: ProvinceId) =>
  g.core.provinces.find((p) => p.id === id)!;
const personOffice = (g: V2Game, id: string) =>
  Object.entries(g.core.appointments).find(([, p]) => p === id)?.[0];
const active = (g: V2Game, id: string) =>
  !!personOffice(g, id) && g.core.grievances[id] < 3 && !g.machine.occupied[id];
function condition(
  label: string,
  met: boolean,
  reason: string,
  source?: string,
): Condition {
  return { label, met, reason, source };
}
function record(
  g: V2Game,
  title: string,
  actors: string[],
  institutions: string[],
  conditions: string[],
  effects: string[],
  parents: string[] = [],
) {
  const h: History = {
    id: `decision-${g.core.nextId++}`,
    turn: g.core.turn,
    title,
    actors,
    institutions,
    conditions,
    effects,
    parents: [
      ...new Set(
        parents.filter((id) => g.machine.history.some((h) => h.id === id)),
      ),
    ],
  };
  g.machine.history.unshift(h);
  g.core.logs.unshift({
    turn: g.core.turn,
    text: `${title}：${effects.join("；")}`,
    kind: "info",
  });
  return h.id;
}
function sync(g: V2Game) {
  for (const id of Object.keys(
    g.core.factions,
  ) as (keyof typeof g.core.factions)[]) {
    g.core.factions[id].influence =
      Object.values(g.core.appointments).filter(
        (p) => getPerson(p)?.faction === id,
      ).length *
        2 +
      g.core.factionSupport[id];
    g.core.factions[id].discontent = people
      .filter((p) => p.faction === id)
      .reduce((a, p) => a + g.core.grievances[p.id], 0);
  }
}
function addMatter(g: V2Game, m: Omit<Matter, "id" | "age">) {
  const item = { ...m, id: `matter-${g.core.nextId++}`, age: 0, lifecycle: "revealed" as const, steps: [] };
  if (g.machine.admitted < 3) {
    g.machine.matters.push(item);
    g.machine.admitted++;
  } else g.machine.backlog.push(item);
  record(
    g,
    `新局势：${m.title}`,
    [],
    [],
    [],
    [m.description],
    m.source ? [m.source] : [],
  );
}
function createMatter(
  g: V2Game,
  kind: Matter["kind"],
  pid: ProvinceId,
  source?: string,
  variant?: string,
) {
  const titles = {
    warning: "南岭灵脉电站故障预警",
    accident: "灵脉事故：谁来指挥救援？",
    supply: "能源缺口与跨省配给争议",
    distrust: "地方公开要求秘密处置说明",
    oldgod: "北境旧神苏醒",
    gazette: "联邦公报",
    opportunity: "未经勘探的第七灵脉",
    final: goals[g.machine.goal].finale,
  };
  const desc = {
    warning:
      "先行动还是先建制度？本回合可检修、任命和提前改革；事故将在下一回合出现。",
    accident:
      "异常局持有收容技术，省政府持有地方组织。公开救援与秘密封印各自需要真实的参与资格。",
    supply:
      "公开救援保住人口，但电网仍然中断。南岭要求保留资源收益权；也可从中央工业省提供替代物资。",
    distrust:
      "秘密收容消除了异常源，但地方不知道损失由谁承担。中央必须回应自治与公开的具体诉求。",
    oldgod:
      "持续危机：异常活动 → 生产交通中断 → 人口疏散 → 全国紧急状态。遏制、撤离与隔离可以管理它，而不必每次彻底消灭。",
    gazette: "奇幻组织提出了一项具体的制度要求。",
    opportunity: "勘探增加异常风险，也让宗门工程变得可行。",
    final: "终局行动将在此检验过去建设的组织、工程、当前负责人和实际合作资格。",
  };
  const z = gazettes.find((z) => z.id === variant);
  addMatter(g, {
    kind,
    province: pid,
    title: z?.title || titles[kind],
    description: z?.text || desc[kind],
    stage:
      kind === "accident" && g.machine.milestones.includes("prevention")
        ? 1
        : kind === "accident"
          ? 2
          : 1,
    containment: 0,
    evacuated: false,
    isolated: false,
    source,
    variant,
  });
}
export function newV2(
  mode: Mode = "campaign",
  goal: Goal = "night",
  seed = "南岭—北境-020",
): V2Game {
  const core = baseNew(seed);
  core.tasks = [];
  core.backlog = [];
  core.logs = [];
  core.appointments["gov-south"] = mode === "tutorial" ? "bai" : "xing";
  core.grievances = Object.fromEntries(people.map((p) => [p.id, 0]));
  const g: V2Game = {
    schema: 2,
    core,
    machine: {
      mode,
      goal,
      regime: "devolved",
      department: "none",
      overrides: {},
      authorization: {},
      matters: [],
      backlog: [],
      admitted: 0,
      history: [],
      origins: {},
      budgets: [],
      rights: { industry: false, south: false, north: false },
      trust: { industry: 2, south: 2, north: 2 },
      fatigue: { industry: 0, south: 0, north: 0 },
      suppressed: { industry: false, south: false, north: false },
      occupied: {},
      knowledge: true,
      surveyed: false,
      standards: false,
      cooperation: false,
      reserve: false,
      permit: false,
      works: [],
      finalDone: false,
      tutorial: 0,
      milestones: [],
      goalPending: false, revision: 0, archive: [], results: [], difficulty: "standard", rulesVersion: "0.3.0",
    },
  };
  sync(g);
  record(
    g,
    "新任期开始",
    [],
    [],
    ["地方分权，保留中央密封档案情报"],
    [
      "每回合5命令；先付固定支出4，再获得收入5",
      "教学/短战役4回合，国家目标模式8回合",
    ],
  );
  createMatter(g, "warning", "south");
  if (mode === "national")
    createMatter(g, "gazette", "industry", undefined, "flying");
  return g;
}
export function duration(g: V2Game) {
  return g.machine.mode === "experimental" ? 12 : g.machine.mode === "national" ? 8 : 4;
}
export function participants(g: V2Game, m: Matter) {
  const a = g.machine.authorization[m.id];
  const central =
    m.kind === "gazette" || m.kind === "supply" || m.kind === "opportunity"
      ? "plan"
      : "anomaly";
  const gov = `gov-${m.province}`;
  const override = ["warning", "accident", "oldgod"].includes(m.kind)
    ? g.machine.overrides[m.province]
    : undefined;
  const dept =
    g.machine.department === "anomaly" &&
    ["accident", "oldgod"].includes(m.kind)
      ? "anomaly"
      : g.machine.department === "evacuation" && m.kind === "supply"
        ? gov
        : undefined;
  const lead =
    a?.lead ||
    override ||
    dept ||
    (g.machine.regime === "vertical" ? central : gov);
  let ids =
    a?.joint || g.machine.regime === "joint" ? [lead, central, gov] : [lead];
  if (g.machine.regime === "vertical") ids = [lead, central, gov];
  return {
    lead,
    offices: [...new Set(ids)],
    actors: [...new Set(ids)]
      .map((o) => g.core.appointments[o])
      .filter((id): id is string => !!id),
  };
}
export function capability(
  g: V2Game,
  cap: Capability,
  m: Matter,
  disclosure?: number,
): Condition[] {
  const p = participants(g, m),
    can = (id: string) => active(g, id) && p.actors.includes(id),
    a = g.machine.authorization[m.id],
    blockedCentral =
      g.machine.regime === "vertical" && g.core.paralysis >= 2 && !a?.emergency;
  const role = (id: string, valid: string[]) =>
    can(id) && valid.includes(personOffice(g, id)!);
  const legal = !blockedCentral;
  const source = g.machine.origins.regime;
  if (cap === "mobilize")
    return [
      condition(
        "正式群众动员资格",
        role(
          "xing",
          p.offices.filter((o) => getOffice(o).domains.includes("social")),
        ),
        "星野澪必须在本事务正式参与的社会事务职位上，且未被占用或拒绝协办",
      ),
      condition(
        "公开、可信任的当地组织",
        disclosure === 1 &&
          g.core.policies.disclosure !== 0 &&
          !g.machine.suppressed[m.province] &&
          g.machine.trust[m.province] > 0,
        "保密封锁或当地组织被压制时，群众的信任无法发动",
        g.machine.origins[`suppressed:${m.province}`] ||
          g.machine.origins.policy,
      ),
      condition(
        "中央批准程序",
        legal,
        "垂直体制在中央阻塞≥2时不能批准地方救援，除非事前取得紧急授权",
        source,
      ),
    ];
  if (cap === "seal")
    return [
      condition(
        "密封档案与异常收容资格",
        role(
          "sergei",
          p.offices.filter((o) => getOffice(o).domains.includes("anomaly")),
        ) && g.machine.knowledge,
        "谢尔盖须在本事务的合法异常职位上，且国家持有档案情报",
      ),
      condition(
        "保密方案与政策",
        disclosure === 0 && g.core.policies.disclosure !== 1,
        "公开政策会禁止高级秘密封印，不可用命令购买能力",
        g.machine.origins.policy,
      ),
      condition(
        "中央审批未阻塞",
        legal,
        "中央垂直体制审批遇到阻塞；可在此前安排地方紧急权限",
        source,
      ),
    ];
  if (cap === "leywork")
    return [
      condition(
        "宗门工程师与灵脉使用权",
        active(g, "mo") &&
          ["plan", "gov-south"].includes(personOffice(g, "mo")!) &&
          g.machine.surveyed &&
          m.province === "south",
        "墨玄必须任计划委或南岭省负责人，灵脉已勘探且位于南岭",
        g.machine.origins.surveyed,
      ),
      condition(
        "地方工程审批",
        g.machine.regime !== "vertical" ||
          !!a ||
          g.machine.department === "anomaly",
        "垂直体制建设地方工程需具体授权或全国异常管理改革",
        source,
      ),
    ];
  if (cap === "industry")
    return [
      condition(
        "工业标准化",
        active(g, "lin") &&
          personOffice(g, "lin") === "plan" &&
          g.machine.standards,
        "林铸必须任计划委负责人，且已建立兼容标准",
        g.machine.origins.standards,
      ),
    ];
  if (cap === "transport")
    return [
      condition(
        "兼容运输与调配权限",
        g.machine.standards &&
          (g.machine.department === "transport" ||
            g.machine.regime === "vertical" ||
            (g.machine.cooperation &&
              pids.every((id) => g.machine.rights[id]))),
        "需要标准兼容和中央运输制度，或保留资源收益权的跨省合作协议",
        g.machine.origins.cooperation || g.machine.origins.department,
      ),
      condition(
        "工业供应或江湖承诺网络",
        (active(g, "lin") && personOffice(g, "lin") === "plan") ||
          (active(g, "ye") &&
            personOffice(g, "ye")!.startsWith("gov-") &&
            g.machine.cooperation &&
            g.core.policies.method === 1 &&
            pids.filter((id) => g.machine.rights[id]).length >= 2),
        "需要实际在任的计划负责人或省政府江湖联络人",
      ),
    ];
  if (cap === "rapid")
    return [
      condition(
        "省级快速应急权限",
        !!g.core.appointments[`gov-${m.province}`] &&
          g.core.grievances[g.core.appointments[`gov-${m.province}`]!] < 3 &&
          (g.machine.regime !== "vertical" ||
            a?.lead === `gov-${m.province}` ||
            g.machine.department === "evacuation"),
        "垂直体制地方应急需要具体授权或全国疏散权下放；地方岗位不能空缺或拒绝履职",
        source,
      ),
    ];
  return [
    condition(
      "联合体制",
      g.machine.regime === "joint",
      "专属联合行动只能由中央—地方委员会解锁",
      source,
    ),
    condition(
      "群众与收容专家正式参与",
      can("xing") && can("sergei"),
      "两名专家须同时处于本事务的合法职位",
    ),
    condition(
      "有限技术公开与协商协议",
      g.machine.permit &&
        g.core.policies.method === 1 &&
        g.core.policies.disclosure !== 0,
      "先公开有限技术资料，并采纳协商政策；不能通过强制或付费自动获得共识",
      g.machine.origins.permit || g.machine.origins.policy,
    ),
  ];
}
export function finance(g: V2Game) {
  const work = g.machine.works.filter(
    (w) =>
      !w.paused &&
      !w.completed &&
      (!w.worker ||
        (active(g, w.worker) &&
          ["plan", "gov-south"].includes(personOffice(g, w.worker)!))),
  ).length;
  const maintenance =
    (g.machine.regime === "joint" ? 1 : 0) +
    (g.machine.standards ? 1 : 0) +
    g.machine.budgets.length;
  return fiscalForecast(
    g.core,
    maintenance,
    work,
    5 +
      g.machine.works.filter((w) => w.completed && w.type === "energy").length,
  );
}
export function milestones(g: V2Game, goal: Goal = g.machine.goal) {
  const m = g.machine;
  const dummy: Matter = {
    id: "goal-check",
    title: "终局",
    description: "",
    province: "south",
    kind: "final",
    stage: 1,
    containment: 0,
    evacuated: false,
    isolated: false,
    age: 0,
  };
  if (goal === "spark")
    return [
      condition(
        "工业与宗门建设能力",
        active(g, "lin") &&
          personOffice(g, "lin") === "plan" &&
          active(g, "mo") &&
          ["plan", "gov-south"].includes(personOffice(g, "mo")!),
        "需要林铸保有计划职务，墨玄保有灵脉工程职位",
      ),
      condition(
        "跨省标准和运输权限",
        capability(g, "transport", dummy).every((c) => c.met),
        "建立兼容标准并形成可用跨省运输体系",
      ),
      condition(
        "南岭能源工程竣工",
        m.works.some((w) => w.type === "energy" && w.completed),
        "完成两回合宗门灵脉工程",
      ),
      condition(
        "宗门资源收益协约",
        m.rights.south && m.trust.south > 0,
        "保留地方收益权，避免以强制建设摧毁合作",
      ),
    ];
  if (goal === "accord")
    return [
      condition(
        "跨文明行政制度",
        m.regime === "joint" || m.department === "evacuation",
        "完成联合体制或全国疏散权下放",
      ),
      condition(
        "稳定跨组织渠道",
        m.cooperation &&
          !!g.core.appointments.anomaly &&
          pids.every((id) => !!g.core.appointments[`gov-${id}`]),
        "建立合作渠道且中央/三个地方负责人均在任",
      ),
      condition(
        "重大事权争议得到处理",
        m.milestones.includes("accident-managed") &&
          m.history.some((h) => /授权|改革/.test(h.title)),
        "管理南岭事故，并至少完成一次实际授权或改革",
      ),
      condition(
        "代表仍能实际合作",
        Object.values(g.core.appointments)
          .filter(Boolean)
          .every((id) => g.core.grievances[id!] < 3) &&
          pids.every((id) => m.trust[id] > 0),
        "当前负责人不能拒绝协办，地方信任不能归零",
      ),
    ];
  return [
    condition(
      "全国预警设施",
      pids.every((pid) =>
        m.works.some(
          (w) => w.province === pid && w.type === "warning" && w.completed,
        ),
      ),
      "完成三个省份的预警站，每站需要一回合建设",
    ),
    condition(
      "高级处置仍可启用",
      capability(
        g,
        "seal",
        { ...dummy, province: "north", kind: "oldgod" },
        0,
      ).every((c) => c.met) ||
        capability(
          g,
          "joint",
          { ...dummy, province: "north", kind: "oldgod" },
          1,
        ).every((c) => c.met),
      "合法秘密封印或委员会联合处置能力仍然存在",
    ),
    condition(
      "跨省联合应急关系",
      m.regime === "vertical" ||
        m.regime === "joint" ||
        (m.cooperation && m.rights.south && m.rights.north),
      "具有全国指挥体系或明确跨省地方协议",
    ),
    condition(
      "北境危机已妥善管理",
      m.milestones.includes("north-managed"),
      "封印、隔离或撤离并持续遏制北境旧神危机",
    ),
  ];
}
export function previewAction(g: V2Game, action: Action): V2Preview {
  const s = g.core,
    m = g.machine;
  const v: V2Preview = {
    action,
    title: "行动",
    conditions: [],
    errors: [],
    costs: { commands: 0, treasury: 0, capital: 0, stock: 0 },
    actors: [],
    institutions: [],
    effects: [],
    after: { commands: s.commands, treasury: s.treasury, capital: s.capital },
    opponents: [],
    parents: [],
  };
  const need = (label: string, met: boolean, reason: string, source?: string) =>
    v.conditions.push(condition(label, met, reason, source));
  if (s.status !== "playing") v.errors.push("本局已经结束");
  if (action.type === "selectGoal") {
    v.title = `国家发展规划会议：立项${goals[action.goal].name}`;
    v.costs.commands = 1; v.costs.capital = 1;
    need("战略尚未立项", m.goalPending, "主要战略已经确立，本版不允许无代价改换路线");
    need("规划会议开放", s.turn >= 2 && s.turn <= 3, "第2回合开放，最迟第3回合结束前立项；第1回合先认识国情");
    v.effects = [goals[action.goal].description, "保留此前所有工程、人员、制度与普通建设入口；终局重新检验组织能力"];
  } else if (action.type === "resolve") {
    const matter = m.matters.find((x) => x.id === action.matter);
    if (!matter) {
      v.errors.push("事务不在立即处理区");
      return v;
    }
    const p = plansFor(matter, m.goal).find((p) => p.id === action.option);
    if (!p) {
      v.errors.push("无效事务方案");
      return v;
    }
    v.title = p.title;
    need("本回合尚未执行同一方案", matter.lastOptionTurn !== s.turn || matter.lastOption !== p.id, "这项方案本回合已结算；请查看实际结果，等待下一回合或选择不同处理路径");
    if (p.effect === "evacuate") need("仍有人口需要撤离", !matter.evacuated, "居民已经撤离；可继续遏制异常源或组织最终封印");
    if (p.effect === "contain") need("遏制尚未生效", matter.containment === 0, "遏制已生效，不必重复支付；到期后可重新组织");
    if (p.effect === "isolate") need("尚未完成隔离", !matter.isolated, "地区已经隔离；异常源仍保留，继续监测或封印");
    const part = participants(g, matter);
    if (p.effect === "isolate") {
      part.offices = [...new Set([...part.offices, "defense"])];
      const commander = s.appointments.defense;
      if (commander) part.actors = [...new Set([...part.actors, commander])];
    }
    v.actors = part.actors;
    v.institutions = part.offices;
    v.parents = [
      matter.source || "",
      m.origins.regime || "",
      m.origins.department || "",
      ["warning", "accident", "oldgod"].includes(matter.kind)
        ? m.origins[`local:${matter.province}`] || ""
        : "",
      m.origins.policy || "",
      m.authorization[matter.id]?.source || "",
      ...part.actors.map((id) => m.origins[`person:${id}`] || ""),
    ];
    v.costs = {
      commands: p.command,
      treasury: p.treasury,
      capital: 0,
      stock: p.stock,
      province: matter.province,
    };
    need(
      "主持职位有人履职",
      !!s.appointments[part.lead] &&
        s.grievances[s.appointments[part.lead]!] < 3,
      `${getOffice(part.lead).name}需要能履职的负责人`,
    );
    if (m.mode === "tutorial" && m.tutorial === 1 && matter.kind === "accident")
      need(
        "教学：先明确指挥关系",
        !!m.origins.tutorialAuthorization,
        "本次教学事务需要先通过具体临时授权明确中央和地方的参与资格",
      );
    if (action.force)
      need(
        "已正式授予紧急强制权",
        m.authorization[matter.id]?.emergency === true,
        "强制执行必须在阶段≥2的事务取得实际紧急授权",
      );
    if (p.cap) v.conditions.push(...capability(g, p.cap, matter, p.disclosure));
    if (p.scope === "national" && matter.kind !== "final")
      need(
        "跨省正式指挥关系",
        m.regime === "vertical" ||
          m.regime === "joint" ||
          (!!m.authorization[matter.id]?.joint && m.cooperation),
        "地方分权不能直接调用中央专家开展全国行动；需跨省协议及本事务联合授权",
        m.origins.regime,
      );
    if (p.effect === "isolate")
      need(
        "军队与封锁权限",
        active(g, "lu") &&
          personOffice(g, "lu") === "defense" &&
          (m.regime === "vertical" ||
            m.authorization[matter.id]?.emergency === true),
        "陆霆须任国安委，垂直指挥或阶段≥2时取得紧急授权",
      );
    if (p.effect === "suppress")
      need(
        "正式紧急授权",
        m.authorization[matter.id]?.emergency === true,
        "压制/强制封锁只能在已有紧急授权下执行，不能仅支付费用",
      );
    if (p.effect === "activate") {
      v.conditions.push(...milestones(g));
      need(
        "终局回合",
        s.turn === duration(g),
        "终局前建设条件会一直展示，不允许提前完成终局挑战",
      );
    }
    if (p.disclosure !== undefined && p.effect !== "activate") {
      const against = part.actors.filter(
        (id) =>
          getPerson(id)!.stance.disclosure !== p.disclosure &&
          !(p.id === "joint" && id === "sergei" && m.permit),
      );
      v.opponents = against;
      if (against.length) {
        const leadOpponent = against.includes(s.appointments[part.lead]!);
        const approval = m.regime === "joint" || leadOpponent;
        need(
          "相关负责人路线批准",
          !approval ||
            (!!action.force && m.authorization[matter.id]?.emergency === true),
          `${against.map((id) => getPerson(id)!.name).join("、")}拒绝${issueNames.disclosure[p.disclosure]}${approval ? "主持/委员会批准" : "协办"}；更换负责人、调整方案或取得紧急强制权限`,
          m.origins.policy,
        );
        if (!approval)
          v.effects.push("未批准的协办者不发动个人能力，主持仍可决定普通方案");
        if (action.force)
          v.effects.push(
            `紧急强制：${against.map((id) => getPerson(id)!.name).join("、")}积怨 +1，当前省信任 -1，合作承诺网关闭`,
          );
      }
    }
    if (p.stock > 0 && !m.rights[matter.province]) {
      const exchange = action.exchange || "ownership";
      if (exchange === "ownership") {
        v.effects.push(
          `${province(g, matter.province).name}保留资源收益权；长期自治 +1；本次征调保留1物资`,
        );
        v.costs.stock = Math.max(0, p.stock - 1);
      } else if (exchange === "budget")
        v.effects.push(
          `${province(g, matter.province).name}获得每回合1财政的部门预算承诺，可暂停预算但信任下降`,
        );
      else {
        need(
          "替代工业供应",
          capability(g, "industry", matter).every((c) => c.met),
          "中央供应替代地方征调，需要计划委工业能力和兼容标准",
        );
        v.costs.province = "industry";
        v.effects.push("由工业省承担建设/抢修物资，不产生无关省份的利益要求");
      }
    }
    v.effects.push(...effectDescriptions(p, matter));
  } else if (action.type === "regime") {
    v.title = `国家制度改革：${regimes[action.regime].name}`;
    v.costs = { commands: 1, treasury: 1, capital: 2, stock: 0 };
    need(
      "唯一制度与过渡期",
      !m.pending && m.regime !== action.regime,
      "同一时刻只能推进一套基础体制，现行制度在下一回合生效前继续有效",
    );
    v.effects = [
      `覆盖三个省；下回合生效，清除旧局部主责但不取消尚有效的具体授权`,
      regimes[action.regime].gain,
      `失去/限制：${regimes[action.regime].loss}`,
    ];
    v.parents = [m.origins.regime || ""];
    v.opponents = Object.values(s.appointments).filter(
      (id): id is string =>
        !!id &&
        getPerson(id)!.stance.authority !==
          (action.regime === "vertical" ? 0 : 1),
    );
    v.effects.push(
      `受益：${action.regime === "vertical" ? "中央专家与安全集团" : "地方负责人及跨文明组织"}；反对者在过渡完成时积怨 +1：${v.opponents.map((id) => getPerson(id)!.name).join("、")}`,
    );
  } else if (action.type === "department") {
    v.title = "全国部门改革";
    v.costs = { commands: 1, treasury: 1, capital: 1, stock: 0 };
    need(
      "部门改革未重复",
      !m.departmentPending && m.department !== action.department,
      "同一时刻只能推进一项部门改革，下一回合生效",
    );
    v.effects = [
      action.department === "anomaly"
        ? "三省异常事务统一归异常局；地方应急仍受基础体制约束"
        : action.department === "evacuation"
          ? "全国省政府获得独立疏散权限，垂直体制也能本地快速应急"
          : "建立中央跨省运输权限；仍需要兼容标准及有资格负责人",
      "部门改革是单槽试点：替换已有部门改革会失去其旧能力",
    ];
  } else if (action.type === "authorize") {
    const matter = m.matters.find((x) => x.id === action.matter);
    v.title = "具体事务临时授权";
    v.costs = { commands: 1, treasury: 0, capital: 1, stock: 0 };
    need(
      "地区与合法机构",
      !!matter &&
        offices.some(
          (o) =>
            o.id === action.lead &&
            (!o.province || o.province === matter.province),
        ),
      "只能指定中央部门或本省政府，不能付费获得异省资源权",
    );
    need(
      "紧急状态资格",
      !action.emergency || (!!matter && matter.stage >= 2),
      "阶段≥2的真实危机才能授予紧急强制权",
    );
    v.effects = [
      `指定${getOffice(action.lead)?.name || "机构"}为主管${action.joint ? "，邀请中央与地方正式联合参与" : ""}`,
      "仅当前具体事务有效，到本回合结算时到期；优先于长期制度",
      action.emergency
        ? "允许越过路线否决，但能力启用条件仍不可越过"
        : "没有紧急强制资格",
    ];
    v.parents = matter?.source ? [matter.source] : [];
  } else if (action.type === "local") {
    v.title = "本省异常主责调整";
    v.costs = { commands: 1, treasury: 0, capital: 1, stock: 0 };
    need(
      "本省合法机构",
      offices.some(
        (o) =>
          o.id === action.lead &&
          o.domains.includes("anomaly") &&
          (!o.province || o.province === action.province),
      ),
      "小范围主责只能授给具有异常权限的中央机构或本省政府",
    );
    v.effects = [
      `${province(g, action.province).name}异常主责长期归${getOffice(action.lead)?.name}；不能自动形成跨省指挥关系`,
      "国家基础体制完成大改革时，此局部主责将被重置",
    ];
  } else if (action.type === "appoint") {
    v.title = "人事任命";
    v.costs.commands = 1;
    need(
      "合法人物和职位",
      offices.some((o) => o.id === action.office) &&
        (!action.person || !!getPerson(action.person)),
      "人物和职位必须真实存在",
    );
    need(
      "一人一职",
      !action.person ||
        !Object.entries(s.appointments).some(
          ([o, id]) => id === action.person && o !== action.office,
        ),
      "请先免去原职再调任；不能一人同时占多个职位",
    );
    need(
      "实际变更",
      s.appointments[action.office] !== action.person,
      "职位没有变化",
    );
    v.actors = action.person ? [action.person] : [];
    v.institutions = [action.office];
    v.effects = [
      `${getOffice(action.office)?.name}：${getPerson(s.appointments[action.office])?.name || "空缺"} → ${getPerson(action.person)?.name || "空缺"}`,
      "职位决定正式参与资格；工程师调离、积怨达到3或抽调参与事务时会中断其长期工程",
    ];
  } else if (action.type === "policy") {
    v.title = `政策调整：${issueNames[action.issue][action.side]}`;
    v.costs.commands = 1;
    v.costs.capital = 1;
    need(
      "真实政策变更",
      s.policies[action.issue] !== action.side &&
        (action.side === 0 || action.side === 1),
      "政策无需重复设置",
    );
    v.effects = [
      action.issue === "disclosure"
        ? action.side === 0
          ? "保密政策关闭所有群众公开动员；允许合法秘密封印"
          : "公开政策关闭秘密高级封印；群众救援可以获得资格"
        : action.issue === "method"
          ? "协商政策可与有限公开资料共同形成委员会批准；强制政策不能替代协议"
          : "政策影响相关路线与派系，只有参与具体事务的人才触发冲突",
    ];
  } else if (action.type === "mediate") {
    v.title = "政治和解";
    v.costs.commands = 1;
    v.costs.capital = 1;
    need(
      "实际积怨",
      !!getPerson(action.person) && s.grievances[action.person] > 0,
      "人物需要实际积怨",
    );
    v.actors = [action.person];
    v.effects = [
      "积怨 -1，恢复到2时重新允许协办；此前压制群众或解除协议的制度后果不会自动撤销",
    ];
  } else if (action.type === "project") {
    v.title =
      action.project === "energy" ? "开工：宗门灵脉能源工程" : "建设异常预警站";
    v.costs = {
      commands: 1,
      treasury: action.project === "energy" ? 2 : 1,
      capital: 0,
      stock: action.project === "energy" ? 1 : 0,
      province: action.province,
    };
    need(
      "无重复工程",
      !m.works.some(
        (w) => w.type === action.project && w.province === action.province,
      ),
      "同省同类工程不可重复建造",
    );
    if (action.project === "energy")
      v.conditions.push(
        ...capability(g, "leywork", {
          id: "project",
          kind: "opportunity",
          province: action.province,
          title: "",
          description: "",
          stage: 1,
          containment: 0,
          isolated: false,
          evacuated: false,
          age: 0,
        }),
      );
    v.effects = [
      action.project === "energy"
        ? "工程师连续占用两回合；每回合1财政施工承诺，完工每回合物资 +2、税收 +1，偶数回合异常压力 +1并解锁能源网络"
        : "下次结算支付1财政施工；完工让本省持续危机每次升级最多增加1危机",
      "可以暂停施工，暂停会失去1进度；中断原因会记录在因果日志",
    ];
  } else if (action.type === "pause") {
    const work = m.works.find((w) => w.id === action.work);
    v.title = work?.paused ? "恢复施工/预算" : "暂停施工/预算";
    need(
      "存在可调整项目",
      (!!work && !work.completed) ||
        (action.work.startsWith("budget:") &&
          m.budgets.includes(action.work.split(":")[1] as ProvinceId)),
      "完工项目没有施工承诺可取消",
    );
    v.effects = [
      "暂停工程取消每回合1财政承诺，并失去1进度；暂停省份预算则降低该省信任1",
    ];
  } else if (action.type === "investigate") {
    v.title = "主动调查";
    v.costs.commands = 1;
    need(
      "主管机构有人",
      !!s.appointments[action.deck === "archive" ? "anomaly" : "plan"],
      "档案调查由异常局，勘探和标准试点由计划委主持",
    );
    v.effects = [
      action.deck === "ley"
        ? "勘探灵脉：异常压力 +1，解锁宗门工程与主动机会"
        : action.deck === "archive"
          ? "秘密档案调查取得封印情报；地方信任 -1；委员会可选择公开有限资料"
          : action.deck === "standards"
            ? "标准试点揭开飞剑统计公报；工业与宗门必须选择兼容标准或保留自主申报"
            : "随机揭开一项跨文明政治公报；固定种子与相同操作可复现，选择将改变组织权限",
    ];
  } else if (action.type === "reconcile") {
    v.title = "恢复地方组织与收益协约";
    v.costs.commands = 1;
    v.costs.treasury = 1;
    v.effects = [
      `${province(g, action.province).name}解除压制、信任 +1、保留地方收益权`,
      "恢复群众救援资格；过去的因果记录不会被删除",
    ];
  } else if (action.type === "unblock") {
    v.title = "疏通中央审批";
    v.costs.commands = 1;
    v.costs.treasury = 1;
    need("已有行政阻塞", s.paralysis > 0, "没有阻塞无需疏通");
    v.effects = ["中央阻塞 -2；中央垂直审批在低于2后恢复"];
  } else if (action.type === "end") {
    v.title = "结算并进入下一回合";
    if (m.goalPending && s.turn >= 3) v.errors.push("国家发展规划期限：请先在国家目标面板召开会议并立项主要战略");
    const f = finance(g);
    v.effects = [
      `先支出${f.total}（固定${f.fixed} / 制度${f.maintenance} / 工程${f.projectCosts}），再收入${f.income}；财政${f.current} → ${f.next}`,
      f.default
        ? "本次无法履行最低承诺，连续两次财政违约会失败"
        : "本次能履行全部最低承诺",
      `未处理持续危机按阶段升级；下回合最多接纳3件新局势，额外待办不递归`,
    ];
    const simulated = structuredClone(g);
    advance(simulated, "");
    v.after = {
      commands: simulated.core.commands,
      treasury: simulated.core.treasury,
      capital: simulated.core.capital,
    };
    return v;
  } else {
    v.title = action.type === "forecast" ? "核对财政预测" : "跳过教学";
    v.effects = [
      action.type === "forecast"
        ? "已实际查看收入、支出和承诺，进入教学连锁阶段"
        : "结束教学提示，保留当前组织与全部实际后果",
    ];
  }
  if (s.commands < v.costs.commands) v.errors.push("行政命令不足");
  if (s.treasury < v.costs.treasury) v.errors.push("财政不足");
  if (s.capital < v.costs.capital) v.errors.push("政治资本不足");
  if (v.costs.province && province(g, v.costs.province).stock < v.costs.stock)
    v.errors.push("指定供给省物资不足");
  v.errors.push(
    ...v.conditions.filter((c) => !c.met).map((c) => `${c.label}：${c.reason}`),
  );
  v.after = {
    commands: s.commands - v.costs.commands,
    treasury: s.treasury - v.costs.treasury,
    capital: s.capital - v.costs.capital,
  };
  return v;
}
function effectDescriptions(p: Plan, m: Matter) {
  const descriptions: Record<Plan["effect"], string> = {
    repair: "预防检修记录将降低下一回合事故初始阶段",
    public: "居民得到救援；异常源暂时遏制；后续能源配给事件按实际公开路径生成",
    seal: "危机源被消除；秘密处置会在下回合产生地方公开说明诉求",
    contain: "危机遏制1回合但保留在地图；重复遏制不会累加持续时间",
    evacuate: "撤离人口并遏制1回合，异常源继续存在；相关终局可承认受控危机",
    isolate: "隔离危机影响，地方停止基础生产、不能群众动员；其他省获得保护",
    supply: "跨省保供恢复工业与能源供应，并记录实际资源来源",
    ownership: "保留地方收益权，信任恢复，长期合作渠道打开",
    standard: "建立跨文明兼容标准；以后工业整合及运输可行，但新增每回合1维护费",
    cooperate: "建立正式跨组织合作渠道；强制征调会实际解除这一关系",
    permit: "公开有限技术资料；联合委员会可在协商路线中同时发动救援与封印",
    reserve: "开启跨省应急运输通道",
    suppress: "群众组织受到压制，公开动员不再可用",
    activate: "正式完成所选国家目标；仍需存活至任期结束",
    invest: "启动两回合能源工程，持续占用墨玄并产生财政承诺",
    archive: "获得密封档案情报，不把情报换成抽象的资源奖励",
  };
  return [
    descriptions[p.effect],
    m.kind === "oldgod"
      ? `当前危机阶段${m.stage}/4；阶段升级条件与管控效果将留在地图上`
      : "方案后果会进入真实因果历史",
  ];
}
function resent(g: V2Game, id: string, why: string) {
  const old = g.core.grievances[id];
  g.core.grievances[id] = Math.min(3, old + 1);
  if (
    old < 3 &&
    g.core.grievances[id] === 3 &&
    !g.core.politicalTriggered.includes(id)
  ) {
    g.core.politicalTriggered.push(id);
    g.core.crisis++;
    record(
      g,
      `${getPerson(id)!.name}拒绝协办`,
      [id],
      [],
      [why],
      ["积怨达到3，正式协办资格关闭；危机 +1"],
      g.machine.origins[`person:${id}`]
        ? [g.machine.origins[`person:${id}`]]
        : [],
    );
  }
}
function enactPlan(
  g: V2Game,
  matter: Matter,
  p: Plan,
  action: Extract<Action, { type: "resolve" }>,
  source: string,
) {
  const m = g.machine;
  const local = province(g, matter.province);
  const part = participants(g, matter);
  if (p.stock > 0 && !m.rights[matter.province]) {
    if ((action.exchange || "ownership") === "ownership") {
      m.rights[matter.province] = true;
      local.autonomy++;
      m.origins[`rights:${matter.province}`] = source;
    } else if (
      action.exchange === "budget" &&
      !m.budgets.includes(matter.province)
    )
      m.budgets.push(matter.province);
  }
  if (action.force) {
    for (const id of part.actors.filter(
      (id) =>
        p.disclosure !== undefined &&
        getPerson(id)!.stance.disclosure !== p.disclosure,
    ))
      resent(g, id, "紧急命令越过其路线批准");
    m.trust[matter.province] = Math.max(0, m.trust[matter.province] - 1);
    m.cooperation = false;
    m.origins.cooperation = source;
  }
  const remove = () => {
    matter.lifecycle = "resolved";
    m.archive.push(structuredClone(matter));
    m.matters = m.matters.filter((x) => x.id !== matter.id);
    g.core.resolved++;
  };
  if (p.effect === "repair") {
    m.milestones.push("prevention");
    remove();
  }
  if (p.effect === "archive") {
    m.knowledge = true;
    m.origins.knowledge = source;
    remove();
  }
  if (p.effect === "public") {
    matter.evacuated = true;
    matter.containment = 1;
    m.fatigue[matter.province]++;
    m.origins[`fatigue:${matter.province}`] = source;
    if (m.fatigue[matter.province] >= 2) {
      m.rights[matter.province] = true;
      local.autonomy++;
      record(
        g,
        "群众救援组织提出自治诉求",
        ["xing"],
        [`gov-${matter.province}`],
        ["已连续发动两次动员"],
        ["地方保留长期收益权和自治席位"],
        [source],
      );
    }
    if (matter.kind === "accident") {
      m.accidentRoute = "public";
      m.milestones.push("accident-managed");
      m.origins.accident = source;
    }
  }
  if (p.effect === "seal") {
    if (matter.kind === "accident") {
      m.accidentRoute = p.id === "joint" ? "joint" : "secret";
      m.milestones.push("accident-managed");
      m.origins.accident = source;
    }
    if (matter.kind === "oldgod") {
      m.milestones.push("north-managed");
      m.origins.north = source;
    }
    if (p.id !== "joint") {
      m.trust[matter.province] = Math.max(0, m.trust[matter.province] - 1);
      m.origins[`trust:${matter.province}`] = source;
    }
    remove();
  }
  if (p.effect === "contain") matter.containment = 1;
  if (p.effect === "evacuate") {
    matter.evacuated = true;
    matter.containment = 1;
    if (matter.kind === "oldgod") {
      m.milestones.push("north-managed");
      m.origins.north = source;
    }
    if (matter.kind === "supply") remove();
  }
  if (p.effect === "isolate") {
    matter.isolated = true;
    matter.containment = 8;
    m.suppressed[matter.province] = true;
    m.origins[`suppressed:${matter.province}`] = source;
    if (matter.kind === "oldgod") {
      m.milestones.push("north-managed");
      m.origins.north = source;
    }
    if (matter.kind === "accident") {
      m.accidentRoute = "isolate";
      m.milestones.push("accident-managed");
      m.origins.accident = source;
    }
  }
  if (p.effect === "supply") {
    m.milestones.push("supply-managed");
    local.pressure.production = Math.max(0, local.pressure.production - 2);
    remove();
  }
  if (p.effect === "ownership") {
    m.rights[matter.province] = true;
    local.autonomy++;
    m.trust[matter.province] = Math.min(3, m.trust[matter.province] + 1);
    m.cooperation = true;
    m.origins.cooperation = source;
    m.origins[`rights:${matter.province}`] = source;
    remove();
  }
  if (p.effect === "standard") {
    m.standards = true;
    m.origins.standards = source;
    remove();
  }
  if (p.effect === "cooperate") {
    m.cooperation = true;
    m.origins.cooperation = source;
    remove();
  }
  if (p.effect === "permit") {
    m.permit = true;
    m.origins.permit = source;
    remove();
  }
  if (p.effect === "reserve") {
    m.reserve = true;
    m.department = "transport";
    m.origins.department = source;
    remove();
  }
  if (p.effect === "suppress") {
    m.suppressed[matter.province] = true;
    m.trust[matter.province] = Math.max(0, m.trust[matter.province] - 1);
    m.origins[`suppressed:${matter.province}`] = source;
    remove();
  }
  if (p.effect === "invest") {
    startWork(g, "energy", matter.province, source);
    remove();
  }
  if (p.effect === "activate") {
    m.finalDone = true;
    remove();
  }
  // Work commitment is incompatible with drawing the assigned engineer into another immediate matter.
  for (const actor of part.actors) {
    if (m.works.some((w) => w.worker === actor && !w.completed && !w.paused))
      m.occupied[actor] = source;
  }
  if (m.mode === "tutorial" && m.tutorial === 0 && matter.kind === "warning") {
    m.tutorial = 1;
    createMatter(g, "accident", "south", source);
  }
  if (
    m.mode === "tutorial" &&
    m.tutorial === 1 &&
    matter.kind === "accident" &&
    m.milestones.includes("accident-managed")
  )
    m.tutorial = 2;
}
function startWork(
  g: V2Game,
  type: "energy" | "warning",
  pid: ProvinceId,
  source: string,
) {
  g.machine.works.push({
    id: `work-${g.core.nextId++}`,
    type,
    province: pid,
    progress: 0,
    duration: type === "energy" ? 2 : 1,
    paused: false,
    worker: type === "energy" ? "mo" : undefined,
    completed: false,
    source,
  });
  g.machine.origins[`work:${pid}:${type}`] = source;
}
function checkEnding(g: V2Game) {
  if (g.core.crisis >= 12) {
    g.core.status = "lost";
    g.core.ending = "持续危机进入全国失控状态。";
  } else if (g.core.insolvency >= 2) {
    g.core.status = "lost";
    g.core.ending = "连续两回合无法履行财政承诺，国家信用崩溃。";
  } else if (g.core.paralysisStreak >= 2) {
    g.core.status = "lost";
    g.core.ending = "中央审批连续两回合陷入不可恢复的行政阻塞。";
  }
}
function advance(g: V2Game, source: string) {
  const s = g.core,
    m = g.machine,
    f = finance(g);
  s.treasury = f.next;
  s.insolvency = f.default ? s.insolvency + 1 : 0;
  s.capital++;
  for (const p of s.provinces) {
    const isolation = m.matters.some((x) => x.province === p.id && x.isolated);
    if (!isolation) p.stock += p.districts.reduce((a, d) => a + d.output, 0);
    else
      record(
        g,
        `${p.name}隔离造成生产暂停`,
        [],
        [],
        ["地图上仍存在隔离区"],
        ["本回合不发放地区基础产出"],
        m.origins[`suppressed:${p.id}`]
          ? [m.origins[`suppressed:${p.id}`]]
          : [],
      );
  }
  for (const w of m.works) {
    if (w.completed) {
      if (w.type === "energy") {
        province(g, w.province).stock += 2;
        if (s.turn % 2 === 0) province(g, w.province).pressure.anomaly++;
      }
      continue;
    }
    if (w.paused) continue;
    const workerValid =
      !w.worker ||
      (active(g, w.worker) &&
        ["plan", "gov-south"].includes(personOffice(g, w.worker)!));
    if (workerValid && !f.default) {
      w.progress++;
      if (w.progress >= w.duration) {
        w.completed = true;
        record(
          g,
          `工程竣工：${w.type === "energy" ? "宗门灵脉能源网" : "异常预警站"}`,
          w.worker ? [w.worker] : [],
          [],
          ["施工人员持续在位、财政承诺得到履行"],
          ["新增真实设施能力，目标里程碑更新"],
          [w.source, source],
        );
      }
    } else {
      w.progress = Math.max(0, w.progress - 1);
      record(
        g,
        "工程因占用或岗位变化中断",
        w.worker ? [w.worker] : [],
        [],
        [
          w.worker
            ? m.occupied[w.worker]
              ? "工程师被抽调参与即时事务"
              : "工程师调离、拒绝协办或财政违约"
            : "财政违约",
        ],
        ["进度 -1，未支付本回合不可执行工程施工费"],
        [
          w.source,
          m.occupied[w.worker || ""] ||
            m.origins[`person:${w.worker}`] ||
            source,
        ],
      );
    }
  }
  for (const item of [...m.matters]) {
    if (
      item.kind === "gazette" ||
      item.kind === "opportunity" ||
      item.kind === "warning" ||
      item.kind === "final"
    )
      continue;
    item.age++;
    if (item.containment > 0) {
      item.containment--;
      continue;
    }
    item.stage = Math.min(4, item.stage + 1);
    item.lifecycle = "deteriorated";
    const station = m.works.some(
      (w) =>
        w.type === "warning" && w.province === item.province && w.completed,
    );
    const severity = item.evacuated || station ? 1 : item.stage >= 3 ? 2 : 1;
    s.crisis += severity;
    province(g, item.province).pressure.anomaly++;
    if (item.stage >= 2)
      province(g, item.province).stock = Math.max(
        0,
        province(g, item.province).stock - 1,
      );
    if (item.stage >= 3 && !item.evacuated) s.paralysis++;
    record(
      g,
      `${item.title}进入阶段${item.stage}`,
      [],
      [],
      ["未封印、未隔离且遏制已到期"],
      [
        `全国危机 +${severity}`,
        "生产交通受到异常影响：本省物资 -1",
        item.stage >= 3 && !item.evacuated
          ? "未撤离居民导致中央审批阻塞 +1"
          : "人口已撤离或预警站减轻全国影响",
      ],
      [item.source || source],
    );
  }
  for (const id of Object.values(s.appointments))
    if (id) s.roots[id] = Math.min(3, s.roots[id] + 1);
  s.paralysisStreak = s.paralysis >= 4 ? s.paralysisStreak + 1 : 0;
  m.occupied = {};
  m.authorization = {};
  checkEnding(g);
  if (s.status !== "playing") return;
  if (s.turn === duration(g)) {
    const victory =
      (m.mode === "national" || m.mode === "experimental")
        ? m.finalDone
        : m.milestones.includes("accident-managed") &&
          m.milestones.includes("north-managed");
    s.status = victory ? "won" : "lost";
    s.ending = report(g);
    return;
  }
  s.turn++;
  s.commands = s.paralysis >= 2 ? 4 : 5;
  m.admitted = 0;
  if (m.pending && m.pending.due <= s.turn) {
    m.regime = m.pending.regime;
    m.origins.regime = m.pending.source;
    m.overrides = {};
    for (const id of Object.values(s.appointments))
      if (
        id &&
        getPerson(id)!.stance.authority !== (m.regime === "vertical" ? 0 : 1)
      )
        resent(g, id, "国家改革过渡完成，其自治路线被排除");
    record(
      g,
      "国家体制过渡完成",
      [],
      offices.map((o) => o.id),
      ["旧基础体制退出"],
      [regimes[m.regime].name, regimes[m.regime].gain, regimes[m.regime].loss],
      [m.pending.source],
    );
    delete m.pending;
  }
  if (m.departmentPending && m.departmentPending.due <= s.turn) {
    m.department = m.departmentPending.type;
    m.origins.department = m.departmentPending.source;
    record(
      g,
      "全国部门改革生效",
      [],
      [],
      [],
      [m.department],
      [m.departmentPending.source],
    );
    delete m.departmentPending;
  }

  if (
    s.turn === 2 &&
    !m.matters.some((x) => x.kind === "accident") &&
    !m.milestones.includes("accident-managed")
  )
    createMatter(
      g,
      "accident",
      "south",
      m.history.find(
        (h) => h.title.includes("预防") || h.title.includes("新任期"),
      )?.id,
    );
  if (
    s.turn >= 3 &&
    m.accidentRoute &&
    !m.milestones.includes("chain-generated")
  ) {
    m.milestones.push("chain-generated");
    createMatter(
      g,
      m.accidentRoute === "public"
        ? "supply"
        : m.accidentRoute === "secret"
          ? "distrust"
          : "gazette",
      "south",
      m.origins.accident,
      m.accidentRoute === "public" || m.accidentRoute === "secret"
        ? undefined
        : "flying",
    );
  }
  if (s.turn === 4) createMatter(g, "oldgod", "north", m.origins.accident);
  if (m.mode === "national" && s.turn >= 5 && s.turn < 8) {
    const z = gazettes[s.turn - 4];
    createMatter(g, "gazette", pids[(s.turn - 5) % 3], undefined, z.id);
  }
  if (m.mode === "national" && s.turn === 8)
    createMatter(
      g,
      "final",
      "north",
      m.history.find(
        (h) => h.title.includes("工程竣工") || h.title.includes("改革"),
      )?.id,
    );
  while (m.backlog.length && m.admitted < 3) {
    m.matters.push(m.backlog.shift()!);
    m.admitted++;
  }
  // Snapshot pressure once. New effects never recursively cause immediate draws.
  for (const p of s.provinces) {
    if (p.pressure.production >= 2) {
      p.pressure.production -= 2;
      createMatter(g, "supply", p.id, m.origins.accident);
    }
    if (p.pressure.anomaly >= 2) {
      p.pressure.anomaly -= 2;
      createMatter(g, "gazette", p.id, m.origins.accident, "dream");
    }
    if (p.pressure.social >= 2) {
      p.pressure.social -= 2;
      createMatter(g, "distrust", p.id, m.origins[`trust:${p.id}`]);
    }
  }
  sync(g);
  const reached = milestones(g)
    .filter((c) => c.met)
    .map((c) => c.label);
  for (const label of reached)
    if (!m.milestones.includes(label)) {
      m.milestones.push(label);
      record(
        g,
        `国家目标里程碑：${label}`,
        [],
        [],
        [],
        ["当前组织与设施满足这一阶段条件；终局仍重新检查"],
        [source],
      );
    }
}
function applyAction(g: V2Game, action: Action): V2Game {
  const v = previewAction(g, action);
  if (v.errors.length) throw new Error(v.errors.join("；"));
  const n = structuredClone(g),
    m = n.machine,
    s = n.core;
  let source = record(
    n,
    v.title,
    v.actors,
    v.institutions,
    [
      ...v.conditions.map(
        (c) => `${c.label}：${c.met ? "满足" : "未满足"} · ${c.reason}`,
      ),
      `基础体制：${regimes[m.regime].name}`,
    ],
    [
      ...v.effects,
      `成本：${v.costs.commands}命令 / ${v.costs.treasury}财政 / ${v.costs.capital}资本 / ${v.costs.stock}物资`,
    ],
    v.parents,
  );
  if (action.type === "end") {
    advance(n, source);
    return n;
  }
  s.commands -= v.costs.commands;
  s.treasury -= v.costs.treasury;
  s.capital -= v.costs.capital;
  if (v.costs.province) province(n, v.costs.province).stock -= v.costs.stock;
  if (action.type === "selectGoal") {
    m.goal = action.goal; m.goalPending = false; m.origins.goal = source;
  } else if (action.type === "resolve") {
    const item = m.matters.find((x) => x.id === action.matter)!;
    item.lastOptionTurn = s.turn; item.lastOption = action.option;
    item.steps = [...new Set([...(item.steps || []),v.title])];
    enactPlan(
      n,
      item,
      plansFor(item, m.goal).find((p) => p.id === action.option)!,
      action,
      source,
    );
    const retained = m.matters.find(x => x.id === item.id);
    if (retained) { retained.lastOptionTurn = s.turn; retained.lastOption = action.option; }
  } else if (action.type === "regime")
    m.pending = { regime: action.regime, due: s.turn + 1, source };
  else if (action.type === "department")
    m.departmentPending = { type: action.department, due: s.turn + 1, source };
  else if (action.type === "authorize") {
    m.authorization[action.matter] = {
      lead: action.lead,
      joint: action.joint,
      emergency: action.emergency,
      expires: s.turn,
      source,
    };
    if (m.mode === "tutorial" && m.tutorial === 1)
      m.origins.tutorialAuthorization = source;
  } else if (action.type === "local") {
    m.overrides[action.province] = action.lead;
    m.origins[`local:${action.province}`] = source;
  } else if (action.type === "appoint") {
    s.commands += v.costs.commands;
    n.core = baseAppoint(s, action.office, action.person);
    if (action.person) m.origins[`person:${action.person}`] = source;
    const old = g.core.appointments[action.office];
    if (old) m.origins[`person:${old}`] = source;
  } else if (action.type === "policy") {
    s.commands++;
    s.capital++;
    n.core = basePolicy(s, action.issue, action.side);
    m.origins.policy = source;
  } else if (action.type === "mediate") {
    s.commands++;
    s.capital++;
    n.core = baseMediate(s, action.person);
  } else if (action.type === "project")
    startWork(n, action.project, action.province, source);
  else if (action.type === "pause") {
    const w = m.works.find((w) => w.id === action.work);
    if (w) {
      w.paused = !w.paused;
      if (w.paused) w.progress = Math.max(0, w.progress - 1);
    } else {
      const pid = action.work.split(":")[1] as ProvinceId;
      m.budgets = m.budgets.filter((p) => p !== pid);
      m.trust[pid] = Math.max(0, m.trust[pid] - 1);
    }
  } else if (action.type === "investigate") {
    if (action.deck === "ley") {
      m.surveyed = true;
      m.origins.surveyed = source;
      province(n, "south").pressure.anomaly++;
      createMatter(n, "opportunity", "south", source);
    } else if (action.deck === "archive") {
      m.knowledge = true;
      m.trust.north = Math.max(0, m.trust.north - 1);
      createMatter(n, "gazette", "north", source, "dream");
    } else if (action.deck === "standards")
      createMatter(n, "gazette", "industry", source, "flying");
    else {
      const z = gazettes[Math.floor(random(s) * gazettes.length)];
      createMatter(n, "gazette", "industry", source, z.id);
    }
  } else if (action.type === "reconcile") {
    m.suppressed[action.province] = false;
    m.trust[action.province] = Math.min(3, m.trust[action.province] + 1);
    m.rights[action.province] = true;
    m.origins[`rights:${action.province}`] = source;
  } else if (action.type === "unblock")
    s.paralysis = Math.max(0, s.paralysis - 2);
  else if (
    action.type === "forecast" &&
    m.mode === "tutorial" &&
    m.tutorial === 2
  ) {
    m.tutorial = 3;
    createMatter(
      n,
      m.accidentRoute === "public" ? "supply" : "distrust",
      "south",
      m.origins.accident,
    );
  } else if (action.type === "skip") m.tutorial = 4;
  if (m.mode === "tutorial" && m.tutorial === 3 && action.type === "resolve")
    m.tutorial = 4;
  sync(n);
  checkEnding(n);
  return n;
}
export function report(g: V2Game) {
  const m = g.machine;
  const target =
    m.mode === "national"
      ? `${goals[m.goal].name}：${m.finalDone ? "正式完成" : "未完成终局检验"}`
      : `紧急状态：南岭${m.milestones.includes("accident-managed") ? "已管理" : "未得到管理"}，北境${m.milestones.includes("north-managed") ? "已管理" : "未得到管理"}`;
  const changes = m.history
    .filter((h) => /改革|人事|授权|工程竣工/.test(h.title))
    .slice()
    .reverse()
    .map((h) => `第${h.turn}回合 ${h.title}：${h.effects[0]}`)
    .join("\n");
  return `联邦${duration(g) === 8 ? "八年" : "四阶段"}执政报告\n${target}\n形成的体制：${regimes[m.regime].name}\n事故处置路径：${m.accidentRoute || "未作出决定"}
${m.history
  .filter((h) => h.actors.length && h.parents.length)
  .slice(0, 4)
  .map(
    (h) =>
      `第${h.turn}回合 ${h.title}：${h.actors.map((id) => getPerson(id)?.name || id).join("、")}通过${h.institutions.map((id) => getOffice(id)?.name || id).join("、") || "正式任职"}参与。`,
  )
  .join(
    "\n",
  )}\n${changes}\n尚未解决：${m.matters.map((x) => `${x.title}（阶段${x.stage}${x.isolated ? "，隔离保护其他省" : ""}）`).join("、") || "无现存重大危机"}\n长期矛盾：${
    pids
      .filter((p) => m.suppressed[p] || m.trust[p] === 0)
      .map((p) => `${province(g, p).name}群众信任受到损害`)
      .join("、") || "地方仍保有协商空间"
  }；${m.budgets.length}项预算承诺；兼容标准${m.standards ? "已建立并产生维护义务" : "尚未建立"}。`;
}
export function serializeV2(g: V2Game) {
  return JSON.stringify(g);
}
export function deserializeV2(raw: string): V2Game {
  const parsed = JSON.parse(raw);
  if (parsed.version === 1 || parsed.schema !== 2)
    throw new Error(
      "这是v0.1或未知版本存档，不能静默迁移到v0.2。旧存档未改动，请选择新游戏。",
    );
  const g = parsed as V2Game;
  g.core = baseDeserialize(JSON.stringify(g.core));
  const m = g.machine;
  if (
    !m ||
    !["tutorial", "campaign", "national", "experimental"].includes(m.mode) ||
    !Object.hasOwn(goals, m.goal) ||
    !Object.hasOwn(regimes, m.regime) ||
    !Array.isArray(m.matters) ||
    !Array.isArray(m.history) ||
    !Array.isArray(m.works) ||
    !Array.isArray(m.backlog) ||
    !Array.isArray(m.milestones) ||
    !Array.isArray(m.budgets) ||
    !m.authorization ||
    !m.origins ||
    !m.occupied ||
    !m.overrides ||
    !Number.isInteger(m.tutorial) ||
    m.tutorial < 0 ||
    m.tutorial > 4 ||
    !["none", "anomaly", "evacuation", "transport"].includes(m.department) ||
    Object.values(m.overrides).some(
      (id) => !offices.some((o) => o.id === id),
    ) ||
    Object.values(m.authorization).some(
      (a) => !offices.some((o) => o.id === a.lead) || a.expires !== g.core.turn,
    )
  )
    throw new Error("v0.2组织状态不完整");
  for (const pid of pids)
    if (
      !m.rights ||
      !m.trust ||
      !m.fatigue ||
      !m.suppressed ||
      typeof m.rights[pid] !== "boolean" ||
      !Number.isInteger(m.trust[pid]) ||
      m.trust[pid] < 0 ||
      m.trust[pid] > 3 ||
      !Number.isInteger(m.fatigue[pid]) ||
      typeof m.suppressed[pid] !== "boolean"
    )
      throw new Error("v0.2地方组织状态无效");
  if (
    [...m.matters, ...m.backlog].some(
      (x) =>
        !pids.includes(x.province) ||
        ![
          "warning",
          "accident",
          "supply",
          "distrust",
          "oldgod",
          "gazette",
          "opportunity",
          "final",
        ].includes(x.kind) ||
        !Number.isInteger(x.stage) ||
        x.stage < 1 ||
        x.stage > 4 ||
        typeof x.title !== "string",
    ) ||
    new Set([...m.matters, ...m.backlog].map((x) => x.id)).size !==
      m.matters.length + m.backlog.length
  )
    throw new Error("v0.2持续事件无效");
  if (
    m.history.some(
      (h) =>
        typeof h.id !== "string" ||
        typeof h.title !== "string" ||
        !Array.isArray(h.effects) ||
        !Array.isArray(h.parents) ||
        h.parents.some((id) => !m.history.some((x) => x.id === id)),
    )
  )
    throw new Error("因果记录引用不存在的决策");
  if (
    m.works.some(
      (w) =>
        !pids.includes(w.province) ||
        !["energy", "warning"].includes(w.type) ||
        !Number.isInteger(w.progress) ||
        w.progress < 0 ||
        w.progress > w.duration,
    ) ||
    (m.pending &&
      (!Object.hasOwn(regimes, m.pending.regime) ||
        m.pending.due <= g.core.turn))
  )
    throw new Error("工程或改革过渡状态无效");
  m.goalPending ??= false; m.revision ??= 0; m.archive ??= []; m.results ??= [];
  m.difficulty ??= "standard"; m.rulesVersion ??= "0.2";
  if (typeof m.goalPending !== "boolean" || !Number.isSafeInteger(m.revision) || m.revision < 0 || !Array.isArray(m.archive) || !Array.isArray(m.results) || !["relaxed", "standard", "challenging"].includes(m.difficulty)) throw new Error("v0.3执行记录或开局配置无效");
  const all = [...m.matters, ...m.backlog, ...m.archive];
  if (new Set(all.map(x => x.id)).size !== all.length || m.archive.some(x => x.lifecycle !== "resolved")) throw new Error("事务ID重复或归档状态无效");
  return g;
}

export function matterProgress(m: Matter) {
  if (m.lifecycle === "resolved") return { completed: ["本事务全部要求完成，已归档"], remaining: [] };
  if (["accident", "oldgod"].includes(m.kind)) return {
    completed: [m.evacuated ? "居民已救援 / 撤离" : "", m.isolated ? "隔离边界已建立" : "", m.containment > 0 ? `管控仍有效：${m.containment}回合` : ""].filter(Boolean),
    remaining: ["异常源尚未封印；可组织合法封印，或选择持续遏制 / 隔离治理", m.containment === 0 ? "本回合结束将升级并损害物资；未撤离时还可能造成审批阻塞" : "管控到期后再次检查；不会因撤离自动消除异常源"],
  };
  return { completed: m.steps || [], remaining: ["选择并执行一个合法方案完成本事务"] };
}
export const resultNames = { failed: "执行失败", partial: "部分完成", resolved: "完全解决", changed: "危机持续 · 局势改变", applied: "决策已生效" };

/** UI commands are revision-checked and idempotent. A failed transaction returns the original state. */
export function executeCommand(g: V2Game, action: Action, request?: { id: string; revision: number }): { game: V2Game; result: ActionResult } {
  const prior = request && g.machine.results.find(x => x.id === request.id);
  if (prior) return { game: g, result: prior };
  const v = previewAction(g, action);
  const failed = (errors: string[]): { game: V2Game; result: ActionResult } => ({ game: g, result: {
    id: request?.id || `failed-${g.machine.revision}`, revision: g.machine.revision, turn: g.core.turn,
    action, status: "failed", title: v.title, effects: ["未扣除任何资源，原游戏状态保留"], completed: [], remaining: ["调整条件后重新预览"], errors,
    costs: { commands: 0, treasury: 0, capital: 0, stock: 0 },
  } });
  if (request && request.revision !== g.machine.revision) return failed(["局势已经变化，旧预览未执行。请重新预览当前状态"]);
  if (v.errors.length) return failed(v.errors);
  let n: V2Game;
  try { n = applyAction(g, action); } catch(e) { return failed([`结算中止，状态已回滚：${(e as Error).message}`]); }
  n.machine.revision = g.machine.revision + 1;
  const before = action.type === "resolve" ? g.machine.matters.find(x => x.id === action.matter) : undefined;
  const after = before ? n.machine.matters.find(x => x.id === before.id) : undefined;
  let status: ActionResult["status"] = "applied";
  if (before) {
    if (!after) status = "resolved";
    else {
      status = !before.evacuated && after.evacuated ? "partial" : "changed";
      after.lifecycle = status === "partial" ? "partial" : "processing";
      after.steps = [...new Set([...(before.steps || []), v.title])];
    }
  }
  const effects: string[] = [];
  for (const [key, label] of [["commands", "行政命令"], ["treasury", "财政"], ["capital", "政治资本"], ["crisis", "全国危机"], ["paralysis", "中央阻塞"]] as const) {
    if (n.core[key] !== g.core[key]) effects.push(`${label}：${g.core[key]} → ${n.core[key]}`);
  }
  for (const p of n.core.provinces) {
    const b = province(g, p.id);
    if (b.stock !== p.stock) effects.push(`${p.name}物资：${b.stock} → ${p.stock}`);
    if (g.machine.trust[p.id] !== n.machine.trust[p.id]) effects.push(`${p.name}信任：${g.machine.trust[p.id]} → ${n.machine.trust[p.id]}`);
    if (!g.machine.rights[p.id] && n.machine.rights[p.id]) effects.push(`${p.name}取得长期资源收益权`);
    if (g.machine.suppressed[p.id] !== n.machine.suppressed[p.id]) effects.push(`${p.name}群众组织${n.machine.suppressed[p.id] ? "受到压制" : "恢复组织资格"}`);
  }
  if (before && !after) effects.push(`${before.title}已移出待处理队列并归档`);
  if (after) effects.push(`仍有异常源：阶段${after.stage}/4，遏制${after.containment}回合，${after.evacuated ? "人口已保护" : "人口尚未撤离"}`);
  const newItems = [...n.machine.matters, ...n.machine.backlog].filter(x => ![...g.machine.matters, ...g.machine.backlog].some(b => b.id === x.id));
  effects.push(...newItems.map(x => `新局势：${x.title}${n.machine.backlog.some(b=>b.id===x.id) ? "（排队等待接纳）" : ""}`));
  const progress = before ? after ? matterProgress(after) : {completed: [v.title, "本事务全部要求完成，已归档"], remaining: []} : { completed: [v.title], remaining: [] };
  if (action.type === "selectGoal") effects.push(`主要战略已立项：${goals[n.machine.goal].name}；前期建设全部保留`);
  if (!effects.length) effects.push(...v.effects);
  const result: ActionResult = { id: request?.id || `command-${n.machine.revision}`, revision: n.machine.revision, turn: g.core.turn, action, status, title: v.title, effects, ...progress, errors: [], costs: v.costs,
    phase: before ? {before:before.stage, after:after?.stage} : undefined };
  n.machine.results.push(result);
  return { game: n, result };
}
/** Legacy API keeps throw-on-failure semantics for regression routes. */
export function executeAction(g: V2Game, action: Action): V2Game {
  const {game, result} = executeCommand(g, action);
  if (result.status === "failed") throw new Error(result.errors.join("；"));
  return game;
}
export function startCampaign(config: {mode: Mode; seed: string; difficulty: Difficulty}): V2Game {
  const g = newV2(config.mode, "night", config.seed);
  g.machine.goalPending = config.mode === "national" || config.mode === "experimental";
  g.machine.difficulty = config.difficulty;
  if (config.difficulty === "relaxed") g.core.treasury += 4;
  if (config.difficulty === "challenging") { g.core.treasury -= 3; g.core.capital -= 1; }
  return g;
}
