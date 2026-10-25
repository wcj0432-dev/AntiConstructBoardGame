import { newV2, deserializeV2, serializeV2 } from "./engine";
import { makeFunding, gridOperating } from "./fiscal";
import { workSpecs, workOperating } from "./administration";
import { plannerReady } from "./qualifications";
import { specialistCapability } from "./traits";
import { getPerson } from "../data";
import type { V2Game, WorkType, FundingMode, Condition } from "./model";
/** Disclosed four-turn scenario, not evidence of ordinary starting-resource balance. */
export function startGovernanceTrial() {
  const g = newV2("campaign", "spark", "四次会议与一座电站-v085"),
    m = g.machine;
  g.core.treasury = 32;
  g.core.capital = 8;
  m.fiscal!.locals = { industry: 10, south: 5, north: 10 };
  m.fiscal!.cultTreasury = 6;
  m.matters = [];
  m.backlog = [];
  m.goalPending = false;
  m.cooperation = true;
  m.standards = true;
  m.surveyed = true;
  m.rights = { industry: true, south: true, north: true };
  m.trust = { industry: 3, south: 3, north: 3 };
  m.fiscal!.agreements = ["industry", "south", "north"];
  g.core.policies.method = 1;
  g.core.policies.disclosure = null;
  g.core.appointments["gov-south"] = "mo";
  m.discoveries.industry = ["resources"];
  const source = `decision-${g.core.nextId++}`;
  m.history.unshift({
    id: source,
    turn: 1,
    title: "四次会议与一座电站：场景准备",
    actors: ["lin", "mo"],
    institutions: ["plan", "gov-south"],
    conditions: ["独立四回合验证，不计入标准资源平衡样本"],
    effects: [
      "中央32、三省10/5/10、宗门6、政治资本8；保留原每回合5命令。继承真实南岭学院和工业—北境铁路；林铸专职完成已投资的工业工厂，仍占计划主职。",
      "既有标准、勘探、合作及三省财政协议公开入档。第2回合仍会触发原灵脉事故，第4回合仍有原北境旧神；电网、课程、维护和派系按原引擎处理。",
    ],
    parents: [],
  });
  const inherited = (
    type: WorkType,
    province: "south" | "industry",
    funding: FundingMode,
    completed = true,
  ) => {
    const w = {
      id: `work-${g.core.nextId++}`,
      type,
      province,
      duration: workSpecs[type].duration,
      progress: completed ? workSpecs[type].duration : 1,
      completed,
      paused: false,
      cancelled: false,
      source,
      assignment: "advisor" as const,
      contract: makeFunding(
        g,
        { type: "project", project: type, province, funding },
        source,
      ),
      maintenance: {
        turn: -1,
        fee: workSpecs[type].maintenance,
        due: 0,
        paid: 0,
        arrears: 0,
        payments: [],
        source,
      },
    };
    m.works.push(w);
    return w;
  };
  inherited("academy", "south", "local");
  const rail = inherited("rail", "industry", "central");
  Object.assign(rail, { to: "north" });
  const factory = inherited("factory", "industry", "central", false);
  Object.assign(factory, { worker: "lin", assignment: "dedicated" });
  m.governanceTrial = { id: "four-meetings", source };
  for (const key of ["cooperation", "standards", "surveyed", "regime"])
    m.origins[key] = source;
  for (const pid of ["industry", "south", "north"] as const)
    m.origins[`financeAgreement:${pid}`] = source;
  return deserializeV2(serializeV2(g));
}
export function trialChecks(g: V2Game): Condition[] {
  const c = (label: string, met: boolean, reason: string): Condition => ({
    label,
    met,
    reason,
  });
  return [
    c(
      "南岭—工业电网实际运营",
      g.machine.works.some(
        (w) =>
          w.type === "grid" &&
          w.province === "south" &&
          w.to === "industry" &&
          gridOperating(g, w),
      ),
      "须真实建成、付清维护、保有运营条件；结算后仍复核",
    ),
    c(
      "计划机关实际履职",
      plannerReady(g),
      "主职或合法兼职均可，不能被专职工程或政治拒绝架空",
    ),
    c(
      "工业设备产线可用",
      g.machine.works.some(
        (w) =>
          w.type === "factory" &&
          w.province === "industry" &&
          workOperating(g, w),
      ),
      "继承工厂仍须实际施工与经营条件，不能只看历史产权",
    ),
    c(
      "跨地区防线补给已执行",
      ["rail", "jianghu"].some((route) =>
        g.machine.milestones.includes(`border-supply:${route}`),
      ),
      "真实铁路调度或江湖护送；仅消耗本地库存不等于跨区组织",
    ),
    c(
      "灵脉事故与北境重大事务受管理",
      g.machine.milestones.includes("accident-managed") &&
        g.machine.milestones.includes("north-managed"),
      "沿用原事故、疏散、封印或隔离记录；源头未消灭时结局保留风险说明",
    ),
    c(
      "现有灵脉专业有合法岗位",
      specialistCapability(g, "leywork", "south").length > 0,
      "技术人员或真实毕业的继任者须在可履职的相关正式岗位",
    ),
  ];
}
export function trialReport(g: V2Game) {
  const grid = g.machine.works.find(
    (w) => w.type === "grid" && w.province === "south",
  );
  return `四次会议与一座电站 · 组织检验\n${trialChecks(g)
    .map((c) => `${c.met ? "通过" : "未通过"}：${c.label}`)
    .join(
      "\n",
    )}\n电网实际产权：${grid?.contract?.owner ?? "未形成"}；维护承担：${grid?.maintenanceSponsor ?? "按出资合同"}。\n专业传承：${
    (g.machine.trainings ?? [])
      .filter((t) => t.state === "completed")
      .map((t) => `${getPerson(t.mentor)?.name}→${getPerson(t.student)?.name}`)
      .join("、") || "没有完成具体课程"
  }。\n正式兼职：${
    Object.entries(g.machine.secondaryAppointments ?? {})
      .map(([o, p]) => `${getPerson(p)?.name} / ${o}`)
      .join("、") || "未使用"
  }。\n派系议程：${g.machine.agendas?.items.map((a) => `${a.kind} / ${a.state}`).join("、") || "无"}。\n仍存事务：${g.machine.matters.map((m) => `${m.title}，阶段${m.stage}${m.evacuated ? "，已撤离但未消除源头" : ""}`).join("；") || "无"}。\n场景预算明确独立于正式战役；这不是全难度或真人试玩的平衡结论。`;
}
export const trialBriefs = [
  "第一次会议：林铸仍占计划主任席位，但正在专职完成工厂。可更换负责人、暂停项目、合法兼职或等待竣工。查看行动预览，取消不会扣命令。",
  "第二次会议：灵脉事故与电网筹建争夺命令。选择真实技术负责人及中央/地方/联合融资。计划专项预算可加快进度，但每期成本增加；工程可能引发实际预算议程。",
  "第三次会议：检查南岭学院和施工责任账户，先付维护再施工。若培养继任者，要让课程真正毕业；选择公开解释、补助、维护安排或人员分工。",
  "第四次会议：电网、工厂与组织必须实际运转，才能通过铁路或江湖向北境调配防线设备，同时管理旧神危机。结算后再次检查运营与履职。",
];
