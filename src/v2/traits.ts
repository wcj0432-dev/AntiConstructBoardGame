import { hasCredential } from "./training";
import { hasFeature } from "./regions";
import { getOffice, getPerson, people } from "../data";
import type { ProvinceId } from "../types";
import type { Capability, Condition, V2Game, Work } from "./model";

export type SpecialistKind =
  | "mediation"
  | "survey"
  | "standards"
  | "cooperation"
  | "tax"
  | "logistics";
export interface PersonTrait {
  id: string;
  title: string;
  kind: SpecialistKind;
  /** The named rule effect, rather than an interchangeable numerical bonus. */
  mechanic: string;
  offices: string[];
  provinces?: ProvinceId[];
  capability?: Capability;
  description: string;
  cost?: { treasury?: number; capital?: number; stock?: number };
}
const trait = (
  id: string,
  title: string,
  kind: SpecialistKind,
  mechanic: string,
  offices: string[],
  description: string,
  extra: Partial<PersonTrait> = {},
): PersonTrait => ({
  id,
  title,
  kind,
  mechanic,
  offices,
  description,
  ...extra,
});
export const personTraits: PersonTrait[] = [
  trait(
    "lin",
    "精密调度",
    "standards",
    "industrial-compatibility",
    ["plan"],
    "计划委以工业设备清单建立兼容标准；专职工业改造获得专业施工进度。",
    { capability: "industry", cost: { treasury: 1 } },
  ),
  trait(
    "lu",
    "防线通行证",
    "logistics",
    "defense-permit",
    ["defense", "gov-north"],
    "基本国防预算允许签发防线应急通行证；本人离岗或被抽调后快速反应资格失效。",
    { capability: "rapid" },
  ),
  trait(
    "sergei",
    "密封档案整理",
    "survey",
    "sealed-archive",
    ["anomaly", "defense", "local"],
    "持密封档案登记本地异常，压低当前异常风险；高级封印仍受保密政策与实际职位限制。",
    { capability: "seal", cost: { treasury: 1 } },
  ),
  trait(
    "zhou",
    "地方调停签名",
    "mediation",
    "local-mediation",
    ["plan", "local"],
    "协商政策下恢复地方信任，缓解在任地方负责人积怨，获得可追溯的调停签名。",
    { capability: "joint", cost: { capital: 1 } },
  ),
  trait(
    "bai",
    "宗门地师",
    "survey",
    "ley-geography",
    ["anomaly", "gov-south"],
    "勘定南岭灵脉并登记资源；具备收益协议和宗门合作后，可以接替能源工程技术职责。",
    { provinces: ["south"], capability: "leywork", cost: { stock: 1 } },
  ),
  trait(
    "ye",
    "跨省承诺物流",
    "logistics",
    "promised-transport",
    ["local"],
    "在协商与合作条件下，将工业省两份实物护送至本省，并消耗一份运输物资；保留原有承诺网络。",
    { capability: "transport", cost: { capital: 1 } },
  ),
  trait(
    "xing",
    "公开救援协作",
    "cooperation",
    "public-rescue",
    ["plan", "local"],
    "公开且未被压制的群众组织恢复信任并建立地方收益与救援协约，不能在封锁信息时发动。",
    { capability: "mobilize", cost: { treasury: 1 } },
  ),
  trait(
    "mo",
    "符阵工程勘定",
    "survey",
    "ley-engineering",
    ["plan", "gov-south"],
    "勘定南岭灵脉工程条件，形成兼容符阵技术记录；保留原有宗门工程师能力。",
    { provinces: ["south"], capability: "leywork", cost: { stock: 1 } },
  ),
  trait(
    "qi",
    "异常档案校验",
    "survey",
    "risk-index",
    ["anomaly", "defense", "local"],
    "从异常记录发现风险，降低本地异常压力并登记预警资格；完成校验后可在保密体系参与封印。",
    { capability: "seal" },
  ),
  trait(
    "han",
    "军工设备标准",
    "standards",
    "defense-equipment",
    ["plan", "defense"],
    "以两份工业库存建立设备标准和防线预留，须维持国防预算；专职军工改造加快施工。",
    { provinces: ["industry"], capability: "industry", cost: { stock: 2 } },
  ),
  trait(
    "tang",
    "合作社组织",
    "cooperation",
    "cooperative-charter",
    ["plan", "local"],
    "协商与地方信任允许建立收益协约、资源登记和合作渠道；本人在岗可为合作项目提供组织资格。",
    { capability: "joint", cost: { treasury: 1 } },
  ),
  trait(
    "wen",
    "税种分类",
    "tax",
    "tax-classification",
    ["plan", "local"],
    "登记本地产业税种；主持有限稽核时避免误征造成的信任损失，税款仍按同一账本分配。",
  ),
  trait(
    "linruoxu",
    "灵能接口",
    "standards",
    "energy-interface",
    ["plan", "anomaly"],
    "档案与灵脉调查齐备时建立能源兼容接口；专职电网建设加快进度，中央技术职位因此暂时失去实际工作能力。",
    { provinces: ["south"], capability: "leywork", cost: { treasury: 1 } },
  ),
  trait(
    "chenjiliang",
    "账外账",
    "tax",
    "off-book-audit",
    ["plan", "local"],
    "一次产业登记揭示地方既有财政控制；有限稽核整顿延长一回合，同时留下政治争议记录。",
    { cost: { capital: 1 } },
  ),
  trait(
    "shenyue",
    "贸易税源分类",
    "tax",
    "commercial-register",
    ["plan", "local"],
    "市场政策和已调查航路允许登记商业活动，开放贸易合作；不能将本地资金直接当作中央收入。",
  ),
  trait(
    "guhe",
    "轨距兼容校验",
    "standards",
    "rail-compatibility",
    ["plan", "local"],
    "地方拥有收益权才可校验轨距并开放路线调查；专职铁路施工加快进度。",
    { capability: "industry", cost: { treasury: 1 } },
  ),
  trait(
    "suyi",
    "公开救援",
    "cooperation",
    "magical-relief",
    ["defense", "local"],
    "群众信任与公开政策允许缓解当地灾害并签发救援许可；受压制的组织不能使用该能力。",
    { capability: "mobilize", cost: { stock: 1 } },
  ),
  trait(
    "taoqi",
    "魔法公开教习",
    "cooperation",
    "mobilization-training",
    ["plan", "local"],
    "在公开、合作与当地信任下，用两份实物培养救援组织；合格在岗干部取得受训动员资格。",
    { capability: "mobilize", cost: { treasury: 1, stock: 2 } },
  ),
  trait(
    "luchaosheng",
    "港务航线",
    "logistics",
    "port-navigation",
    ["plan", "local"],
    "地方收益权和信任允许登记贸易航线，缓解供给压力；专职港口项目加快施工。",
    { capability: "transport", cost: { treasury: 1 } },
  ),
  trait(
    "yanxingzhou",
    "江湖通行",
    "logistics",
    "informal-caravan",
    ["local", "defense"],
    "必须本人参与、保留合作与协商制度；以一份护送损耗运送两份工业物资，未建铁路也可执行这一次私人承诺。",
    { capability: "transport", cost: { capital: 1 } },
  ),
  trait(
    "yunsong",
    "宗门传承",
    "survey",
    "ley-training",
    ["anomaly", "gov-south"],
    "宗门收益协约、合作渠道与三份南岭实物支持工程传承；受训的合格生产干部可担任灵脉工程负责人。",
    {
      provinces: ["south"],
      capability: "leywork",
      cost: { treasury: 1, stock: 3 },
    },
  ),
  trait(
    "wangshu",
    "群众见证公报",
    "mediation",
    "public-accountability",
    ["plan", "local"],
    "公开政策下登记地方财政与工程公报，恢复信任并建立协商见证；封锁制度无法获得群众背书。",
    { capability: "joint" },
  ),
  trait(
    "hejing",
    "边防工兵补给",
    "logistics",
    "border-supply",
    ["defense", "gov-north"],
    "国防预算与北境授权下运送工业物资，形成防线应急预留；护送损耗真实扣除工业库存。",
    { provinces: ["north"], capability: "rapid" },
  ),
  trait(
    "xuzhao",
    "异常收容传习",
    "survey",
    "containment-training",
    ["anomaly", "defense"],
    "档案与异常预算支持收容教习；受训异常干部仍须在合法职位、保密政策与工作可用条件下参与高级收容。",
    { capability: "seal", cost: { treasury: 1, stock: 2 } },
  ),
];

