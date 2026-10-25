import { getPerson, offices } from "../data";
import type { ProvinceId } from "../types";
import { milestones, previewAction } from "./engine";
import { nationalForecast, accountLabel } from "./fiscal";
import { conditionEvents } from "./conditionEvents";
import { assignmentsFor, officePerson } from "./personnel";
import { workReadiness, workSpecs } from "./administration";
import { goals } from "./data";
import { strategyEpilogue } from "./nationalStrategy";
import type { Action, V2Game } from "./model";
import { storyFacts, chapterNames } from "./contractStory";
import { agendaTitles, agendaStanding } from "./factionAgendas";
export type AdvisorMode = "full" | "important" | "manual" | "off";
export type AdvisorPanel =
  | "secretary"
  | "finance"
  | "staff"
  | "economy"
  | "local"
  | "matters"
  | "goals"
  | "central"
  | "reform"
  | "history";
export interface AdvisorIssue {
  id: string;
  title: string;
  why: string;
  consequence: string;
  directions: string[];
  priority: number;
  panel: AdvisorPanel;
  province?: ProvinceId;
  person?: string;
  matter?: string;
  source?: string;
  work?: string;
  agenda?: string;
}
export const secretary = {
  id: "shenlan",
  name: "沈岚",
  title: "联邦执政委员会首席秘书",
  background:
    "中央档案与跨文明行政学院出身。信奉“先看签字人，再看宣传语”；她会解释规则，却不替委员长签字。",
};
export const guideTopics: Record<
  string,
  { title: string; body: string; panel: AdvisorPanel }
