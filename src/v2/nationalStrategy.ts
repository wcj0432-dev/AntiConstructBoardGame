import type { ProvinceId } from "../types";
import type { Action, Condition, Goal, V2Game, V2Preview, Work } from "./model";
import { assignmentsFor, officePerson } from "./personnel";
import { facilityOperating } from "./operations";
import { workFunding } from "./fiscal";
import { specialistCapability } from "./traits";

export const realmIds: ProvinceId[] = ["industry", "south", "north"];
export const branchCatalog: Record<
  Goal,
  {
    central: { name: string; effect: string };
    plural: { name: string; effect: string };
  }
> = {
  spark: {
    central: {
      name: "中央统一能源体系",
      effect: "新电网须中央出资；终局中央承担能源维护，并保留可用计划调度。",
    },
    plural: {
      name: "地方与宗门联合能源",
      effect:
        "新电网由地方、央地、多省或宗门投资；终局维持原产权、地方收益权和合作。",
    },
  },
  accord: {
    central: {
      name: "全国统一制度",
      effect:
        "以全国异常行政接口与共同标准统一规则；集中接口失效会影响全国验收。",
    },
    plural: {
      name: "多元自治协商",
      effect:
        "三省收益权和实际财政协议维持协商；代表失职或协议失效会阻断验收。",
    },
  },
  night: {
    central: {
      name: "秘密收容体系",
      effect: "维持秘密政策、档案和全国异常主责；公开会使这一分支的防线失效。",
    },
    plural: {
      name: "公开联合防灾",
      effect:
        "维持信息公开、三省疏散接口和群众专业；秘密封印不能代替公开防灾组织。",
    },
  },
  traffic: {
    central: {
      name: "国家标准运输网",
      effect: "新铁路须中央投资，现有铁路也须中央承担维护；计划调度须可履职。",
    },
    plural: {
      name: "多文明复合交通",
      effect:
        "新铁路允许地方联合融资；验收须江湖/浮空物流专家及沿线财政协议，不能仅有铁路图纸。",
    },
  },
  learning: {
    central: {
      name: "国家专业学院",
      effect:
        "新学院须中央投资；验收检查学院维护由中央承担，且有实际学院毕业记录。",
    },
    plural: {
      name: "地方知识传承协作",
      effect:
        "新学院须地方或联合投资；验收要求基层传承和各学院所在地的财政、收益协议。",
    },
  },
  prosperity: {
    central: {
      name: "全国计划财政",
      effect:
        "只可采用中央集税；仍须垂直组织、地方公共支付能力与持续真实结算。",
    },
    plural: {
      name: "地方产业自主",
      effect:
        "可采用共享或地方自留税；须三省实际财政协议与地方产业，中央不能自动动用地方钱。",
    },
  },
  codex: {
    central: {
      name: "统一行政法域",
      effect:
        "三省登记真实运营合同；全国异常主责与中央审批有效时，登记电网可依法维修，但不能征收产权。",
    },
    plural: {
      name: "多元契约法域",
      effect:
        "登记须地方签约与收益权；有效登记可代替重复临时维修授权，仍须本省主管及合作。",
    },
  },
  comms: {
    central: {
      name: "中央广播指挥网",
      effect:
        "工业省为枢纽；中央阻塞或枢纽停运会中断全部远程指令，集中调度不占地方主管。",
    },
    plural: {
      name: "分布式文明中继",
      effect:
        "各节点独立，地方协议和主管决定本地通讯；中央阻塞和其他省节点故障不切断本省授权。",
    },
  },
};
const c = (
  label: string,
  met: boolean,
  reason: string,
  source?: string,
): Condition => ({ label, met, reason, source });
const officer = (g: V2Game, office: string) => {
  const id = officePerson(g, office);
  return !!id && assignmentsFor(g, id).adminAvailable;
};
export function contractSignature(g: V2Game, w: Work) {
  const f = workFunding(g, w);
  return JSON.stringify({
    mode: f.mode,
    owner: f.owner,
    shares: f.shares,
    beneficiary: f.beneficiary ?? null,
  });
}
export function validLawRecord(g: V2Game, pid: ProvinceId, operating = true) {
  return g.machine.strategy?.legalRecords.find(
    (r) =>
      r.province === pid &&
      g.machine.works.some(
        (w) =>
          w.id === r.work &&
          (operating
            ? facilityOperating(g, w)
            : w.completed &&
              !w.cancelled &&
              (w.maintenance?.arrears ?? 0) === 0) &&
          contractSignature(g, w) === r.signature,
      ),
  );
}
export function lawAuthority(g: V2Game, w: Work) {
  const m = g.machine;
  if (
    !m.rights[w.province] ||
    !m.fiscal?.agreements.includes(w.province) ||
    !officer(g, `gov-${w.province}`)
  )
    return false;
  if (
    m.goal !== "codex" ||
    !m.strategy?.branch ||
    !validLawRecord(g, w.province, false) ||
    !m.strategy.legalRecords.some(
      (r) => r.work === w.id && r.signature === contractSignature(g, w),
    )
  )
    return false;
  return m.strategy.branch === "central"
    ? officer(g, "plan") &&
        m.departmentBudgets.plan > 0 &&
        m.regime === "vertical" &&
        g.core.paralysis < 2 &&
        m.departments.anomaly.includes(w.province)
    : officer(g, `gov-${w.province}`) &&
        m.cooperation &&
        m.rights[w.province] &&
        m.trust[w.province] >= 2 &&
        !!m.fiscal?.agreements.includes(w.province) &&
        g.core.policies.method === 1;
}
export function communicationConditions(
  g: V2Game,
  pid: ProvinceId,
): Condition[] {
  const m = g.machine,
    b = m.strategy?.branch;
  const relay = (p: ProvinceId) =>
    m.works.some(
      (w) => w.type === "relay" && w.province === p && facilityOperating(g, w),
    );
  const out = [
    c(
      "已确立通讯协议",
      m.goal === "comms" && !m.goalPending && !!b,
      "先在寰宇通讯计划选择集中或分布式协议",
    ),
    c(
      "当地中继站运营",
      relay(pid),
      "完成当地中继并实际维护；隔离或欠付使该节点离线",
    ),
  ];
  if (b === "central")
    out.push(
      c(
        "中央指挥与枢纽",
        officer(g, "plan") &&
          m.departmentBudgets.plan > 0 &&
          g.core.paralysis < 2 &&
          relay("industry"),
        "工业省枢纽、计划主管和调度预算须有效；中央阻塞2即单点失联",
      ),
    );
  else
    out.push(
      c(
        "地方签约与自治通讯",
        officer(g, `gov-${pid}`) &&
          m.cooperation &&
          m.rights[pid] &&
          m.trust[pid] > 0 &&
          !!m.fiscal?.agreements.includes(pid) &&
          g.core.policies.method === 1,
        "本省主管、收益权、财政协议、合作与协商有效；不依赖中央审批",
      ),
    );
  return out;
}
export const communicationReady = (g: V2Game, pid: ProvinceId) =>
  communicationConditions(g, pid).every((x) => x.met);
