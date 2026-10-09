import type {
  Domain,
  EventCard,
  FactionId,
  Issue,
  Office,
  Person,
  Province,
  ProvinceId,
} from "./types";
export const domainNames: Record<Domain, string> = {
  production: "生产",
  social: "社会",
  anomaly: "异常",
};
export const issueNames: Record<Issue, [string, string]> = {
  disclosure: ["保密", "公开"],
  authority: ["集权", "自治"],
  economy: ["计划", "市场"],
  method: ["强制", "协商"],
};
export const factionNames: Record<FactionId, string> = {
  technocrat: "技术官僚集团",
  popular: "革命群众派",
  security: "国家安全集团",
};
const person = (
  id: string,
  name: string,
  title: string,
  faction: FactionId,
  skills: [number, number, number],
  stance: [number, number, number, number],
  specialty: Domain,
  ability: string,
): Person => ({
  id,
  name,
  title,
  faction,
  skills: { production: skills[0], social: skills[1], anomaly: skills[2] },
  stance: {
    disclosure: stance[0],
    authority: stance[1],
    economy: stance[2],
    method: stance[3],
  },
  specialty,
  ability,
});
export const people: Person[] = [
  person(
    "lin",
    "林铸",
    "工业规划师",
    "technocrat",
    [3, 1, 0],
    [1, 0, 0, 1],
    "production",
    "精密调度：主持生产事务时能力 +1",
  ),
  person(
    "lu",
    "陆霆",
    "边境指挥官",
    "security",
    [1, 2, 2],
    [0, 0, 0, 0],
    "social",
    "维稳经验：主持社会事务时能力 +1",
  ),
  person(
    "sergei",
    "谢尔盖",
    "旧神研究员",
    "security",
    [1, 1, 3],
    [0, 0, 0, 0],
    "anomaly",
    "隔离协议：主持异常事务时能力 +1",
  ),
  person(
    "zhou",
    "周衡",
    "中央地方干部",
    "technocrat",
    [2, 3, 1],
    [1, 0, 0, 1],
    "social",
    "群众工作：主持社会事务时能力 +1",
  ),
  person(
    "bai",
    "白芷",
    "南岭宗门代表",
    "popular",
    [1, 2, 3],
    [1, 1, 1, 1],
    "anomaly",
    "灵脉感知：主持异常事务时能力 +1",
  ),
  person(
    "ye",
    "叶冬",
    "北境协调员",
    "popular",
    [1, 3, 2],
    [1, 1, 0, 1],
    "social",
    "地方联络：主持社会事务时能力 +1",
  ),
  person(
    "xing",
    "星野澪",
    "魔法少女队长",
    "popular",
    [1, 3, 2],
    [1, 1, 1, 1],
    "social",
    "信任纽带：主持社会事务时能力 +1",
  ),
  person(
    "mo",
    "墨玄",
    "修仙工程师",
    "technocrat",
    [3, 1, 3],
    [0, 1, 0, 1],
    "production",
    "符阵工业：主持生产事务时能力 +1",
  ),
  person(
    "qi",
    "祁雾",
    "异常档案官",
    "security",
    [0, 2, 3],
    [0, 0, 1, 0],
    "anomaly",
    "风险识别：主持异常事务时能力 +1",
  ),
  person(
    "han",
    "韩砺",
    "军工总监",
    "security",
    [3, 1, 1],
    [0, 0, 0, 0],
    "production",
    "军工动员：主持生产事务时能力 +1",
  ),
  person(
    "tang",
    "唐禾",
    "合作社代表",
    "popular",
    [2, 3, 0],
    [1, 1, 1, 1],
    "social",
    "基层动员：主持社会事务时能力 +1",
  ),
  person(
    "wen",
    "温序",
    "跨界经济学者",
    "technocrat",
    [3, 2, 1],
    [1, 0, 1, 1],
    "production",
    "成本审计：主持生产事务时能力 +1",
  ),
];
export const offices: Office[] = [
  {
    id: "plan",
    name: "中央计划委员会",
    short: "计划委",
    domains: ["production", "social"],
  },
  {
    id: "defense",
    name: "国防与安全委员会",
    short: "国安委",
    domains: ["social", "anomaly"],
  },
  {
    id: "anomaly",
    name: "国家异常事务局",
    short: "异常局",
    domains: ["anomaly", "production"],
  },
  {
    id: "gov-industry",
    name: "中央工业省政府",
    short: "工业省政府",
    province: "industry",
    domains: ["production", "social", "anomaly"],
  },
  {
    id: "gov-south",
    name: "南岭修仙省政府",
    short: "南岭省政府",
    province: "south",
    domains: ["production", "social", "anomaly"],
  },
  {
    id: "gov-north",
    name: "北境异常省政府",
    short: "北境省政府",
    province: "north",
    domains: ["production", "social", "anomaly"],
  },
];
export const initialProvinces: Province[] = [
  {
    id: "industry",
    name: "中央工业省",
    subtitle: "钢铁、秩序与永不熄灭的灯",
    districts: [
      { name: "首都区", type: "行政 / 政治", output: 1 },
      { name: "重工业区", type: "财政 / 生产", output: 2 },
    ],
    stock: 6,
    pressure: { production: 0, social: 0, anomaly: 0 },
    autonomy: 0,
  },
  {
    id: "south",
    name: "南岭修仙省",
    subtitle: "灵脉之上，宗门之间",
    districts: [
      { name: "灵脉矿区", type: "灵能 / 资源", output: 2 },
      { name: "山地宗门区", type: "修仙 / 自治", output: 1 },
    ],
    stock: 6,
    pressure: { production: 0, social: 0, anomaly: 0 },
    autonomy: 0,
  },
  {
    id: "north",
    name: "北境异常省",
    subtitle: "联邦的边界，也是现实的边界",
    districts: [
      { name: "边境区", type: "军事 / 国防", output: 1 },
      { name: "旧神自治区", type: "收容 / 特殊资源", output: 2 },
    ],
    stock: 6,
    pressure: { production: 0, social: 0, anomaly: 0 },
    autonomy: 0,
  },
];
const pids: ProvinceId[] = ["south", "industry", "north"];
const domains: Domain[] = ["anomaly", "production", "social"];
const baseTitles = [
  "灵脉电站事故",
  "重工业供给中断",
  "边境撤离争议",
  "宗门税务风波",
  "中央账目失衡",
  "旧神梦境泄漏",
  "南岭运输停摆",
  "首都住房抗议",
  "边境防线误报",
  "三界共振灾难",
  "行政公文死循环",
  "自治区物资紧缺",
];
const chainTitles = [
  "南岭灵能污染",
  "工业区符阵泄漏",
  "北境收容失效",
  "南岭供应停摆",
  "工业欠薪潮",
  "北境物资断供",
  "宗门抗议请愿",
  "首都信任危机",
  "边境避难营",
  "南岭异常谣言",
  "首都梦境扩散",
  "北境应急封锁",
];
const activeTitles = [
  "未经勘探的第七灵脉",
  "跨界轨道试验",
  "旧神图书馆",
  "宗门合作社",
  "自动化铸造厂",
  "魔法少女联络站",
  "新式灵脉矿场",
  "首都公共议事厅",
  "北境监测塔",
  "省级联合议会",
  "资源交易试点",
  "异常档案解密",
];
function crisisCard(
  id: string,
  title: string,
  category: "base" | "chain",
  i: number,
): EventCard {
  const province = pids[i % 3],
    domain = domains[category === "chain" ? Math.floor(i / 3) % 3 : i % 3],
    lead =
      domain === "anomaly"
        ? "anomaly"
        : domain === "production"
          ? "plan"
          : "defense";
  const issue: Issue = (
    ["disclosure", "economy", "method", "authority"] as const
  )[i % 4];
  const optionNames: Record<Issue, [string, string]> = {
    disclosure: ["保密集中处置", "公开协同处置"],
    economy: ["计划配给处置", "市场应急采购"],
    method: ["强制动员处置", "协商联合处置"],
    authority: ["中央集中处置", "授权地方处置"],
  };
  return {
    id,
    title,
    category,
    province,
    district: i % 2,
    domain,
    lead,
    participants: [lead, `gov-${province}`],
    description:
      i === 9 && category === "base"
        ? "三个世界的现实边界同时发生共振。揭开时本省异常压力 +1，并额外翻开3张基础危机；超出每季3张接纳上限的事件公开排队。"
        : i === 10 && category === "base"
          ? "同一份紧急指令在六个机构之间反复转发。揭开时行政阻塞 +1，未处理每季阻塞 +1。阻塞达到2时下季命令减少1；可付费疏通或处理本事务减阻塞2。"
          : i === 0 && category === "base"
            ? "南岭灵脉电站的隔离符阵突然失效。异常局要求封锁现场，省政府坚持公开通报；抢修还需要征调地方库存。每一项技术决定，都将成为政治决定。"
            : `${initialProvinces.find((p) => p.id === province)!.name}报告${domainNames[domain]}秩序出现波动。中央与地方需要共同负责，现有资源与治理路线却无法同时满足所有人的要求。`,
    options: [
      {
        id: "public",
        name: optionNames[issue][1],
        description: `采用${issueNames[issue][1]}路线，投入财政平息局势，争取政治支持。${issue === "authority" ? "当地取得本领域主责及自治特权。" : ""}`,
        issue,
        side: 1,
        commands: 1,
        treasury: 1,
        stock: 2,
        ability: 3,
        effect: {
          crisis: -1,
          capital: 1,
          pressure: { [domain]: -1 },
          ...(issue === "authority" ? { autonomy: 1 } : {}),
          ...(i === 10 && category === "base" ? { paralysis: -2 } : {}),
        },
      },
      {
        id: "secret",
        name: optionNames[issue][0],
        description: `采用${issueNames[issue][0]}路线集中调度；节省财政，但增加社会压力。`,
        issue,
        side: 0,
        commands: 1,
        treasury: 0,
        stock: 2,
        ability: 3,
        effect: {
          crisis: -1,
          pressure:
            domain === "social" ? { social: 0 } : { [domain]: -1, social: 1 },
          ...(i === 10 && category === "base" ? { paralysis: -2 } : {}),
        },
      },
    ],
    consequence: {
      crisis: 1,
      pressure: { [domain]: 1 },
      ...(domain === "production" ? { spread: 1 } : {}),
      ...(i === 10 && category === "base" ? { paralysis: 1 } : {}),
    },
    ...(i === 9 && category === "base"
      ? { reveal: { extra: 3, pressure: { anomaly: 1 } } }
      : {}),
    ...(i === 10 && category === "base" ? { reveal: { paralysis: 1 } } : {}),
  };
}
const activeCards: EventCard[] = activeTitles.map((title, i) => {
  const province = pids[i % 3],
    domain = domains[i % 3],
    lead =
      domain === "anomaly"
        ? "anomaly"
        : domain === "production"
          ? "plan"
          : "defense";
  return {
    id: `active-${i}`,
    title,
    category: "active",
    province,
    district: i % 2,
    domain,
    lead,
    participants: [lead, `gov-${province}`],
    deck: (["survey", "build", "reform"] as const)[Math.floor(i / 4)],
    description:
      "调查揭开了一个尚未开发的机会。它可以改变地区的长期产出，但每一种组织方式都有自己的代价。",
    reveal: { pressure: { [domain]: 1 } },
    consequence: {},
    options: [
      {
        id: "invest",
        name: "中央直接投资",
        description:
          "支付财政建设设施，每回合物资 +2；运行两回合后，每两回合异常压力 +1。",
        issue: "authority",
        side: 0,
        commands: 1,
        treasury: 2,
        stock: 0,
        ability: 2,
        effect: { project: { name: title, output: 2, risk: true } },
      },
      {
        id: "local",
        name: "委托地方经营",
        description:
          "每回合物资 +1，无运行异常风险；地方自治 +1，主责权限让渡给省政府。",
        issue: "authority",
        side: 1,
        commands: 1,
        treasury: 1,
        stock: 0,
        ability: 2,
        effect: {
          project: { name: `地方·${title}`, output: 1, risk: false },
          autonomy: 1,
        },
      },
    ],
  };
});
export const cards: EventCard[] = [
  ...baseTitles.map((t, i) => crisisCard(`base-${i}`, t, "base", i)),
  ...chainTitles.map((t, i) => crisisCard(`chain-${i}`, t, "chain", i)),
  ...activeCards,
];
export const getCard = (id: string) => cards.find((c) => c.id === id)!;
export const getPerson = (id: string | null | undefined) =>
  people.find((p) => p.id === id);
export const getOffice = (id: string) => offices.find((o) => o.id === id)!;
