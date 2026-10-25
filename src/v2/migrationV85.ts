import { getPerson, offices } from "../data";
import type { V2Game } from "./model";
import { agendaTitles } from "./factionAgendas";
export function migrateAndValidateV85(g: V2Game) {
  const m = g.machine;
  if (m.rulesVersion === "0.8.0") {
    m.agendas = { seen: [], items: [] };
    m.rulesVersion = "0.8.5";
    (m.migrationNotes ??= []).push(
      "v0.8.5保留人物、兼职、工程、债务、课程、战略、三章故事、历史与随机数；只新增空派系议程记录，不追溯征收旧承诺。地图/桌面偏好独立于存档。",
    );
  }
  const a = m.agendas,
    kinds = Object.keys(agendaTitles);
  if (
    m.rulesVersion !== "0.8.5" ||
    !a ||
    !Array.isArray(a.seen) ||
    a.seen.some((k) => !kinds.includes(k)) ||
    new Set(a.seen).size !== a.seen.length ||
    !Array.isArray(a.items) ||
    a.items.length > 2 ||
    new Set(a.items.map((x) => x.id)).size !== a.items.length ||
    new Set(a.items.map((x) => x.kind)).size !== a.items.length ||
    a.seen.length !== a.items.length
  )
    throw Error("v0.8.5派系议程缺失或重复，不覆盖当前档");
  for (const x of a.items) {
    const h = m.history.find((h) => h.id === x.source),
      trigger = m.history.find((h) => h.id === x.trigger),
      w = m.works.find((w) => w.id === x.work);
    if (
      !kinds.includes(x.kind) ||
      !a.seen.includes(x.kind) ||
      !x.id ||
      !w ||
      w.province !== x.province ||
      !offices.some((o) => o.id === x.office) ||
      !getPerson(x.issuer) ||
      getPerson(x.issuer)!.faction !== x.faction ||
      !Number.isSafeInteger(x.created) ||
      x.created < 1 ||
      x.created > g.core.turn ||
      typeof x.deferred !== "boolean" ||
      x.deadline !== x.created + 2 + (x.deferred ? 1 : 0) ||
      !h ||
      h.turn !== x.created ||
      h.title !== `派系议程提出：${agendaTitles[x.kind]}` ||
      !trigger ||
      !h.parents.includes(x.trigger) ||
      ![
        "active",
        "accepted",
        "negotiated",
        "rejected",
        "expired",
        "superseded",
      ].includes(x.state)
    )
      throw Error("派系议程资格、期限或来源无效");
    if (
      !h.actors.includes(x.issuer) ||
      !h.institutions.includes(x.office) ||
      (x.kind === "construction-budget" &&
        (x.office !== "plan" || x.trigger !== w.source)) ||
      (x.kind === "maintenance-voice" && x.office !== `gov-${x.province}`)
    )
      throw Error("派系发起机关与原始来源不一致");
    if (
      x.deferred &&
      (!x.delaySource ||
        !m.history.some(
          (h) =>
            h.id === x.delaySource &&
            h.title === "派系议程：支付资本延期" &&
            h.parents.includes(x.source),
        ))
    )
      throw Error("议程延期缺少已支付的实际决策来源");
    if (!x.deferred && x.delaySource) throw Error("未延期议程不应有延期来源");
    if (x.state === "active" && g.core.turn > x.deadline)
      throw Error("议程已经过期却未记录结算");
    if (x.state === "negotiated" && x.kind === "construction-budget") {
      const decision = m.history.find((h) => h.id === x.decisionSource);
      if (!decision || x.resumeAfter !== decision.turn + 1)
        throw Error("工程暂缓承诺期限缺失或无效");
    } else if (x.resumeAfter !== undefined)
      throw Error("非暂缓议程不应拥有施工承诺期限");
    if (x.state === "active" && x.decisionSource)
      throw Error("未处理议程不应拥有结案来源");
    if (
      x.state !== "active" &&
      (!x.decisionSource ||
        !m.history.some(
          (h) =>
            h.id === x.decisionSource &&
            h.turn >= x.created &&
            h.parents.includes(x.source),
        ))
    )
      throw Error("派系议程处理来源无效");
  }
  if (
    m.governanceTrial &&
    (m.governanceTrial.id !== "four-meetings" ||
      m.mode !== "campaign" ||
      !m.history.some(
        (h) =>
          h.id === m.governanceTrial!.source &&
          h.title === "四次会议与一座电站：场景准备",
      ))
  )
    throw Error("四回合治理验证场景来源无效");
}