const byId = new Map(personTraits.map((t) => [t.id, t]));
export const traitFor = (id: string | null | undefined) =>
  id ? byId.get(id) : undefined;
const condition = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
/** Primary and secondary appointments are read from the one game state. */
export function heldOffices(g: V2Game, id: string) {
  const secondaries = g.machine.secondaryAppointments || {};
  return [
    ...new Set(
      [...Object.keys(g.core.appointments), ...Object.keys(secondaries)].filter(
        (office) => (g.core.appointments[office] || secondaries[office]) === id,
      ),
    ),
  ];
}
const activeWork = (g: V2Game, id: string, except?: string) =>
  g.machine.works.find(
    (w) =>
      w.worker === id &&
      w.id !== except &&
      !w.completed &&
      !w.paused &&
      !w.cancelled,
  );
const available = (g: V2Game, id: string) =>
  heldOffices(g, id).length > 0 &&
  (g.core.grievances[id] || 0) < 3 &&
  !g.machine.occupied[id] &&
  activeWork(g, id)?.assignment !== "dedicated";
const officeFits = (g: V2Game, id: string, t: PersonTrait, pid?: ProvinceId) =>
  heldOffices(g, id).some(
    (office) =>
      t.offices.includes(office) ||
      (t.offices.includes("local") &&
        office.startsWith("gov-") &&
        (!pid || office === `gov-${pid}`)),
  );
