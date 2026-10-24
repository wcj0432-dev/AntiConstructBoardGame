import type { Capability, Goal, Matter, Plan, Regime } from "./model";
export const regimes: Record<
  Regime,
  { name: string; gain: string; loss: string }
> = {
  vertical: {
    name: "中央垂直领导",
    gain: "中央专家可跨省调动；解锁全国级高级封印。",
    loss: "地方动员必须获中央批准；中央阻塞≥2时审批停止。",
  },
  devolved: {
    name: "地方分权管理",
    gain: "省政府无需中央批准即可本地应急和独立工程。",
    loss: "中央专家不能自动参加地方事务；跨省行动需专门协议。",
  },
  joint: {
    name: "中央—地方联合委员会",
    gain: "共享专家与地方资源；解锁联合疏散—封印行动。",
    loss: "重大行动需双方路线一致或明确妥协；每季度维护费1财政。",
  },
};
export const goals: Record<
  Goal,
  { name: string; description: string; finale: string }
> = {
  codex: {
    name: "万象法典",
    description: "让文明间的产权、财政责任与紧急授权成为真正可执行的法律。",
    finale: "全国契约与行政法域联合审议",
  },
  comms: {
    name: "寰宇通讯计划",
    description:
      "建设能真实传递命令的中继网，在统一指挥与分布式韧性间作出选择。",
    finale: "全国通讯与预警网络联试",
  },
  spark: {
    name: "星火计划",
    description: "把钢铁工业和宗门灵脉接入同一个能源网络。",
    finale: "全国能源网络点火仪式",
  },
  accord: {
    name: "诸界协约",
    description: "建立可以长期合作、并尊重不同文明权利的治理机制。",
    finale: "诸界协约签署大会",
  },
  night: {
    name: "长夜防线",
    description: "用预警、秘密知识与跨省协同抵御全国异常灾害。",
    finale: "全国级异常防线总动员",
  },
  traffic: {
    name: "万里通途",
    description: "让铁路、浮空港与跨文明运输在同一套可执行的规则下联通。",
    finale: "跨文明运输体系联运验收",
  },
  learning: {
    name: "百年树人",
    description: "把关键人物的知识变成学院、专业训练与可以接班的国家能力。",
    finale: "全国专业教育与传承体系验收",
  },
  prosperity: {
    name: "富国新政",
    description: "协调中央税源、地方产业与公共支出，建立持续运转的财政体系。",
    finale: "全国财政与产业制度审议",
  },
};
export const capNames: Record<Capability, string> = {
  mobilize: "群众动员",
  seal: "高级异常封印",
  leywork: "宗门灵脉工程",
  industry: "大规模工业生产",
  transport: "跨省运输",
  rapid: "地方快速应急",
  joint: "联合疏散—封印",
};
export const coreAbilities: Record<
  string,
  { name: string; condition: string; limit: string }