> = {
  welcome: {
    title: "接任简报",
    body: "委员长，您接手的是一个有三省、六个正式职位的联邦。地图是地方政府和真实设施，不是装饰。每回合行政命令有限；库存是实物，中央与地方资金分账。先调阅一省，处理预警或核对财政都可以。您不必按我推荐的顺序执政。",
    panel: "local",
  },
  staff: {
    title: "职位、人物与任务",
    body: "职位决定权限，人物带来专业。同一个人专职施工时仍可能保留名义职位，却无法主持行政审批。先点组织图中的一个职位，看当前负责人，再比较候选人和真实任命后果。",
    panel: "staff",
  },
  economy: {
    title: "工程的五个签字栏",
    body: "请核对专业负责人、建设出资方、竣工维护方、产权人与收益端点。钱足够也不能替代专业、组织接口和地方权利。顾问可被即时事务抽调；专职施工暂停行政能力。",
    panel: "economy",
  },
  finance: {
    title: "钱在哪个账户",
    body: "地方的钱不能直接支付中央项目。先支付实际账户运作、逐设施维护与施工，再产生经营收入。维护欠付只停相应设施；可回拨资金并补缴，或明确接管维护，不会顺手取得产权。",
    panel: "finance",
  },
  settlement: {
    title: "第一次财政结算",
    body: "这不是预算猜测，下面是刚刚入账的真实流水。下一期预测另行计算；经营收入不能提前支付本期维护。地方结余和中央结余应分别看。",
    panel: "finance",
  },
  goals: {
    title: "国家发展规划",
    body: "八或十二回合任期中，第1回合先认识国情，第2～3回合召开会议。八条国家战略各有两条互斥分支，制度选择影响实际融资、权限和终局。您仍可建设其他领域，分支不会凭空送出设施。我负责说明取舍，最后由您决定。",
    panel: "goals",
  },
  crisis: {
    title: "危机为什么连起来",
    body: "隔离会停产，欠付会停运，失控异常可阻断运输与供能。查看真实事务的源头与沿线设施，再检查负责人、指挥接口和资源；解除一个环节不会自动修复其余问题。",
    panel: "matters",
  },
  maintenance: {
    title: "停电也可能是财务问题",
    body: "委员长，设施按照合同因欠付停止了运行。请看具体责任账户和欠款；补缴恢复履约，技术故障还要另行维修。电力问题有时确实是财务问题。",
    panel: "finance",
  },
  occupation: {
    title: "名义在岗不等于能签字",
    body: "这个职位仍有人，但专职施工、即时事务或拒绝履职都可能令其无法审批。调整工程分工、等待占用释放或合法任命继任者都可考虑；换一张任命书不能创造专业资质。",
    panel: "staff",
  },
};
export function markAdvisorRead(g: V2Game, id: string) {
  const n = structuredClone(g);
  n.machine.advisor ??= { seen: [], cooldowns: {} };
  if (!n.machine.advisor.seen.includes(id)) n.machine.advisor.seen.push(id);
  n.machine.advisor.cooldowns[id] = g.core.turn;
  return n;
}
export function guidanceTopic(
  g: V2Game,
  panel: string | undefined,
  mode: AdvisorMode,
): string | undefined {
  if (
    mode === "manual" ||
    mode === "off" ||
    g.machine.mode === "tutorial" ||
    g.machine.demonstration
  )
    return;
  const seen = g.machine.advisor?.seen ?? [];
  const conditions = conditionEvents(g);
  const urgent = conditions.some((x) => x.id.startsWith("maintenance:"))
    ? "maintenance"
    : g.machine.matters.some((x) => x.stage >= 3)
      ? "crisis"
      : undefined;
  const topic =
    mode === "full"
      ? !seen.includes("welcome")
        ? "welcome"
        : panel === "staff"
          ? "staff"
          : panel === "economy"
            ? "economy"
            : panel === "finance"
              ? "finance"
              : panel === "goals" &&
                  ["national", "experimental"].includes(g.machine.mode)
                ? "goals"
                : g.machine.fiscal!.settlements > 0
                  ? "settlement"
                  : urgent
      : urgent;
  return topic &&
    !seen.includes(topic) &&
    g.core.turn - (g.machine.advisor?.cooldowns[topic] ?? -99) >= 2
    ? topic
    : undefined;
}
export function advisorIssues(g: V2Game): AdvisorIssue[] {
  const m = g.machine,
    issues: AdvisorIssue[] = [],
    f = nationalForecast(g);
  for (const row of f.facilities)
    if (row.maintenance.arrears > 0) {
      const w = m.works.find((w) => w.id === row.work)!;
      if (w && !w.maintenance?.arrears)
        issues.push({
          id: `next:${w.id}`,
          title: `${workSpecs[w.type].name}下一期维护不足`,
          why: row.maintenance.payments
            .filter((p) => p.arrears > 0)
            .map((p) => `${accountLabel(g, p.account)}预计欠付${p.arrears}`)
            .join("；"),
          consequence:
            "相应设施在先付维护后的生产与教学中停止，预测已扣除此收益。",
          directions: [
            "核对实际责任账户并拨款",
            "明确维护接管后补缴；产权不变",
          ],
          priority: 95,
          panel: "finance",
          province: w.province,
          source: w.source,
        });
    }
  for (const row of f.locals)
    if (row.default)
      issues.push({
        id: `local-default:${row.province}`,
        title: `${accountLabel(g, row.province)}下期公共支付不足`,
        why: `地方账户预计结余${row.next}；中央余额不会自动转入。`,
        consequence: "本省日常或维护可能欠付，需核对地方流水及责任。",
        directions: ["核对实际地方支出与税源", "比较拨款、依法上缴及预算安排"],
        priority: 93,
        panel: "finance",
        province: row.province,
      });
  if (f.default)
    issues.push({
      id: "central-default",
      title: "中央下期无法履约",
      why: `实际预测：中央${g.core.treasury} → ${f.next}。固定运作、维护及施工先于收入。`,
      consequence: "连续两次中央违约会结束任期。",
      directions: ["核对中央承诺与出资轮转", "依法上缴或调整未完工预算"],
      priority: 100,
      panel: "finance",
    });
  for (const e of conditionEvents(g))
    issues.push({
      id: e.id,
      title: e.title,
      why: e.description,
      consequence: e.id.startsWith("maintenance:")
        ? "该设施的生产、运输或教学资格实际失效。"
        : "对应资格须恢复后才可执行，既有进度保留。",
      directions:
        e.panel === "staff"
          ? ["查看实际岗位与任务", "协调课程或调整负责人"]
          : ["核对来源与实际条件", "在对应面板比较可行方案"],
      priority: e.urgent ? 98 : 60,
      panel: e.panel,
      province: e.province,
      person: e.person,
      source: e.source,
    });
  for (const w of m.works.filter(
    (w) => !w.completed && !w.cancelled && !w.paused,
  )) {
    const missing = workReadiness(g, w).filter((c) => !c.met);
    if (missing.length)
      issues.push({
        id: `work:${w.id}`,
        title: `${workSpecs[w.type].name}施工受阻`,
        why: missing.map((c) => c.reason).join("；"),
        consequence: `进度${w.progress}/${w.duration}暂不能推进。`,
        directions: [
          "核对负责人当前岗位与即时占用",
          "调整项目派遣或等待人员释放",
        ],
        priority: 75,
        panel: "economy",
        province: w.province,
        source: w.source,
      });
  }
  for (const o of offices) {
    const id = officePerson(g, o.id);
    if (!id || !assignmentsFor(g, id).adminAvailable)
      issues.push({
        id: `office:${o.id}`,
        title: `${o.name}${id ? "暂不能履职" : "空缺"}`,
        why: id
          ? `${getPerson(id)?.name}：${assignmentsFor(g, id).restrictions.join("；")}`
          : "无实际主职或正式兼职负责人。",
        consequence: "需要该职位的审批、协调和部分目标无法执行。",
        directions: ["查看组织图和实际占用", "比较候选人及继任者再决定"],
        priority: 70,
        panel: "staff",
        person: id ?? undefined,
      });
  }
  for (const matter of m.matters.filter(
    (x) =>
      x.stage >= 2 && ["accident", "oldgod", "energyFault"].includes(x.kind),
  ))
    issues.push({
      id: `matter:${matter.id}`,
      title: matter.title,
      why: `阶段${matter.stage}，${matter.isolated ? "已隔离" : matter.containment > 0 ? `遏制剩余${matter.containment}期` : "尚未遏制"}；${matter.description}`,
      consequence: matter.isolated
        ? "本省停产，异常源仍在。"
        : matter.containment > 0
          ? "遏制到期后需复核。"
          : "下一期可能恶化，严重状态影响沿线设施。",
      directions: [
        "核对合法方案及实际费用",
        "在处置前比较救援、遏制与专业技术",
      ],
      priority: matter.stage >= 3 ? 99 : 80,
      panel: "matters",
      province: matter.province,
      matter: matter.id,
      source: matter.source,
    });
  if (m.goalPending)
    issues.push({
      id: "planning",
      title: "国家发展规划尚未立项",
      why: `当前第${g.core.turn}回合；第2～3回合可召开会议。`,
      consequence: "第3回合结束前须确立主战略，普通建设继续保留。",
      directions: [
        "比较八路线及两种制度分支",
        "根据现有人员、产权和财政自行决定",
      ],
      priority: g.core.turn >= 3 ? 97 : 45,
      panel: "goals",
    });
  else {
    const checks = milestones(g);
    if (checks.length && checks.every((c) => c.met))
      issues.push({
        id: "goal-ready",
        title: `${goals[m.goal].name}当前条件齐备`,
        why: "统一里程碑判定当前全部满足。",
        consequence:
          "十二回合须第10～11回合演练，终局仍复核状态，当前齐备不是提前胜利。",
        directions: ["查看国家目标与演练入口", "继续维持实际人员、合同和运营"],
        priority: 65,
        panel: "goals",
      });
  }
  for (const story of m.storylines ?? []) {
    const facts = storyFacts(g, story.work);
    if (facts.decisions.length < 3)
      issues.push({
        id: `story:${story.work}`,
        title: `契约议程 · ${chapterNames[facts.decisions.length]}`,
        why:
          facts.issues.join("；") ||
          "先前签字已记录，下一章按当前真实条件办理。",
        consequence: "维护、人才和全国税制的长期选择；可延后，不阻止回合推进。",
        directions: ["打开首席秘书的政治故事页查看条件与选择"],
        priority: 55,
        panel: "secretary",
        province: facts.w?.province,
        source: facts.decisions.at(-1)?.source,
      });
  }
  for (const a of m.agendas?.items ?? [])
    if (a.state === "active")
      issues.push({
        id: `agenda:${a.id}`,
        title: agendaTitles[a.kind],
        why: agendaStanding(g, a).reason,
        consequence: `第${a.deadline}回合结束到期，未处理使${getPerson(a.issuer)?.name}积怨+1。`,
        directions: ["预览实际接受、替代安排、一次延期或拒绝"],
        priority: g.core.turn >= a.deadline ? 93 : 70,
        panel: "secretary",
        province: a.province,
        person: a.issuer,
        work: a.work,
        agenda: a.id,
        source: a.source,
      });
  return issues
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((issue) => {
      const w = m.works.find((w) => issue.id.endsWith(`:${w.id}`));
      return w ? { ...issue, work: w.id } : issue;
    });
}
export function advisorAction(g: V2Game, action: Action) {
  const preview = previewAction(g, action),
    alternatives: Action[] = [];
  if (action.type === "maintain" || action.type === "maintenanceSponsor") {
    const w = g.machine.works.find((w) => w.id === action.work);
    if (w) {
      alternatives.push(
        { type: "maintenanceSponsor", work: w.id, account: "central" },
        { type: "maintenanceSponsor", work: w.id, account: w.province },
      );
      const debt = w.maintenance?.payments.find(
        (x) =>
          x.arrears > 0 && ["industry", "south", "north"].includes(x.account),
      );
      if (debt)
        alternatives.push({
          type: "fiscalTransfer",
          province: debt.account as ProvinceId,
          direction: "grant",
          amount: debt.arrears,
        });
    }
  } else if (action.type === "project" && action.project !== "warning") {
    alternatives.push(
      { ...action, funding: "central" },
      { ...action, funding: "joint" },
    );
  } else if (action.type === "appoint") {
    alternatives.push({
      type: "appoint",
      office: action.office,
      person: officePerson(g, action.office),
    });
  }
  return {
    preview,
    facts: preview.errors.length
      ? preview.errors
      : ["当前预览满足全部执行条件；结算前仍按当前状态复核。"],
    tradeoffs: preview.effects,
    alternatives: alternatives.map((a) => ({
      action: a,
      preview: previewAction(g, a),
    })),
  };
}
export function advisorTurnReport(g: V2Game) {
  const last = g.machine.results
    .filter((r) => r.action.type === "end" && r.status !== "failed")
    .at(-1);
  const turn = last?.turn ?? Math.max(1, g.core.turn - 1);
  const history = g.machine.history
    .filter(
      (h) =>
        h.turn === turn && /竣工|完成|改革|人事|故障|欠付|里程碑/.test(h.title),
    )
    .slice(-4);
  const ledger = g.machine.fiscal?.ledger.filter((e) => e.turn === turn) ?? [];
  return {
    turn,
    changes: history.map((h) => ({
      title: h.title,
      effect: h.effects[0],
      source: h.id,
    })),
    ledger,
    accounts: [
      `中央当前${g.core.treasury}`,
      ...g.core.provinces.map(
        (p) =>
          `${p.name}地方${g.machine.fiscal?.locals[p.id]} / 实物${p.stock}`,
      ),
    ],
    next: advisorIssues(g).slice(0, 3),
    factual: !!last,
  };
}
export function advisorOpening(g: V2Game) {
  return [
    g.machine.opening
      ? `初始政治档案：${g.machine.opening.summary.join(" ")}`
      : `本届接手地方分权的经典联邦；${g.machine.goalPending ? "主要国家战略尚待会议决定。" : ["campaign", "tutorial"].includes(g.machine.mode) ? "当前为四回合紧急状态，不召开国家发展规划会议。" : `当前已立项${goals[g.machine.goal].name}。`}`,
    `实际计划主管：${getPerson(officePerson(g, "plan"))?.name ?? "空缺"}；中央余额${g.core.treasury}，地方资金另记。`,
    ...g.machine.works
      .filter((w) => !w.cancelled)
      .slice(0, 2)
      .map(
        (w) =>
          `历史设施：${workSpecs[w.type].name}，位于${g.core.provinces.find((p) => p.id === w.province)?.name}，真实产权见合同。`,
      ),
  ];
}
export function advisorEpilogue(g: V2Game) {
  return [
    `委员长，这一任期${g.core.status === "won" ? "通过了最后的验收" : g.core.status === "lost" ? "已经结束" : "仍在继续"}。`,
    strategyEpilogue(g),
    ...g.machine.history
      .filter((h) =>
        /工程竣工|专业培养完成|改革生效|体制过渡完成|人事任命/.test(h.title),
      )
      .slice(-5)
      .map((h) => `第${h.turn}回合：${h.title}`),
    `尚有${g.machine.works.filter((w) => (w.maintenance?.arrears ?? 0) > 0).length}座设施欠付、${g.machine.matters.filter((x) => x.kind !== "final").length}项未完事务。`,
    "【人物感想】档案会留下我们的签字。至于后人会不会抱怨文件太多，那是下一届秘书的工作。",
  ];
}
