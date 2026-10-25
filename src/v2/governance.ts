import { getOffice, getPerson, offices } from "../data";
import type { ProvinceId } from "../types";
import type { Action, Condition, V2Game, Work, V2Preview } from "./model";
import { assignmentsFor, officePerson } from "./personnel";
import { traitFor, specialistCapability } from "./traits";
import {
  previewAction,
  executeCommand,
  milestones,
  campaignChecks,
} from "./engine";
import {
  accountLabel,
  fundingLabels,
  workFunding,
  nationalForecast,
  gridOperating,
} from "./fiscal";
import { facilityStatus } from "./operations";
import { workSpecs } from "./administration";
import { networkAuthority } from "./networks";
import { crisisStep } from "./crisisTrack";
export function governanceTargets(g: V2Game) {
  if (g.machine.mode === "campaign" || g.machine.mode === "tutorial")
    return campaignChecks(g);
  return milestones(g);
}
export type BoardTarget = {
  kind:
    | "office"
    | "person"
    | "work"
    | "matter"
    | "finance"
    | "policy"
    | "goal"
    | "history"
    | "secretary"
    | "agenda";
  id?: string;
  province?: ProvinceId;
};
export type StateMark = {
  id: string;
  label: string;
  tone: "good" | "warn" | "bad" | "info";
  reason: string;
};
export function actionMarks(p: V2Preview): StateMark[] {
  const permission = p.conditions.find(
    (c) => !c.met && /授权|事权|权限/.test(c.label),
  );
  return p.errors.length
    ? [
        {
          id: permission ? "permission" : "missing",
          label: permission ? "权限不足" : "当前受阻",
          tone: "bad",
          reason: permission?.reason ?? p.errors.join("；"),
        },
      ]
    : [
        {
          id: "satisfied",
          label: "当前已满足",
          tone: "good",
          reason: "本次实际预览条件满足；消耗命令、预算或调动人物后可能变化",
        },
      ];
}
export function personMarks(g: V2Game, id: string | null): StateMark[] {
  if (!id)
    return [
      {
        id: "vacant",
        label: "职位空缺",
        tone: "bad",
        reason: "任命主职或合法兼职，不能凭空取得资格",
      },
    ];
  const a = assignmentsFor(g, id),
    marks: StateMark[] = [];
  if (!a.mainOffice && !a.secondaryOffices.length)
    marks.push({
      id: "reserve",
      label: "待任职",
      tone: "info",
      reason:
        "目前没有正式行政职位；个人资质与空闲工程能力保留，任命后仍按真实条件检查",
    });
  if (a.adminAvailable)
    marks.push({
      id: "ready",
      label: "可履职",
      tone: "good",
      reason: "已占据正式职位且没有行政占用；每项行动仍检查预算、权限和政策",
    });
  if ((g.core.grievances[id] ?? 0) >= 3)
    marks.push({
      id: "refusal",
      label: "拒绝履职",
      tone: "bad",
      reason: "积怨达到3；先政治和解",
    });
  if (a.activeProject?.assignment === "dedicated")
    marks.push({
      id: "dedicated",
      label: "专职派遣",
      tone: "warn",
      reason: `${workSpecs[a.activeProject.type].name} ${a.activeProject.progress}/${a.activeProject.duration}；名义职位保留，暂停行政履职`,
    });
  if (a.temporaryTask)
    marks.push({
      id: "occupied",
      label: "临时占用",
      tone: "warn",
      reason: a.temporaryTask.title + "；回合结算后释放",
    });
  if (a.secondaryOffices.length)
    marks.push({
      id: "concurrent",
      label: "正式兼职",
      tone: "info",
      reason: a.secondaryOffices.map((o) => getOffice(o).name).join("、"),
    });
  for (const t of g.machine.trainings ?? [])
    if (
      ["active", "paused"].includes(t.state) &&
      (t.student === id || t.mentor === id)
    )
      marks.push({
        id: `course:${t.id}`,
        label: t.student === id ? "正在培训" : "承担教学",
        tone: "info",
        reason: `${t.progress}/${t.duration}；${t.reason}。课程不等于自动失去行政能力，临时抽调可能暂停教学`,
      });
  return marks;
}
export function officeActions(
  g: V2Game,
  office: string,
  province: ProvinceId = "south",
): { id: string; label: string; action: Action }[] {
  const person = officePerson(g, office),
    pid = getOffice(office).province ?? province;
  const actions: { id: string; label: string; action: Action }[] =
    office === "plan"
      ? [
          {
            id: "finance",
            label: "财政拨款",
            action: {
              type: "fiscalTransfer",
              province: pid,
              direction: "grant",
              amount: 2,
            },
          },
          {
            id: "engineering",
            label: "全国电网规划",
            action: {
              type: "project",
              project: "grid",
              province: "south",
              to: "industry",
              worker: "mo",
              assignment: "dedicated",
              funding: "central",
            },
          },
          {
            id: "transport",
            label: "跨省调运",
            action: {
              type: "transfer",
              from: "south",
              to: "industry",
              amount: 1,
            },
          },
        ]
      : office === "anomaly"
        ? [
            {
              id: "investigate",
              label: "档案调查",
              action: { type: "investigate", deck: "archive" },
            },
          ]
        : office === "defense"
          ? [
              {
                id: "budget",
                label: "国防预算",
                action: {
                  type: "budget",
                  department: "defense",
                  level: g.machine.departmentBudgets.defense === 1 ? 2 : 1,
                },
              },
            ]
          : [
              {
                id: "warning",
                label: "本省预警建设",
                action: { type: "project", project: "warning", province: pid },
              },
              {
                id: "agreement",
                label: "恢复地方协约",
                action: { type: "reconcile", province: pid },
              },
            ];
  if (person && traitFor(person))
    actions.push({
      id: "special",
      label: traitFor(person)!.title,
      action: { type: "personSkill", person, province: pid },
    });
  return actions;
}
export function organizationBoard(g: V2Game, province: ProvinceId = "south") {
  return offices.map((o) => {
    const person = officePerson(g, o.id);
    return {
      id: o.id,
      title: o.short,
      person,
      marks: personMarks(g, person),
      special: person ? traitFor(person)?.title : undefined,
      project: person ? assignmentsFor(g, person).activeProject?.id : undefined,
      actions: officeActions(g, o.id, province).map((x) => ({
        ...x,
        preview: previewAction(g, x.action),
      })),
    };
  });
}
export function engineeringCard(
  g: V2Game,
  w: Work,
  plan = nationalForecast(g),
) {
  const contract = workFunding(g, w),
    state = facilityStatus(g, w),
    forecast = plan.facilities.find((f) => f.work === w.id);
  const management =
    contract.owner === "central" ? "plan" : `gov-${w.province}`;
  const maintenance = w.maintenanceSponsor
    ? [{ account: w.maintenanceSponsor, weight: 1 }]
    : contract.shares;
  const payer =
    forecast?.maintenance.payments.map((p) => p.account) ??
    maintenance.map((p) => p.account);
  return {
    id: w.id,
    type: w.type,
    title: workSpecs[w.type].name,
    province: w.province,
    worker: w.worker,
    management,
    owner: contract.owner,
    contract: fundingLabels[contract.mode],
    shares: contract.shares,
    maintenance: maintenance.map((s) => s.account),
    payer,
    beneficiary: w.to ?? contract.beneficiary ?? w.province,
    state,
    progress: `${w.progress}/${w.duration}`,
    arrears: w.maintenance?.arrears ?? 0,
    nextArrears: forecast?.maintenance.arrears ?? 0,
    forecast,
    authority: w.type === "grid" ? networkAuthority(g, w) : undefined,
    marks: [
      {
        id: state.state,
        label: {
          building: "正在执行",
          cancelled: "已撤销",
          maintenance: "维护欠付",
          stopped: "运营受阻",
          operating: "正常运行",
        }[state.state],
        tone: (state.state === "operating"
          ? "good"
          : state.state === "building"
            ? "info"
            : "bad") as StateMark["tone"],
        reason: state.reason,
      },
    ],
  };
}
/** One local chain: only saved, actual links. No arbitrary bonus or inferred national web. */
export function workDependencies(g: V2Game, w: Work) {
  const card = engineeringCard(g, w),
    nodes: {
      id: string;
      label: string;
      fact: string;
      blocked: boolean;
      target: BoardTarget;
    }[] = [];
  nodes.push({
    id: "payer",
    label: "维护责任",
    fact: card.maintenance.map((a) => accountLabel(g, a)).join("、"),
    blocked: card.nextArrears > 0 || card.arrears > 0,
    target: { kind: "finance", province: w.province },
  });
  nodes.push({
    id: "operation",
    label: "设施运营",
    fact: card.state.reason,
    blocked: card.state.state !== "operating",
    target: { kind: "work", id: w.id, province: w.province },
  });
  if (w.type === "grid") {
    const beneficiary = w.to ?? "industry",
      operating = gridOperating(g, w);
    nodes.push({
      id: "supply",
      label: "实际供能",
      fact: `${accountLabel(g, w.province)} → ${accountLabel(g, beneficiary)}；${operating ? "当前供能" : "尚未供能"}`,
      blocked: !operating,
      target: { kind: "finance", province: beneficiary },
    });
    nodes.push({
      id: "tax",
      label: "受益地生产与税源",
      fact: operating
        ? "本条电网按原规则提供+2生产/常规税源；收入按现行税制分配"
        : "本条电网当前不提供额外生产/税源，不把未来收益当已到手资金",
      blocked: !operating,
      target: { kind: "finance", province: beneficiary },
    });
  } else if (w.type === "rail" && w.to)
    nodes.push({
      id: "connection",
      label: "实际线路端点",
      fact: `${accountLabel(g, w.province)} ↔ ${accountLabel(g, w.to)}`,
      blocked: card.state.state !== "operating",
      target: { kind: "finance", province: w.to },
    });
  else if (w.type === "academy")
    nodes.push({
      id: "teaching",
      label: "本省具名教学",
      fact:
        (g.machine.trainings ?? [])
          .filter((t) => t.facility === w.id)
          .map(
            (t) =>
              `${getPerson(t.mentor)?.name}→${getPerson(t.student)?.name} ${t.progress}/${t.duration}`,
          )
          .join("；") || "没有绑定本学院的课程，不凭设施赠送资格",
      blocked: card.state.state !== "operating",
      target: { kind: "person", id: w.worker, province: w.province },
    });
  nodes.push({
    id: "goal",
    label: "当前战略复核",
    fact:
      governanceTargets(g)
        .filter((c) => !c.met)
        .slice(0, 2)
        .map((c) => c.label)
        .join("、") || "当前全部满足；终局仍复核",
    blocked: governanceTargets(g).some((c) => !c.met),
    target: { kind: "goal" },
  });
  return nodes;
}
export function protocolCards(g: V2Game) {
  const m = g.machine,
    rows: {
      id: string;
      title: string;
      scope: string;
      term: string;
      effect: string;
      source?: string;
      target: BoardTarget;
    }[] = [
      {
        id: "regime",
        title: {
          vertical: "中央垂直领导",
          devolved: "地方分权管理",
          joint: "中央—地方联合委员会",
        }[m.regime],
        scope: "全国三省",
        term: "持续有效，直到改革生效",
        effect: "具体主持与批准仍由当前事务预览检查",
        source: m.origins.regime,
        target: { kind: "policy" },
      },
    ];
  if (m.pending)
    rows.push({
      id: "pending",
      title: "尚待生效的体制改革",
      scope: "全国三省",
      term: `第${m.pending.due}回合生效`,
      effect: "现行事权在过渡完成前继续有效",
      source: m.pending.source,
      target: { kind: "policy" },
    });
  for (const p of m.fiscal?.agreements ?? [])
    rows.push({
      id: `fiscal:${p}`,
      title: "地方共同出资协议",
      scope: accountLabel(g, p),
      term: "有效；具体投资与维护仍单独履约",
      effect: "开放合法地方/共同出资，不把地方财政合并进中央",
      source: m.origins[`financeAgreement:${p}`],
      target: { kind: "finance", province: p },
    });
  if (m.cooperation)
    rows.push({
      id: "cooperation",
      title: "跨组织合作渠道",
      scope: "具备地方收益权与实际人员的地区",
      term: "当前有效；强制行动可能解除",
      effect: "协商、教学及跨组织行动的条件之一",
      source: m.origins.cooperation,
      target: { kind: "policy" },
    });
  for (const w of m.works)
    if (w.maintenanceSponsor && !w.cancelled)
      rows.push({
        id: `sponsor:${w.id}`,
        title: "设施维护接管",
        scope: workSpecs[w.type].name,
        term: "持续履约，含既有欠款",
        effect: `${accountLabel(g, w.maintenanceSponsor)}承担维护，产权仍为原合同`,
        source: w.sponsorSource,
        target: { kind: "work", id: w.id, province: w.province },
      });
  for (const [id, a] of Object.entries(m.authorization))
    if (a.expires >= g.core.turn)
      rows.push({
        id: `auth:${id}`,
        title: "具体事务临时授权",
        scope: g.machine.matters.find((m) => m.id === id)?.title ?? id,
        term: `第${a.expires}回合结束到期`,
        effect: `${getOffice(a.lead).short}主持${a.joint ? "，正式联合参与" : ""}；不赠送专业`,
        source: a.source,
        target: { kind: "matter", id },
      });
  for (const key of ["anomaly", "transport", "evacuation"] as const)
    if (m.departments[key].length)
      rows.push({
        id: `department:${key}`,
        title: {
          anomaly: "异常行政接口",
          transport: "跨省运输接口",
          evacuation: "地方疏散接口",
        }[key],
        scope: m.departments[key].map((p) => accountLabel(g, p)).join("、"),
        term: "长期有效；仍需人员与预算",
        effect: "改变相应事务归属，不替代具体能力和本地条件",
        target: { kind: "policy" },
      });
  for (const a of m.agendas?.items ?? [])
    if (
      a.state === "negotiated" &&
      a.resumeAfter &&
      g.core.turn < a.resumeAfter
    )
      rows.push({
        id: `pledge:${a.id}`,
        title: "已签署的工程暂缓承诺",
        scope: workSpecs[m.works.find((w) => w.id === a.work)!.type].name,
        term: `第${a.resumeAfter}回合起可申请恢复`,
        effect: "本回合暂停该项目；其他工程和行政类别不受限制",
        source: a.decisionSource,
        target: { kind: "work", id: a.work, province: a.province },
      });
  return rows;
}
export function crisisCards(g: V2Game) {
  return g.machine.matters
    .map((m) => ({
      id: m.id,
      title: m.title,
      province: m.province,
      stage: m.stage,
      step: crisisStep(g, m),
      priority: crisisStep(g, m).escalating
        ? 80 + m.stage * 4
        : m.kind === "warning"
          ? 65
          : m.kind === "energyFault"
            ? 95
            : m.kind === "final"
              ? 90
              : 40,
      source: m.source,
    }))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
/** Relevant offices from real preview participants plus concrete blockers, never a second permission test. */
export function actionBottlenecks(g: V2Game, action: Action) {
  const p = previewAction(g, action),
    ids = new Set(
      p.institutions.filter((id) => offices.some((o) => o.id === id)),
    );
  for (const person of p.actors)
    for (const o of offices)
      if (officePerson(g, o.id) === person) ids.add(o.id);
  if (action.type === "maintenanceSponsor" && action.account === "central")
    ids.add("plan");
  if (["fiscalTransfer", "fiscalReform", "transfer"].includes(action.type))
    ids.add("plan");
  return [...ids].map((id) => ({
    id,
    person: officePerson(g, id),
    marks: personMarks(g, officePerson(g, id)),
    project: officePerson(g, id)
      ? assignmentsFor(g, officePerson(g, id)!).activeProject?.id
      : undefined,
    conditions: p.conditions.filter((c) => !c.met),
  }));
}
export function constructionComparison(g: V2Game, a: Action) {
  if (
    ![
      "appoint",
      "concurrent",
      "regime",
      "department",
      "policy",
      "maintenanceSponsor",
      "project",
      "pause",
      "workControl",
    ].includes(a.type)
  )
    return null;
  const p = previewAction(g, a);
  if (p.errors.length) return null;
  const after = executeCommand(g, a).game;
  const beforeOrg = organizationBoard(g),
    afterOrg = organizationBoard(after);
  const changed = beforeOrg.flatMap((o) => {
    const n = afterOrg.find((x) => x.id === o.id)!;
    const prior = o.actions
        .filter((x) => !x.preview.errors.length)
        .map((x) => x.id),
      next = n.actions.filter((x) => !x.preview.errors.length).map((x) => x.id);
    return o.person !== n.person ||
      JSON.stringify(o.marks) !== JSON.stringify(n.marks) ||
      JSON.stringify(prior) !== JSON.stringify(next)
      ? [
          {
            id: o.id,
            before: o,
            after: n,
            added: n.actions
              .filter((x) => !x.preview.errors.length && !prior.includes(x.id))
              .map((x) => x.label),
            lost: o.actions
              .filter((x) => !x.preview.errors.length && !next.includes(x.id))
              .map((x) => x.label),
          },
        ]
      : [];
  });
  const goals = governanceTargets(g)
    .map((c, i) => ({
      label: c.label,
      before: c.met,
      after: governanceTargets(after)[i]?.met ?? false,
    }))
    .filter((c) => c.before !== c.after);
  const works = after.machine.works
    .filter(
      (w) =>
        JSON.stringify(g.machine.works.find((x) => x.id === w.id)) !==
        JSON.stringify(w),
    )
    .map((w) => w.id);
  return {
    changed,
    goals,
    works,
    pending: after.machine.pending ?? after.machine.departmentPending,
    commandDelta: g.core.commands - after.core.commands,
  };
}
export function missingConditions(conditions: Condition[]) {
  return conditions.filter((c) => !c.met);
}
export function qualifiedCaps(g: V2Game, id: string, pid: ProvinceId) {
  return (
    [
      "leywork",
      "mobilize",
      "seal",
      "industry",
      "transport",
      "rapid",
      "joint",
    ] as const
  ).filter((cap) => specialistCapability(g, cap, pid, [id]).length > 0);
}

/** At most four actionable public matters; the fifth place belongs to the current objective. */
export function currentAffairs(g: V2Game) {
  const crises = crisisCards(g).map((c) => ({
    kind: "crisis" as const,
    id: c.id,
    priority: c.priority,
    payload: c,
  }));
  const agendas = (g.machine.agendas?.items ?? [])
    .filter((a) => a.state === "active")
    .map((a) => ({
      kind: "agenda" as const,
      id: a.id,
      priority: g.core.turn >= a.deadline ? 94 : 70,
      payload: a,
    }));
  return [...crises, ...agendas]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 4);
}
