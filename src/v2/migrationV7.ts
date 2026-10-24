import type { V2Game } from "./model";
import { realmIds } from "./nationalStrategy";
export function migrateAndValidateV7(g: V2Game) {
  const m = g.machine;
  if (m.rulesVersion === "0.6.0") {
    m.advisor = { seen: [], cooldowns: {} };
    m.strategy = { legalRecords: [], dispatches: [] };
    m.rulesVersion = "0.7.0";
    (m.migrationNotes ??= []).push(
      "v0.7保留六条既有目标、维护、个人培养、产权、历史和随机数；未替旧政府选择战略分支。秘书主题从未读开始，可随时关闭主动提示。",
    );
  }
  const a = m.advisor,
    s = m.strategy;
  if (
    !["0.7.0", "0.8.0"].includes(m.rulesVersion) ||
    !a ||
    !s ||
    !Array.isArray(a.seen) ||
    a.seen.some((x) => typeof x !== "string") ||
    new Set(a.seen).size !== a.seen.length ||
    !a.cooldowns ||
    Array.isArray(a.cooldowns) ||
    typeof a.cooldowns !== "object" ||
    Object.values(a.cooldowns).some(
      (t) => !Number.isSafeInteger(t) || t < 1 || t > g.core.turn,
    ) ||
    !Array.isArray(s.legalRecords) ||
    !Array.isArray(s.dispatches)
  )
    throw new Error("v0.7秘书或战略数据缺失/无效，不重新生成覆盖当前档");
  if (
    (s.branch && !["central", "plural"].includes(s.branch)) ||
    (s.branch &&
      (!s.source ||
        !m.history.some(
          (h) =>
            h.id === s.source &&
            h.turn === s.chosenAt &&
            h.title.startsWith("确立战略分支："),
        ) ||
        !Number.isInteger(s.chosenAt) ||
        s.chosenAt! < 1 ||
        s.chosenAt! > g.core.turn)) ||
    (!s.branch && (s.source || s.chosenAt !== undefined))
  )
    throw new Error("战略分支来源无效");
  if (
    s.legalRecords.some(
      (r) =>
        !realmIds.includes(r.province) ||
        !m.works.some((w) => w.id === r.work && w.province === r.province) ||
        typeof r.signature !== "string" ||
        !r.source ||
        !m.history.some(
          (h) =>
            h.id === r.source &&
            h.turn === r.turn &&
            h.title === "登记设施产权与履约契约",
        ) ||
        !Number.isInteger(r.turn) ||
        r.turn < 1 ||
        r.turn > g.core.turn,
    ) ||
    new Set(s.legalRecords.map((r) => r.province)).size !==
      s.legalRecords.length
  )
    throw new Error("法律契约记录无效");
  if (
    s.dispatches.some(
      (r) =>
        !realmIds.includes(r.province) ||
        !r.matter ||
        !r.source ||
        !m.history.some(
          (h) =>
            h.id === r.source &&
            h.turn === r.turn &&
            h.title === "通过国家通讯网传达事务指令",
        ) ||
        ![...m.matters, ...m.backlog, ...m.archive].some(
          (x) => x.id === r.matter && x.province === r.province,
        ) ||
        !Number.isInteger(r.turn) ||
        r.turn < 1 ||
        r.turn > g.core.turn,
    ) ||
    new Set(s.dispatches.map((r) => r.matter)).size !== s.dispatches.length
  )
    throw new Error("通讯指令记录无效");
}
