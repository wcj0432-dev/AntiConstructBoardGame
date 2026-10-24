import { getPerson } from "../data";
import { workSpecs } from "./administration";
import { initialFeatures, featureNames } from "./regions";
import type { TrainingCap, V2Game } from "./model";
const pids = ["industry", "south", "north"] as const;
const caps: TrainingCap[] = ["leywork", "mobilize", "seal"];
const integer = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
export function migrateAndValidateV6(g: V2Game) {
  const m = g.machine,
    legacy = !["0.6.0", "0.7.0"].includes(m.rulesVersion);
  if (legacy) {
    m.migratedFrom ??= m.rulesVersion;
    m.trainings ??= [];
    m.regionFeatures ??= initialFeatures();
    m.relationships ??= [];
    for (const cap of caps)
      if (
        m.milestones.includes(`training:${cap}`) &&
        !m.trainings.some((t) => t.cap === cap)
      )
        m.trainings.push({
          id: `training-${g.core.nextId++}`,
          cap,
          province:
            cap === "leywork" ? "south" : cap === "seal" ? "north" : "industry",
          method: "legacy",
          start: 0,
          progress: 0,
          duration: 0,
          state: "unassigned",
          reason:
            "旧版本仅保存国家教习标记；请明确指定唯一学员，不推断导师或共享个人资质",
          source: m.origins[`training:${cap}`] ?? "legacy-training",
        });
    for (const w of m.works)
      w.maintenance ??= {
        turn: -1,
        fee: workSpecs[w.type].maintenance,
        due: 0,
        paid: 0,
        arrears: 0,
        payments: [],
        source: w.source,
      };
    (m.migrationNotes ??= []).push(
      "v0.6保留工程、付款合同、人物、旧教习里程碑和随机数。旧设施没有逐项付款证据，不追溯虚构欠款；从下次结算按维护合同核对。旧教习须确认具体继任者，旧导师记为未记录。",
    );
    m.rulesVersion = "0.6.0";
  }
  if (
    !Array.isArray(m.trainings) ||
    !Array.isArray(m.relationships) ||
    !m.regionFeatures ||
    pids.some(
      (pid) =>
        !Array.isArray(m.regionFeatures![pid]) ||
        m.regionFeatures![pid].some((f) => !Object.hasOwn(featureNames, f)) ||
        new Set(m.regionFeatures![pid]).size !== m.regionFeatures![pid].length,
    )
  )
    throw new Error(
      "v0.6人才培养或地区特征数据缺失 / 无效，不能重新生成覆盖当前档",
    );
  for (const w of m.works) {
    const s = w.maintenance;
    if (!s && workSpecs[w.type].maintenance && w.completed)
      throw new Error("v0.6设施缺少维护履约记录");
    if (
      s &&
      (!integer(s.fee) ||
        s.fee !== workSpecs[w.type].maintenance ||
        !integer(s.due) ||
        !integer(s.paid) ||
        !integer(s.arrears) ||
        s.due !== s.paid + s.arrears ||
        !Number.isSafeInteger(s.turn) ||
        s.turn < -1 ||
        s.turn > g.core.turn ||
        typeof s.source !== "string" ||
        !Array.isArray(s.payments) ||
        s.payments.some(
          (p) =>
            !["central", "cult", ...pids].includes(p.account) ||
            !integer(p.due) ||
            !integer(p.paid) ||
            !integer(p.arrears) ||
            p.due !== p.paid + p.arrears,
        ) ||
        s.payments.reduce((n, p) => n + p.arrears, 0) !== s.arrears ||
        s.payments.reduce((n, p) => n + p.paid, 0) !== s.paid ||
        (s.lastPaidTurn !== undefined &&
          (!integer(s.lastPaidTurn) || s.lastPaidTurn > g.core.turn)))
    )
      throw new Error("设施维护金额、责任方或履约时间无效");
    if (
      w.maintenanceSponsor &&
      !["central", "cult", ...pids].includes(w.maintenanceSponsor)
    )
      throw new Error("维护接管账户无效");
  }
  if (
    m.demonstration &&
    (m.demonstration.id !== "succession" ||
      typeof m.demonstration.failed !== "boolean" ||
      (m.demonstration.reserveSource !== undefined &&
        typeof m.demonstration.reserveSource !== "string"))
  )
    throw new Error("演示场景记录无效");
  const ids = new Set<string>(),
    qualified = new Set<string>(),
    current = new Set<string>();
  for (const t of m.trainings) {
    if (
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      !caps.includes(t.cap) ||
      !pids.includes(t.province) ||
      !["field", "academy", "legacy"].includes(t.method) ||
      !["active", "paused", "completed", "cancelled", "unassigned"].includes(
        t.state,
      ) ||
      !integer(t.start) ||
      t.start > g.core.turn ||
      !integer(t.duration) ||
      !integer(t.progress) ||
      t.progress > t.duration ||
      typeof t.reason !== "string" ||
      typeof t.source !== "string" ||
      (t.mentor && !getPerson(t.mentor)) ||
      (t.student && !getPerson(t.student)) ||
      (t.method !== "legacy" &&
        (!t.mentor ||
          !t.student ||
          t.mentor === t.student ||
          t.duration !== (t.method === "academy" ? 2 : 3))) ||
      (t.method === "academy" &&
        !m.works.some(
          (w) =>
            w.id === t.facility &&
            w.type === "academy" &&
            w.province === t.province,
        )) ||
      (t.state === "completed" &&
        (!t.student ||
          t.progress !== t.duration ||
          !integer(t.completedAt) ||
          t.completedAt! > g.core.turn)) ||
      (t.state === "unassigned" && (t.method !== "legacy" || !!t.student))
    )
      throw new Error("个体培养记录、教学设施或完成时间无效");
    ids.add(t.id);
    if (t.state === "completed") {
      const key = `${t.student}:${t.cap}`;
      if (qualified.has(key)) throw new Error("同一人物专业资格重复");
      qualified.add(key);
    }
    if (["active", "paused"].includes(t.state)) {
      if (current.has(t.student!)) throw new Error("学员同时参加多项课程");
      current.add(t.student!);
    }
  }
  const ongoing = m.trainings.filter((t) =>
    ["active", "paused"].includes(t.state),
  );
  for (const t of ongoing)
    if (
      t.method === "legacy" ||
      ongoing.filter((x) => x.mentor === t.mentor).length >
        (ongoing.some((x) => x.mentor === t.mentor && x.method === "field")
          ? 1
          : 2) ||
      (t.facility &&
        ongoing.filter((x) => x.facility === t.facility).length > 2)
    )
      throw new Error("导师或学院教学容量无效");
  if (
    m.relationships.some(
      (r) =>
        typeof r.id !== "string" ||
        r.kind !== "cooperation" ||
        !pids.includes(r.province) ||
        !integer(r.turn) ||
        r.turn > g.core.turn ||
        !Array.isArray(r.actors) ||
        r.actors.some((id) => !getPerson(id)) ||
        !Array.isArray(r.institutions) ||
        typeof r.source !== "string",
    ) ||
    new Set(m.relationships.map((r) => r.id)).size !== m.relationships.length
  )
    throw new Error("组织合作关系来源无效");
}