> = {
  xing: {
    name: "群众的信任",
    condition: "合法参与公开救援、当地组织未被压制；不需要保密封锁。",
    limit: "连续动员积累疲劳；第二次动员后群众要求地方自主权。",
  },
  sergei: {
    name: "第十三号密封档案",
    condition: "异常局合法参与，保密路线，已取得档案情报。",
    limit: "公开政策下封印失效；秘密封印留下地方不信任。",
  },
  mo: {
    name: "百年大计",
    condition: "灵脉已勘探；可在南岭/计划委顾问兼任，或从经济面板专职派遣。",
    limit:
      "同一人仅一个活动项目；顾问可被行政事务抽调，专职暂停行政能力；竣工释放工作占用。",
  },
  lin: {
    name: "统一标准化",
    condition: "计划委任职且工业/灵能兼容标准已建立。",
    limit: "必须保留运输调配权限；宗门可要求保留收益所有权。",
  },
  lu: {
    name: "边境封锁",
    condition: "国安委任职、地方或中央合法应急指挥。",
    limit: "以隔离地区换取其他省安全；当地生产停止，群众组织受压制。",
  },
  ye: {
    name: "江湖承诺网",
    condition: "叶冬任省政府负责人，协商路线且双方保留地方资源权。",
    limit: "私人承诺能搭建跨省协议，但强制征调会使该网络失效。",
  },
};
const plan = (
  id: string,
  title: string,
  description: string,
  command: number,
  treasury: number,
  stock: number,
  scope: Plan["scope"],
  effect: Plan["effect"],
  cap?: Capability,
  disclosure?: 0 | 1,
): Plan => ({
  id,
  title,
  description,
  command,
  treasury,
  stock,
  scope,
  effect,
  cap,
  disclosure,
});
export function plansFor(m: Matter, goal: Goal): Plan[] {
  if (m.kind === "energyFault" || m.kind === "fiscalClaim") return [];
  if (m.kind === "warning")
    return [
      plan(
        "public-check",
        "群众参与预防巡检",
        "以群众的信任组织公开巡检；可比较普通检修和特殊能力路径。",
        1,
        0,
        0,
        "local",
        "repair",
        "mobilize",
        1,
      ),
      plan(
        "repair",
        "省级预防检修",
        "本地快速应急，降低事故初始阶段；保留提前改革窗口。",
        1,
        1,
        1,
        "local",
        "repair",
        "rapid",
      ),
      plan(
        "observe",
        "记录异常频谱",
        "交由异常局收集情报；不消除下一回合事故。",
        1,
        0,
        0,
        "local",
        "archive",
      ),
    ];
  if (m.kind === "accident" || m.kind === "oldgod")
    return [
      plan(
        "public",
        "公开群众救援",
        "发动群众，撤离居民并遏制危机；保留能源供应和自治矛盾。",
        1,
        1,
        1,
        "local",
        "public",
        "mobilize",
        1,
      ),
      plan(
        "seal",
        "第十三号高级封印",
        "秘密知识直接消除异常源；地方将要求解释秘密处置。",
        1,
        1,
        1,
        m.kind === "oldgod" ? "national" : "local",
        "seal",
        "seal",
        0,
      ),
      plan(
        "joint",
        "联合疏散—封印",
        "群众救援与封印同步推进；须联合体制、双方批准及公开有限技术信息的妥协。",
        2,
        2,
        1,
        "joint",
        "seal",
        "joint",
        1,
      ),
      plan(
        "contain",
        "地方临时遏制",
        "快速应急让阶段暂缓一回合；危机继续留在地图上。",
        1,
        0,
        1,
        "local",
        "contain",
        "rapid",
      ),
      plan(
        "evacuate",
        "撤离与应急配给",
        "保护人口并缓解当季恶化，异常源仍存在。",
        1,
        1,
        0,
        "local",
        "evacuate",
        "rapid",
        1,
      ),
      plan(
        "isolate",
        "封锁并承担局部损失",
        "建立边境隔离区：其他省受保护，本省停止产出且群众组织受压制。",
        1,
        0,
        0,
        "local",
        "isolate",
        undefined,
        0,
      ),
    ];
  if (m.kind === "supply")
    return [
      plan(
        "transport",
        "跨省保供",
        "使用统一运输调配权；向南岭征调物资，必须响应具体收益要求。",
        1,
        1,
        2,
        "national",
        "supply",
        "transport",
      ),
      plan(
        "priority",
        "保障民生、暂缓工业",
        "保护居民但损失工业产出；允许先管理后修复。",
        1,
        0,
        0,
        "local",
        "evacuate",
        "rapid",
        1,
      ),
    ];
  if (m.kind === "distrust")
    return [
      plan(
        "rights",
        "签署资源收益协约",
        "承认资源收益保留权，恢复信任并建立合作渠道。",
        1,
        1,
        0,
        "local",
        "ownership",
        undefined,
        1,
      ),
      plan(
        "force",
        "保密封锁舆情",
        "必须有正式紧急权限；关闭当地群众动员，留下制度性隐患。",
        1,
        0,
        0,
        "local",
        "suppress",
        undefined,
        0,
      ),
    ];
  if (m.kind === "gazette") {
    const id = m.variant;
    if (id === "flying")
      return [
        plan(
          "standard",
          "设立飞剑—铁路标准委员会",
          "建立兼容标准并解锁运输整合，新增永久维护费1。",
          1,
          2,
          0,
          "local",
          "standard",
        ),
        plan(
          "rights",
          "允许宗门自行申报",
          "保留收益权和自治，仍需以后解决标准兼容。",
          1,
          0,
          0,
          "local",
          "ownership",
        ),
      ];
    if (id === "magic")
      return [
        plan(
          "rights",
          "承认魔法少女救援社团",
          "群众组织恢复信任并取得自治承诺。",
          1,
          1,
          0,
          "local",
          "ownership",
          undefined,
          1,
        ),
        plan(
          "suppress",
          "强制改编为秘密支队",
          "有紧急权才可执行，今后不能在当地发动群众救援。",
          1,
          0,
          0,
          "local",
          "suppress",
          undefined,
          0,
        ),
      ];
    if (id === "dream")
      return [
        plan(
          "archive",
          "给旧神梦境档案编制索引",
          "取得封印所需情报；异常活动风险 +1。",
          1,
          1,
          0,
          "local",
          "archive",
          undefined,
          0,
        ),
        plan(
          "permit",
          "公开有限技术资料",
          "允许委员会公开救援与封印合作，地方获知部分信息。",
          1,
          1,
          0,
          "local",
          "permit",
          undefined,
          1,
        ),
      ];
    if (id === "sword")
      return [
        plan(
          "cooperate",
          "登记江湖跨省承诺网",
          "双方保留资源收益权时才能持续履行跨省私人协作。",
          1,
          1,
          0,
          "local",
          "cooperate",
        ),
        plan(
          "reserve",
          "建立正式运输应急通道",
          "用中央机构替代私人网络；要求建立兼容标准。",
          1,
          2,
          0,
          "local",
          "reserve",
          "industry",
        ),
      ];
    return [
      plan(
        "cooperate",
        "让联合委员会取得正式席位",
        "开启长期跨组织合作；需要中央和地方都保有实际参与者。",
        1,
        1,
        0,
        "local",
        "cooperate",
      ),
      plan(
        "rights",
        "保留地方代表独立表决",
        "本省自治和资源收益权得到承认。",
        1,
        0,
        0,
        "local",
        "ownership",
      ),
    ];
  }
  if (m.kind === "opportunity")
    return [
      plan(
        "invest",
        "启动宗门灵脉工程",
        "以在职顾问模式开工；也可从经济面板专职派遣空闲工程师。完工产生收益和异常风险。",
        1,
        2,
        1,
        "local",
        "invest",
        "leywork",
      ),
      plan(
        "archive",
        "开展风险调研",
        "获得情报，放弃本次工程机会，不撤回揭牌异常压力。",
        1,
        0,
        0,
        "local",
        "archive",
      ),
    ];
  return [
    plan(
      "activate",
      goals[goal].finale,
      "检验里程碑、当前负责人和制度能否实际合作；通用资源不能代替组织条件。",
      2,
      1,
      0,
      "national",
      "activate",
    ),
  ];
}
export const gazettes = [
  {
    id: "flying",
    title: "关于飞剑运输量纳入铁路统计的通知",
    text: "计划委坚持“一剑一车次”。宗门质疑：一把飞剑带三百年修为，算不算超载？标准决定未来能否跨省调度。",
  },
  {
    id: "magic",
    title: "魔法少女联盟拒绝将变身时间计入加班",
    text: "救援社团要求独立组织身份，安全机关要求秘密编制。编制选择将改变群众动员资格。",
  },
  {
    id: "dream",
    title: "旧神梦境档案馆申请夜班津贴",
    text: "保密档案需要整理；公开有限技术资料也可以让委员会联合行动，而不是把秘密能力直接兑换成费用。",
  },
  {
    id: "sword",
    title: "江湖快递要求以君子一诺代替公章",
    text: "省际私人承诺很快，但它依赖地方收益权；强制征调会让这条网络真正失效。",
  },
  {
    id: "meeting",
    title: "跨文明会议席位与茶杯规格联席会议",
    text: "宗门代表的茶杯占地九平方米。是否让地方组织拥有真正的联合审批席位？",
  },
];

