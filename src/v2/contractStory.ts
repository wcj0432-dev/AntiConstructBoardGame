import type { Action, Condition, V2Game, StoryDecision } from "./model";
import { workFunding, fiscalPreview } from "./fiscal";
import { workSpecs } from "./administration";
import { facilityOperating, facilityStatus } from "./operations";
export type StoryAction = Extract<Action, { type: "storyDecision" }>;
export const chapterNames = ["经营的签字人", "知识属于谁", "全国税源之争"];
export const storyTitle = "一纸契约，三次签字";
export const chapterIds = ["charter", "teaching", "tax"] as const;
export function storyAssets(g: V2Game) {
  return g.machine.works.filter(
    (w) =>
      (w.completed &&
        !w.cancelled &&
        (workSpecs[w.type].maintenance ?? 0) > 0 &&
        workFunding(g, w).owner !== "central") ||
      g.machine.storylines?.some((s) => s.work === w.id),
  );
}
export function storyFacts(g: V2Game, work: string) {
  const w = g.machine.works.find((w) => w.id === work),
    decisions =
      g.machine.storylines?.find((s) => s.work === work)?.decisions ?? [];
  const charter = decisions[0],
    teaching = decisions[1],
    tax = decisions[2];
  const course = g.machine.trainings?.find((t) => t.id === teaching?.training);
  const sponsor = charter?.choice === "central" ? "central" : w?.province;
  const issues: string[] = [];
  if (!w || w.cancelled || !w.completed)
    issues.push("合同设施已经取消或不再竣工");
  if (charter && w?.maintenanceSponsor !== sponsor)
    issues.push("维护责任已被后来决定改写，请在财政面板恢复约定或保留这段历史");
  if (w && !facilityOperating(g, w)) issues.push(facilityStatus(g, w).reason);
  if (teaching && course?.state !== "completed")
    issues.push(`指定课程尚未毕业：${course?.reason ?? "课程不存在"}`);
  if (tax && g.machine.fiscal?.taxSystem !== tax.choice)
    issues.push("全国税制已被后来改革改变，既有签字仅作历史记录");
  return {
    w,
    decisions,
    course,
    issues,
    complete: decisions.length === 3 && issues.length === 0,
  };
}
/** Resolve to an existing real operation; engine executes that operation once. No narrative reward economy. */
export function storyOperation(g: V2Game, a: StoryAction): Action | null {
  const w = g.machine.works.find((w) => w.id === a.work);
  if (a.chapter === "charter")
    return {
      type: "maintenanceSponsor",
      work: a.work,
      account: a.choice === "central" ? "central" : (w?.province ?? "south"),
    };
  if (a.chapter === "teaching")
    return {
      type: "train",
      mentor: a.mentor,
      student: a.student,
      cap: a.cap,
      province: w?.province ?? "south",
      method: a.choice,
      facility: a.choice === "academy" ? a.facility : undefined,
    };
  return g.machine.fiscal?.taxSystem === a.choice
    ? null
    : { type: "fiscalReform", system: a.choice };
}
export function storyConditions(g: V2Game, a: StoryAction): Condition[] {
  const f = storyFacts(g, a.work),
    index = chapterIds.indexOf(a.chapter),
    last = f.decisions.at(-1);
  const c = (label: string, met: boolean, reason: string): Condition => ({
    label,
    met,
    reason,
  });
  const out = [
    c(
      "实际共同经营合同",
      !!f.w &&
        f.w.completed &&
        !f.w.cancelled &&
        (workSpecs[f.w.type].maintenance ?? 0) > 0 &&
        workFunding(g, f.w).owner !== "central",
      "先竣工一项地方、宗门或共同产权且有维护义务的设施；不凭剧情创造工程",
    ),
    c(
      "按章签字，不重复领取",
      index === f.decisions.length,
      "每章只记录一次；不能跳章或重复签字",
    ),
    c(
      "跨回合的政治过程",
      !last || g.core.turn > last.turn,
      "结束当前回合后才能讨论下一章，教学仍需真实周期",
    ),
  ];
  if (index > 0) {
    const expected =
      f.decisions[0]?.choice === "central" ? "central" : f.w?.province;
    out.push(
      c(
        "先前约定仍在履行",
        !!f.decisions[0] &&
          f.w?.maintenanceSponsor === expected &&
          !!f.w &&
          facilityOperating(g, f.w),
        "按第一章约定恢复维护承担方，补缴真实欠款并恢复设施运营；旧债不会被剧情抹除",
      ),
    );
  }
  if (a.chapter === "tax") {
    out.push(
      c(
        "具体学员完成传承",
        f.course?.state === "completed",
        "让第二章指定课程实际毕业；离任、隔离、教学停顿均按原规则处理",
      ),
    );
    // Ratifying an existing tax system still requires its real responsible institutions.
    if (g.machine.fiscal?.taxSystem === a.choice)
      out.push(
        ...fiscalPreview(g, {
          type: "fiscalReform",
          system: a.choice,
        }).conditions!.filter((x) => x.label !== "实际税制变更"),
      );
  }
  return out;
}
export function storyEffects(a: StoryAction, ratify = false) {
  if (a.chapter === "charter")
    return [
      "第一章：工程产权、收益与停机权仍属原合同。维护接管会转移现存欠款及未来维护义务，不直接付款。",
    ];
  if (a.chapter === "teaching")
    return [
      `第二章：指定导师和学员开展${a.choice === "academy" ? "两期学院" : "三期基层"}教学；只有真实完成课程才产生个人资质。`,
    ];
  return [
    `第三章：${ratify ? "确认现行税制，不重复收取改革费用，也不发放奖励" : "执行一次实际财政改革"}。这是覆盖全国三省的税源决定，会影响其他合同、战略条件及地方账户。`,
  ];
}
export function appendStoryDecision(
  g: V2Game,
  a: StoryAction,
  source: string,
  operation?: string,
) {
  const stories = (g.machine.storylines ??= []);
  let s = stories.find((s) => s.work === a.work);
  if (!s) {
    s = { work: a.work, decisions: [] };
    stories.push(s);
  }
  const d: StoryDecision = {
    chapter: a.chapter,
    choice: a.choice,
    turn: g.core.turn,
    source,
    operation,
  };
  if (a.chapter === "teaching")
    d.training = g.machine.trainings?.find((t) => t.source === operation)?.id;
  s.decisions.push(d);
}