export function personMechanics(g: V2Game, id: string, pid?: ProvinceId) {
  const descriptor = traitFor(id);
  const offices = heldOffices(g, id);
  const project = activeWork(g, id);
  const reasons: string[] = [];
  if (!offices.length) reasons.push("尚无正式职位；可先任命或专职派遣工程");
  if (descriptor && !officeFits(g, id, descriptor, pid))
    reasons.push(
      `该特征需要${descriptor.offices.map((o) => (o === "local" ? "目标省政府" : getOffice(o)?.short || o)).join("或")}职位`,
    );
  if (project?.assignment === "dedicated")
    reasons.push("专职项目派遣中，原职位的行政能力暂时不可用");
  if (g.machine.occupied[id]) reasons.push("本回合已被即时任务占用");
  if ((g.core.grievances[id] || 0) >= 3)
    reasons.push("积怨达到3，拒绝实际履职");
  if (pid && descriptor?.provinces && !descriptor.provinces.includes(pid))
    reasons.push("该项个人关系只适用于指定省份");
  return {
    trait: descriptor,
    person: getPerson(id),
    offices,
    office: offices[0],
    project,
    available: available(g, id),
    eligible: !!descriptor && reasons.length === 0,
    reasons,
    description: descriptor?.description || "",
  };
}