export function strategicMilestones(g: V2Game, goal: Goal): Condition[] {
  const m = g.machine,
    b = m.strategy?.branch,
    active = goal === m.goal;
  if (goal === "codex")
    return [
      c("法律发展方向已确立", active && !!b, "召开会议并选择统一或多元法域"),
      c(
        "三省真实合同登记",
        realmIds.every((pid) => !!validLawRecord(g, pid)),
        "每省登记一座实际运营设施；合同变更、停运或欠付须重新核验",
      ),
      c(
        "财政与签约主体仍有效",
        realmIds.every(
          (pid) =>
            officer(g, `gov-${pid}`) &&
            !!m.fiscal?.agreements.includes(pid) &&
            m.rights[pid] &&
            m.trust[pid] > 0,
        ),
        "三省政府可履职，保留财政协议与实际收益权",
      ),
      c(
        "法域执行能力",
        b === "central"
          ? m.regime === "vertical" &&
              g.core.paralysis < 2 &&
              officer(g, "plan") &&
              m.departmentBudgets.plan > 0 &&
              realmIds.every((pid) => m.departments.anomaly.includes(pid))
          : b === "plural" &&
              m.cooperation &&
              g.core.policies.method === 1 &&
              realmIds.every((pid) => m.trust[pid] >= 2),
        "统一法域须全国异常行政接口、垂直审批；多元法域须合作协商与各省信任2",
      ),
    ];
  if (goal === "comms")
    return [
      c("通讯协议已确立", active && !!b, "选择集中或分布式指挥协议"),
      c(
        "三省实际通讯节点",
        realmIds.every((pid) =>
          m.works.some(
            (w) =>
              w.type === "relay" &&
              w.province === pid &&
              facilityOperating(g, w),
          ),
        ),
        "三省完成并支付维护的通讯中继站",
      ),
      c(
        "真实事务指令传达",
        new Set(m.strategy?.dispatches.map((d) => d.matter)).size >= 2,
        "对两个不同真实事务传达授权，不能重复刷同一事务",
      ),
      c(
        "全国网络当前可用",
        realmIds.every((pid) => communicationReady(g, pid)),
        "验收重新检查节点、枢纽或地方协议、当前负责人和中央阻塞",
      ),
    ];
  if (!active || !b) return [];
  const works = m.works.filter((w) => facilityOperating(g, w));
  const centralUpkeep = (w: Work) =>
    (w.maintenanceSponsor ??
      (workFunding(g, w).mode === "central" ? "central" : null)) === "central";
  let met = false,
    reason = "";
  if (goal === "spark") {
    const energy = works.filter((w) => ["grid", "energy"].includes(w.type));
    met =
      energy.length > 0 &&
      (b === "central"
        ? energy.every(centralUpkeep) && officer(g, "plan")
        : energy.some((w) => workFunding(g, w).owner !== "central") &&
          m.cooperation &&
          m.rights.south);
    reason =
      b === "central"
        ? "所有运营能源设施由中央承担维护；计划主管可履职"
        : "至少一项能源设施保留地方/宗门/联合产权，合作及南岭收益权有效";
  }
  if (goal === "accord") {
    met =
      b === "central"
        ? m.standards &&
          realmIds.every((pid) => m.departments.anomaly.includes(pid))
        : realmIds.every(
            (pid) => m.rights[pid] && !!m.fiscal?.agreements.includes(pid),
          );
    reason =
      b === "central"
        ? "共同技术标准与全国异常行政接口真实生效"
        : "三省收益权与财政协定均有效";
  }
  if (goal === "night") {
    met =
      b === "central"
        ? g.core.policies.disclosure === 0 &&
          m.knowledge &&
          realmIds.every((pid) => m.departments.anomaly.includes(pid))
        : g.core.policies.disclosure === 1 &&
          realmIds.every((pid) => m.departments.evacuation.includes(pid)) &&
          specialistCapability(g, "mobilize", "north").length > 0;
    reason =
      b === "central"
        ? "保密、档案及全国异常主责均有效"
        : "公开、三省地方疏散接口及北境可用群众专业均有效";
  }
  if (goal === "traffic") {
    const rails = works.filter((w) => w.type === "rail");
    met =
      b === "central"
        ? rails.length > 0 && rails.every(centralUpkeep) && officer(g, "plan")
        : rails.length > 0 &&
          rails.some((w) =>
            [w.province, w.to!].some(
              (pid) => specialistCapability(g, "transport", pid).length > 0,
            ),
          ) &&
          [...new Set(rails.flatMap((w) => [w.province, w.to!]))].every(
            (pid) => !!m.fiscal?.agreements.includes(pid),
          );
    reason =
      b === "central"
        ? "运营铁路由中央维护，计划主管可履职"
        : "实际物流专家可履职，铁路两端已有财政协定";
  }
  if (goal === "learning") {
    const schools = works.filter((w) => w.type === "academy");
    met =
      b === "central"
        ? schools.length >= 2 &&
          schools.every(centralUpkeep) &&
          !!m.trainings?.some(
            (t) => t.method === "academy" && t.state === "completed",
          )
        : !!m.trainings?.some(
            (t) => t.method === "field" && t.state === "completed",
          ) &&
          schools.every((w) => !!m.fiscal?.agreements.includes(w.province));
    reason =
      b === "central"
        ? "两座学院由中央维护并有具体学院毕业记录"
        : "至少一项具体基层教习完成，学院所在地财政协议有效";
  }
  if (goal === "prosperity") {
    met =
      b === "central"
        ? m.fiscal?.taxSystem === "central" && m.regime === "vertical"
        : m.fiscal?.taxSystem !== "central" &&
          realmIds.every((pid) => !!m.fiscal?.agreements.includes(pid));
    reason =
      b === "central"
        ? "中央集税与垂直组织实际配套"
        : "非中央集税，三省财政协议真实有效";
  }
  return [
    c(
      `战略分支：${branchCatalog[goal][b].name}`,
      met,
      reason,
      m.strategy?.source,
    ),
  ];
}
export function strategyActionConditions(g: V2Game, a: Action): Condition[] {
  const m = g.machine,
    b = m.strategy?.branch;
  if (!b) return [];
  if (a.type === "fiscalReform" && m.goal === "prosperity")
    return [
      c(
        "财政战略的税源安排",
        b === "central" ? a.system === "central" : a.system !== "central",
        "主要战略已确定；中央计划须集税，地方发展须共享或自留",
      ),
    ];
  if (a.type !== "project") return [];
  const relevant =
    (m.goal === "spark" && a.project === "grid") ||
    (m.goal === "traffic" && a.project === "rail") ||
    (m.goal === "learning" && a.project === "academy");
  return relevant
    ? [
        c(
          "战略确定的融资路径",
          b === "central"
            ? (a.funding ?? "central") === "central"
            : (a.funding ?? "central") !== "central",
          `${branchCatalog[m.goal][b].name}：${b === "central" ? "新建骨干设施由中央融资" : "新建骨干设施由地方、央地、多省或宗门融资"}；普通其他建设保留`,
        ),
      ]
    : [];
}
export type StrategyAction = Extract<
  Action,
  { type: "strategyBranch" | "lawRegister" | "dispatch" }