export const strategyDetails: Record<
  Goal,
  {
    direction: string;
    beneficiaries: string;
    resistance: string;
    needs: string;
  }
> = {
  codex: {
    direction: "三省真实设施合同登记、财政协议、现行法域和履约审议",
    beneficiaries: "实际产权人、地方政府与中央合同执行机关",
    resistance: "统一法域依赖中央审批；多元法域依赖各省代表、收益权和财政协议",
    needs:
      "为三省各一座运营设施登记真实产权合同；保持制度与签约方可履职，终局重新验证合同与欠付",
  },
  comms: {
    direction: "三省通讯中继站、实际指令传送、危机预警与网络联试",
    beneficiaries: "中央调度、地方应急和跨地区技术人员",
    resistance:
      "集中网依赖工业省枢纽和中央审批；分布网依赖地方协议并逐站承担维护",
    needs:
      "三个实际运营的中继站、两次针对真实事务的指令传达，及当前可用的全国网络",
  },
  spark: {
    direction: "南岭灵脉勘探与能源施工、工业兼容标准、跨省运输",
    beneficiaries: "计划委员会、修仙工程师、工业与南岭能源部门",
    resistance:
      "地方收益权被征调、墨玄调离或被抽调会中断工程；标准产生长期维护费",
    needs:
      "林铸负责工业标准；墨玄在计划委或南岭连续施工；真实运输授权与宗门收益协约",
  },
  accord: {
    direction: "疏散权下放或联合体制、跨文明合作渠道、地方代表与信任",
    beneficiaries: "省政府、魔法少女救援社团、地方文明代表",
    resistance:
      "委员会路线否决与维护费、紧急强制损害信任、负责人积怨达到3时拒绝协办",
    needs: "中央与三省负责人实际在任；合作协议有效；事故经过真实授权或改革处理",
  },
  night: {
    direction: "三省预警站、合法高级异常处置、跨省应急体系",
    beneficiaries: "异常事务局、安全机构与各省应急组织",
    resistance:
      "秘密处置留下说明诉求，公开路线影响秘密封印；地方分权须建立跨省协议",
    needs: "谢尔盖与密封档案或具备妥协的联合处置；预警站全部竣工；北境得到管理",
  },
  traffic: {
    direction: "实际连接两省的铁路、沿线营业港口、灵能供电及跨文明联运",
    beneficiaries: "计划委员会、地方商贸组织、江湖物流与符阵工程人员",
    resistance:
      "铁路和港口需要长期维护；地方收益权、运输接口和失控异常都会影响通行",
    needs:
      "兼容标准、覆盖沿线的运输权、可用物流专家；真实铁路、港口与灵能电网完成联通",
  },
  learning: {
    direction: "两省学院、两类专业训练、跨组织教学渠道与关键能力继任者",
    beneficiaries: "地方学院、宗门传承组织、救援社团与技术官僚后备人员",
    resistance:
      "专职教学挤占行政和工程工作；保密、宗门权利与地方不信任可能关闭知识交流",
    needs: "学院与电网真实竣工；完成不同专业传承，训练后的继任者仍能实际履职",
  },
  prosperity: {
    direction: "央地税源分配、两类持续营业的产业、地方偿付与连续稳定结算",
    beneficiaries: "中央财政、地方政府、生产企业与跨省贸易网络",
    resistance:
      "征税制度必须与行政组织配合；维护费、地方违约和失去合作会削弱税基",
    needs:
      "可执行的税制与灵能电网，两处真实收入设施；至少三次连续稳定结算及地方支付能力",
  },
};