export function specialistPreview(g: V2Game, id: string, pid: ProvinceId) {
  const t = traitFor(id),
    m = g.machine,
    s = g.core;
  const province = s.provinces.find((p) => p.id === pid);
  const mechanics = personMechanics(g, id, pid);
  const conditions: Condition[] = [
    condition(
      "有效人物与地区",
      !!t && !!getPerson(id) && !!province,
      "选择已登记的人物与省份",
    ),
    condition(
      "个人特征所需职位",
      !!t && officeFits(g, id, t, pid),
      mechanics.reasons.join("；") || "本人须在实际适用职位上",
    ),
    condition(
      "实际工作能力",
      available(g, id),
      "不能专职派遣、被本回合任务占用或积怨拒绝履职",
    ),
    condition(
      "具体地方关系",
      !t?.provinces || t.provinces.includes(pid),
      "个人联系只对所列地区生效",
    ),
    condition(
      "尚未履行这项个人承诺",
      !m.milestones.includes(`person:${id}:${pid}`),
      "每个人对同一省的特殊安排只能登记一次；已取得的制度和能力持续生效",
    ),
  ];
  const add = (label: string, met: boolean, reason: string) =>
    conditions.push(condition(label, met, reason));
  if (["zhou", "tang", "ye", "yanxingzhou", "yunsong"].includes(id))
    add(
      "协商制度",
      s.policies.method === 1,
      "先采用协商政策，私人关系不能替代强制行政授权",
    );
  if (["xing", "suyi", "taoqi", "wangshu"].includes(id)) {
    add(
      "公开政策与可信群众组织",
      s.policies.disclosure !== 0 && !m.suppressed[pid] && m.trust[pid] > 0,
      "保密封锁、群众组织被压制或当地信任归零时无法发动",
    );
    if (["taoqi", "wangshu"].includes(id))
      add(
        "正式公开政策",
        s.policies.disclosure === 1,
        "教习与公报须以正式公开政策为依据",
      );
  }
  if (["lu", "han", "hejing"].includes(id))
    add(
      "实际国防预算",
      m.departmentBudgets.defense > 0,
      "国防预算为0时无法调用军工和防线组织",
    );
  if (["sergei", "qi", "xuzhao", "linruoxu"].includes(id))
    add(
      "实际异常预算",
      m.departmentBudgets.anomaly > 0,
      "恢复异常部门基本预算后才能整理专业档案",
    );
  if (["lin", "guhe", "wen", "chenjiliang", "shenyue", "linruoxu"].includes(id))
    add(
      "实际计划调度预算",
      m.departmentBudgets.plan > 0,
      "计划部门预算为0时不能执行财政与技术协调",
    );
  if (["ye", "yanxingzhou", "taoqi", "yunsong"].includes(id))
    add(
      "合作承诺网络",
      m.cooperation && m.trust[pid] > 0 && !m.suppressed[pid],
      "须保有合作渠道、当地信任和可用的地方组织",
    );
  if (["tang", "zhou"].includes(id))
    add(
      "地方沟通对象",
      !!s.appointments[`gov-${pid}`] && m.trust[pid] > 0,
      "须有在任地方负责人且当地仍有基本信任",
    );
  if (["guhe", "luchaosheng", "yunsong"].includes(id))
    add(
      "地方收益协议",
      !!m.rights[pid] && m.trust[pid] >= 2,
      "先确认地方收益权，不能用个人特征绕过地方管理权限",
    );
  if (id === "linruoxu")
    add(
      "灵脉调查与技术档案",
      m.surveyed && m.knowledge,
      "先完成灵脉调查并持有异常技术档案",
    );
  if (id === "xuzhao")
    add(
      "密封档案与保密制度",
      m.knowledge && s.policies.disclosure !== 1,
      "公开政策不允许以秘密档案培训高级收容",
    );
  if (id === "shenyue") {
    add("市场政策", s.policies.economy === 1, "商业税源登记需要市场制度");
    add(
      "已调查交通路线",
      (m.discoveries[pid] || []).includes("routes"),
      "先调查当地航路，避免将未知贸易活动当作税源",
    );
  }
  if (["ye", "yanxingzhou", "hejing"].includes(id)) {
    add(
      "实际跨省护送",
      pid !== "industry",
      "从工业省护送到另一省，不能凭空往返制造物资",
    );
    add(
      "工业省库存与非隔离路线",
      (s.provinces.find((p) => p.id === "industry")?.stock || 0) >= 3 &&
        !m.matters.some(
          (x) => ["industry", pid].includes(x.province) && x.isolated,
        ),
      "工业省须有3实物，2运往目标省、1为护送损耗；被隔离地区禁止通行",
    );
  }
  const costs = {
    commands: 1,
    treasury: t?.cost?.treasury || 0,
    capital: t?.cost?.capital || 0,
    stock: t?.cost?.stock || 0,
    province: pid,
  };
  return {
    trait: t,
    title: `${getPerson(id)?.name || "未登记人物"} · ${t?.title || "未知特征"}`,
    conditions,
    costs,
    actors: t ? [id] : [],
    institutions: mechanics.offices,
    effects: t
      ? [
          t.description,
          "履行后本人本回合占用；同一人物、同一省份的特殊承诺不能重复领取",
        ]
      : [],
  };
}

export function eligibleSpecialists(
  g: V2Game,
  kind: SpecialistKind,
  pid?: ProvinceId,
  actors?: string[],
) {
  return people
    .filter((p) => {
      const t = traitFor(p.id);
      if (!t || t.kind !== kind || (actors && !actors.includes(p.id)))
        return false;
      if (pid)
        return specialistPreview(g, p.id, pid).conditions.every((c) => c.met);
      return available(g, p.id) && officeFits(g, p.id, t);
    })
    .map((p) => p.id);
}

