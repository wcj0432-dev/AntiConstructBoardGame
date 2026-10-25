import type { V2Game } from "./model";
import { chapterIds, chapterNames, storyTitle } from "./contractStory";
import { accountLabel } from "./fiscal";
export function migrateAndValidateV8(g: V2Game) {
  const m = g.machine;
  if (m.rulesVersion === "0.7.0") {
    m.storylines = [];
    m.rulesVersion = "0.8.0";
    (m.migrationNotes ??= []).push(
      "v0.8保留原有国情、资金、合同、课程、战略、历史和随机数；政治故事从未签字开始，不追认既有操作为新章节。",
    );
  }
  const stories = m.storylines;
  if (
    !["0.8.0", "0.8.5"].includes(m.rulesVersion) ||
    !Array.isArray(stories) ||
    new Set(stories.map((s) => s.work)).size !== stories.length
  )
    throw Error("v0.8政治故事数据缺失或重复，原存档未改动");
  for (const s of stories) {
    const w = m.works.find((w) => w.id === s.work);
    if (
      !w ||
      !Array.isArray(s.decisions) ||
      s.decisions.length < 1 ||
      s.decisions.length > 3
    )
      throw Error("政治故事合同或章节无效");
    for (const [i, d] of s.decisions.entries()) {
      const h = m.history.find((h) => h.id === d.source),
        op = m.history.find((h) => h.id === d.operation);
      if (
        d.chapter !== chapterIds[i] ||
        !Number.isSafeInteger(d.turn) ||
        d.turn < 1 ||
        d.turn > g.core.turn ||
        (i > 0 && d.turn <= s.decisions[i - 1].turn) ||
        !h ||
        h.turn !== d.turn ||
        h.title !== `${storyTitle} · ${chapterNames[i]}` ||
        (i > 0 && !h.parents.includes(s.decisions[i - 1].source)) ||
        ![
          ["central", "local"],
          ["field", "academy"],
          ["central", "autonomy"],
        ][i].includes(d.choice)
      )
        throw Error("政治故事签字顺序或来源无效");
      if (i < 2 && (!op || op.turn !== d.turn || !h.parents.includes(op.id)))
        throw Error("政治故事缺少实际操作来源");
      if (
        i === 0 &&
        (op?.title !== "协商接管维护责任" ||
          !op.parents.includes(w.source) ||
          !op.effects.some((e) =>
            e.startsWith(
              `${accountLabel(g, d.choice === "central" ? "central" : w.province)}明确承接`,
            ),
          ))
      )
        throw Error("政治故事维护来源无效");
      if (i === 1) {
        const t = m.trainings?.find((t) => t.id === d.training);
        if (
          !t ||
          t.province !== w.province ||
          t.method !== d.choice ||
          t.source !== d.operation ||
          t.start !== d.turn
        )
          throw Error("政治故事指定课程无效");
      }
      if (i === 2 && d.operation && (!op || !h.parents.includes(op.id)))
        throw Error("政治故事税制来源无效");
      if (i === 2) {
        const t = m.trainings?.find((t) => t.id === s.decisions[1].training);
        if (!t?.completedAt || t.completedAt > d.turn)
          throw Error("政治故事税制讨论早于实际毕业");
      }
    }
  }
}