>;
export const isStrategyAction = (a: Action): a is StrategyAction =>
  ["strategyBranch", "lawRegister", "dispatch"].includes(a.type);
export function strategyPreview(
  g: V2Game,
  a: StrategyAction,
): Partial<V2Preview> {
  const m = g.machine,
    conditions: Condition[] = [],
    actors: string[] = [],
    costs = { commands: 1, treasury: 0, capital: 0, stock: 0 };
  let title = "",
    effects: string[] = [];
  if (a.type === "strategyBranch") {
    title = `确立战略分支：${branchCatalog[m.goal][a.branch]?.name ?? "无效方向"}`;
    costs.capital = 1;
    conditions.push(
      c(
        "正式国家战略",
        !m.goalPending && ["national", "experimental"].includes(m.mode),
        "先在正式战役召开国家发展规划会议",
      ),
      c("终局尚未完成", !m.finalDone, "终局已通过后不能再追认另一种战略能力"),
      c(
        "本任期尚未选择分支",
        !m.strategy?.branch,
        "分支互斥，不可同时获得两个方向的制度能力",
      ),
      c(
        "合法战略方向",
        ["central", "plural"].includes(a.branch),
        "选择现有分支",
      ),
    );
    effects = [
      branchCatalog[m.goal][a.branch]?.effect ?? "",
      "保留既有设施和合同，不凭空转移产权；以后行动和终局实时核验这一制度路径。",
    ];
  } else if (a.type === "lawRegister") {
    title = "登记设施产权与履约契约";
    costs.treasury = 1;
    const w = m.works.find((w) => w.id === a.work && w.province === a.province);
    conditions.push(
      c(
        "已确立法域",
        m.goal === "codex" && !m.goalPending && !!m.strategy?.branch,
        "先确立万象法典及法域分支",
      ),
      c(
        "真实履约设施",
        !!w && facilityOperating(g, w),
        "登记本省实际运营且无维护欠付的设施",
      ),
      c(
        "签约主体和财政渠道",
        officer(g, "plan") &&
          officer(g, `gov-${a.province}`) &&
          m.departmentBudgets.plan > 0 &&
          m.rights[a.province] &&
          !!m.fiscal?.agreements.includes(a.province),
        "计划委、本省主管须能履职，地方收益权与财政协议须已建立",
      ),
      c(
        "合同需要核验",
        !w ||
          !m.strategy?.legalRecords.some(
            (r) =>
              r.province === a.province &&
              r.work === w.id &&
              r.signature === contractSignature(g, w),
          ),
        "相同合同已登记；合同更改后才可重新登记",
      ),
    );
    actors.push(
      ...[officePerson(g, "plan"), officePerson(g, `gov-${a.province}`)].filter(
        (x): x is string => !!x,
      ),
    );
    effects = [
      "记录真实出资份额、产权、收益端点和登记来源；不创造设施、不豁免债务、不没收产权。",
      "有效法域可依法执行已登记电网的维修；维护欠付或签约主体失效时不能绕过原规则。",
    ];
  } else {
    const matter = m.matters.find((x) => x.id === a.matter);
    title = "通过国家通讯网传达事务指令";
    conditions.push(
      c(
        "真实待办事务",
        !!matter && matter.kind !== "final",
        "选择当前实际事务；终局仪式不能作为通讯记录",
      ),
      c(
        "同一事务未重复登记",
        !m.strategy?.dispatches.some((d) => d.matter === a.matter),
        "每件事务只计一次实绩，不可刷记录",
      ),
    );
    if (matter) {
      conditions.push(...communicationConditions(g, matter.province));
      const lead =
        m.strategy?.branch === "central" ? "anomaly" : `gov-${matter.province}`;
      conditions.push(
        c(
          "指挥者可用",
          officer(g, lead) &&
            (lead !== "anomaly" || m.departmentBudgets.anomaly > 0),
          "恢复实际指挥职位及部门预算",
        ),
      );
      const id = officePerson(g, lead);
      if (id) actors.push(id);
    }
    effects = [
      "写入本事务本回合的真实联合授权；随后仍须使用原事务方案、资格、专业与资源进行处置。",
      "不自动解决危机，不授予紧急军事权。指令本身不抽调处置人员，避免同回合无法执行。",
    ];
  }
  return {
    title,
    conditions,
    costs,
    actors,
    institutions: ["plan"],
    effects,
    parents: [m.strategy?.source ?? ""].filter(Boolean),
  };
}
export function applyStrategy(g: V2Game, a: StrategyAction, source: string) {
  const m = g.machine;
  m.strategy ??= { legalRecords: [], dispatches: [] };
  if (a.type === "strategyBranch") {
    m.strategy.branch = a.branch;
    m.strategy.source = source;
    m.strategy.chosenAt = g.core.turn;
  } else if (a.type === "lawRegister") {
    const w = m.works.find((w) => w.id === a.work)!;
    m.strategy.legalRecords = m.strategy.legalRecords.filter(
      (r) => r.province !== a.province,
    );
    m.strategy.legalRecords.push({
      province: a.province,
      work: w.id,
      signature: contractSignature(g, w),
      source,
      turn: g.core.turn,
    });
  } else {
    const matter = m.matters.find((x) => x.id === a.matter)!;
    const lead =
      m.strategy.branch === "central" ? "anomaly" : `gov-${matter.province}`;
    m.authorization[matter.id] = {
      lead,
      joint: true,
      emergency: false,
      expires: g.core.turn,
      source,
    };
    m.strategy.dispatches.push({
      matter: matter.id,
      province: matter.province,
      source,
      turn: g.core.turn,
    });
  }
}
export function strategyEpilogue(g: V2Game) {
  const m = g.machine,
    b = m.strategy?.branch;
  return b
    ? `国家路径：${branchCatalog[m.goal][b].name}。${branchCatalog[m.goal][b].effect} 最终登记${m.strategy!.legalRecords.length}份真实合同，传达${m.strategy!.dispatches.length}件事务指令；已完成的建设仍需下一届政府维护。`
    : "未选择附加战略分支；按原有国家目标验收，保留历史路径。";
}