const remember = (g: V2Game, marker: string) => {
  if (!g.machine.milestones.includes(marker)) g.machine.milestones.push(marker);
};
/** Cost payment, history recording and command locking belong to the engine. */
export function applySpecialistSkill(
  g: V2Game,
  id: string,
  pid: ProvinceId,
  source: string,
): string[] {
  const preview = specialistPreview(g, id, pid);
  if (preview.conditions.some((c) => !c.met))
    throw new Error(
      preview.conditions
        .filter((c) => !c.met)
        .map((c) => c.reason)
        .join("；"),
    );
  const m = g.machine,
    s = g.core,
    p = s.provinces.find((p) => p.id === pid)!;
  const effects: string[] = [];
  const discover = (field: string) => {
    m.discoveries[pid] ||= [];
    if (!m.discoveries[pid].includes(field)) m.discoveries[pid].push(field);
    m.origins[`discovery:${pid}:${field}`] = source;
    effects.push(
      `${p.name}登记${field === "resources" ? "资源" : field === "routes" ? "航路" : field === "anomaly" ? "异常风险" : field === "tax" ? "产业税种" : field}，可追溯到本人安排`,
    );
  };
  const standards = () => {
    m.standards = true;
    m.origins.standards = source;
    effects.push("建立实际兼容标准，开放标准依赖的建设与运输行动");
  };
  const trust = (n: number) => {
    const old = m.trust[pid];
    m.trust[pid] = Math.min(4, old + n);
    effects.push(`${p.name}信任 ${old}→${m.trust[pid]}`);
  };
  const cooperation = () => {
    m.cooperation = true;
    m.origins.cooperation = source;
    effects.push("合作承诺渠道开放，后续仍受制度与信任限制");
  };
  const rights = () => {
    m.rights[pid] = true;
    m.origins[`rights:${pid}`] = source;
    effects.push(`${p.name}保有收益管理权，允许具备条件的合作融资与工程`);
  };
  const pressure = (domain: "production" | "social" | "anomaly", n: number) => {
    const old = p.pressure[domain];
    p.pressure[domain] = Math.max(0, old - n);
    effects.push(
      `${p.name}${domain === "anomaly" ? "异常" : domain === "production" ? "供给" : "社会"}压力 ${old}→${p.pressure[domain]}`,
    );
  };
  const archive = () => {
    m.knowledge = true;
    m.origins.knowledge = source;
    discover("anomaly");
  };
  const survey = () => {
    m.surveyed = true;
    m.origins.surveyed = source;
    discover("resources");
  };
  const transport = () => {
    const from = s.provinces.find((p) => p.id === "industry")!;
    from.stock -= 3;
    p.stock += 2;
    discover("routes");
    effects.push("工业省实物-3，目标省实物+2，护送损耗1；没有创造财政收入");
  };
  const train = (cap: "leywork" | "mobilize" | "seal") => {
    remember(g, `training:${cap}`);
    m.origins[`training:${cap}`] = source;
    effects.push(
      `建立${cap === "leywork" ? "灵脉工程" : cap === "mobilize" ? "群众救援" : "异常收容"}传承；受训继任者必须保有合法职位和政策条件`,
    );
  };
  switch (id) {
    case "lin":
      standards();
      discover("equipment");
      break;
    case "lu":
      m.permit = true;
      m.origins.permit = source;
      remember(g, "defense-permit");
      effects.push("签发防线应急通行证，快速反应须本人仍在合法职位");
      break;
    case "sergei":
      archive();
      pressure("anomaly", 1);
      remember(g, `sealed-archive:${pid}`);
      break;
    case "zhou": {
      trust(1);
      const local = s.appointments[`gov-${pid}`];
      if (local) {
        s.grievances[local] = Math.max(0, (s.grievances[local] || 0) - 1);
        effects.push("在任地方负责人积怨-1");
      }
      remember(g, `mediation:${pid}`);
      break;
    }
    case "bai":
      survey();
      pressure("anomaly", 1);
      remember(g, "ley-geography");
      break;
    case "ye":
      transport();
      trust(1);
      remember(g, `promised-route:${pid}`);
      break;
    case "xing":
      trust(2);
      rights();
      remember(g, `rescue-charter:${pid}`);
      break;
    case "mo":
      survey();
      discover("ley-interface");
      remember(g, "ley-engineering");
      break;
    case "qi":
      archive();
      pressure("anomaly", 2);
      remember(g, `risk-index:${pid}`);
      break;
    case "han":
      standards();
      m.reserve = true;
      m.origins.reserve = source;
      discover("defense-equipment");
      effects.push("工业设备实际预留给防线，开放防御方案");
      break;
    case "tang":
      rights();
      cooperation();
      discover("resources");
      remember(g, `cooperative-charter:${pid}`);
      break;
    case "wen":
      discover("tax");
      remember(g, `tax-classification:${pid}`);
      break;
    case "linruoxu":
      standards();
      discover("ley-interface");
      remember(g, "energy-interface");
      break;
    case "chenjiliang":
      discover("tax");
      remember(g, `off-book-audit:${pid}`);
      p.pressure.social++;
      {
        const local = s.appointments[`gov-${pid}`];
        if (local && local !== id)
          s.grievances[local] = (s.grievances[local] || 0) + 1;
      }
      effects.push(
        "地方财政控制被揭示：社会压力+1，其他在任地方负责人积怨+1；并非直接取得额外收入",
      );
      break;
    case "shenyue":
      discover("tax");
      cooperation();
      remember(g, `commercial-register:${pid}`);
      break;
    case "guhe":
      standards();
      discover("routes");
      remember(g, `rail-compatibility:${pid}`);
      break;
    case "suyi":
      trust(1);
      pressure("anomaly", 1);
      m.permit = true;
      m.origins.permit = source;
      remember(g, `public-relief:${pid}`);
      effects.push("救援许可开放");
      break;
    case "taoqi":
      train("mobilize");
      trust(1);
      break;
    case "luchaosheng":
      discover("routes");
      pressure("production", 1);
      remember(g, `port-navigation:${pid}`);
      break;
    case "yanxingzhou":
      transport();
      remember(g, `private-caravan:${pid}`);
      m.origins[`caravan:${pid}`] = source;
      break;
    case "yunsong":
      train("leywork");
      survey();
      break;
    case "wangshu":
      trust(1);
      cooperation();
      discover("public-accounts");
      remember(g, `public-accountability:${pid}`);
      break;
    case "hejing":
      transport();
      m.reserve = true;
      m.origins.reserve = source;
      remember(g, "border-supply");
      effects.push("建立北境真实防线物资预留");
      break;
    case "xuzhao":
      train("seal");
      archive();
      break;
  }
  remember(g, `person:${id}:${pid}`);
  m.origins[`personSkill:${id}:${pid}`] = source;
  m.occupied[id] = source;
  return effects;
}

export function workSpeedBonus(g: V2Game, w: Work) {
  if (
    !w.worker ||
    w.completed ||
    w.cancelled ||
    w.paused ||
    (g.core.grievances[w.worker] || 0) >= 3 ||
    g.machine.occupied[w.worker] ||
    activeWork(g, w.worker, w.id)
  )
    return 0;
  const type = w.type as string,
    id = w.worker;
  const proper =
    w.assignment === "dedicated" ||
    heldOffices(g, id).some((o) => o === "plan" || o === `gov-${w.province}`);
  if (!proper || g.machine.departmentBudgets.plan === 0) return 0;
  if (
    ["lin", "han"].includes(id) &&
    type === "factory" &&
    w.assignment === "dedicated" &&
    g.machine.standards
  )
    return 1;
  if (
    id === "linruoxu" &&
    ["energy", "grid"].includes(type) &&
    w.assignment === "dedicated" &&
    g.machine.standards &&
    g.machine.knowledge
  )
    return 1;
  if (
    id === "guhe" &&
    type === "rail" &&
    w.assignment === "dedicated" &&
    g.machine.standards
  )
    return 1;
  if (
    id === "luchaosheng" &&
    type === "port" &&
    w.assignment === "dedicated" &&
    g.machine.rights[w.province] &&
    (g.machine.discoveries[w.province] || []).includes("routes")
  )
    return 1;
  if (
    id === "hejing" &&
    type === "warning" &&
    w.assignment === "dedicated" &&
    g.machine.departmentBudgets.defense > 0
  )
    return 1;
  if (
    id === "tang" &&
    type === "cooperative" &&
    g.machine.cooperation &&
    g.core.policies.method === 1 &&
    g.machine.trust[w.province] >= 2
  )
    return 1;
  if (
    ["taoqi", "yunsong", "xuzhao"].includes(id) &&
    type === "academy" &&
    w.assignment === "dedicated" &&
    g.machine.cooperation
  )
    return 1;
  return 0;
}
export function auditTrait(g: V2Game, officer: string | null | undefined) {
  const id = officer || "",
    ready = available(g, id);
  const classification = ready && id === "wen";
  const extended = ready && id === "chenjiliang";
  const commerce = ready && id === "shenyue" && g.core.policies.economy === 1;
  return {
    title: traitFor(id)?.title || "常规有限稽核",
    classification,
    bonusDuration: extended ? 1 : 0,
    trustCost: classification || commerce ? 0 : 1,
    exposesControl: extended,
    commerce,
  };
}

export function projectCandidate(
  g: V2Game,
  id: string,
  type: string,
  pid: ProvinceId,
) {
  const p = getPerson(id);
  if (!p || (g.core.grievances[id] || 0) >= 3 || g.machine.occupied[id])
    return false;
  if (!["energy", "grid"].includes(type)) return true;
  if (
    !hasFeature(g, pid, "leyline") ||
    !(g.machine.surveyed || g.machine.discoveries[pid].includes("resources"))
  )
    return false;
  if (id === "mo") return true;
  if (id === "bai")
    return (
      g.machine.cooperation &&
      g.machine.rights[pid] &&
      g.machine.trust[pid] >= 2
    );
  if (id === "linruoxu") return g.machine.standards && g.machine.knowledge;
  return (
    hasCredential(g, id, "leywork") &&
    p.skills.production >= 2 &&
    p.skills.anomaly >= 2 &&
    g.machine.cooperation &&
    g.machine.rights[pid]
  );
}

/** Qualified substitutes retain all office, occupation, policy and geography limits. */
export function specialistCapability(
  g: V2Game,
  cap: Capability,
  pid?: ProvinceId,
  actors?: string[],
) {
  return people
    .filter((p) => {
      if (!available(g, p.id) || (actors && !actors.includes(p.id)))
        return false;
      const t = traitFor(p.id),
        offices = heldOffices(g, p.id),
        m = g.machine,
        policies = g.core.policies;
      if (
        !t ||
        (!officeFits(g, p.id, t, pid) &&
          !(
            ["leywork", "seal", "mobilize"].includes(cap) &&
            hasCredential(g, p.id, cap as "leywork" | "seal" | "mobilize")
          ))
      )
        return false;
      const local = pid || "south";
      const professional = offices.some((o) => {
        const domains = getOffice(o)?.domains || [];
        return cap === "leywork"
          ? domains.includes("anomaly") || domains.includes("production")
          : domains.includes(
              cap === "seal"
                ? "anomaly"
                : cap === "industry"
                  ? "production"
                  : "social",
            );
      });
      if (!professional) return false;
      if (cap === "leywork")
        return (
          projectCandidate(g, p.id, "energy", local) &&
          ["plan", "anomaly", `gov-${local}`].some((o) => offices.includes(o))
        );
      if (cap === "seal")
        return (
          m.knowledge &&
          m.departmentBudgets.anomaly > 0 &&
          policies.disclosure !== 1 &&
          (p.id === "sergei" ||
            (p.id === "qi" &&
              (m.discoveries[local] || []).includes("anomaly")) ||
            (hasCredential(g, p.id, "seal") && p.skills.anomaly >= 2))
        );
      if (cap === "mobilize")
        return (
          policies.disclosure !== 0 &&
          !m.suppressed[local] &&
          m.trust[local] > 0 &&
          (["xing", "suyi"].includes(p.id) ||
            (hasCredential(g, p.id, "mobilize") && p.skills.social >= 2))
        );
      if (cap === "industry")
        return (
          m.standards &&
          m.departmentBudgets.plan > 0 &&
          ((p.id === "lin" && offices.includes("plan")) ||
            (["han", "guhe"].includes(p.id) &&
              (offices.includes("plan") ||
                (p.id === "han" && offices.includes("defense")))))
        );
      if (cap === "transport")
        return (
          m.cooperation &&
          policies.method === 1 &&
          m.trust[local] > 0 &&
          !m.suppressed[local] &&
          (["ye", "yanxingzhou"].includes(p.id) ||
            (p.id === "luchaosheng" &&
              m.rights[local] &&
              m.standards &&
              (m.discoveries[local] || []).includes("routes")))
        );
      if (cap === "rapid")
        return (
          ["lu", "hejing"].includes(p.id) &&
          m.departmentBudgets.defense > 0 &&
          m.permit &&
          (offices.includes("defense") || offices.includes("gov-north"))
        );
      if (cap === "joint")
        return (
          ["zhou", "tang", "wangshu"].includes(p.id) &&
          policies.method === 1 &&
          m.cooperation &&
          m.trust[local] > 0 &&
          !m.suppressed[local] &&
          (p.id !== "wangshu" || policies.disclosure === 1)
        );
      return false;
    })
    .map((p) => p.id);
}
