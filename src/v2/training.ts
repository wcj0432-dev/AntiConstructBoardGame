import { getPerson, getOffice } from "../data";
import { assignedOffices, assignmentsFor } from "./personnel";
import { facilityOperating } from "./operations";
import { hasFeature } from "./regions";
import type {
  Action,
  Condition,
  Training,
  TrainingCap,
  V2Game,
  V2Preview,
} from "./model";
export const trainingNames: Record<TrainingCap, string> = {
  leywork: "灵脉工程",
  mobilize: "群众救援",
  seal: "异常收容",
};
const teachers: Record<TrainingCap, string[]> = {
  leywork: ["mo", "bai", "linruoxu", "yunsong"],
  mobilize: ["xing", "suyi", "taoqi"],
  seal: ["sergei", "qi", "xuzhao"],
};
export const teachingCap = (id: string): TrainingCap | undefined =>
  (
    ({ yunsong: "leywork", taoqi: "mobilize", xuzhao: "seal" }) as Record<
      string,
      TrainingCap
    >
  )[id];
export const hasCredential = (g: V2Game, id: string, cap: TrainingCap) =>
  (g.machine.trainings ?? []).some(
    (t) => t.student === id && t.cap === cap && t.state === "completed",
  );
export function admission(id: string, cap: TrainingCap) {
  const p = getPerson(id);
  return (
    !!p &&
    (cap === "leywork"
      ? p.skills.production >= 2 && p.skills.anomaly >= 2
      : cap === "mobilize"
        ? p.skills.social >= 2
        : p.skills.anomaly >= 2)
  );
}
export function mentorQualified(g: V2Game, id: string, cap: TrainingCap) {
  return (
    (teachers[cap].includes(id) || hasCredential(g, id, cap)) &&
    assignedOffices(g, id).some((o) =>
      getOffice(o).domains.includes(
        cap === "leywork"
          ? "production"
          : cap === "mobilize"
            ? "social"
            : "anomaly",
      ),
    )
  );
}
const c = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
export function courseConditions(g: V2Game, t: Training): Condition[] {
  const mentor = t.mentor,
    student = t.student;
  const available = (id: string | undefined) =>
    !!id &&
    (g.core.grievances[id] ?? 0) < 3 &&
    (!g.machine.occupied[id] || g.machine.occupied[id] === t.source) &&
    assignmentsFor(g, id).activeProject?.assignment !== "dedicated";
  return [
    c(
      "导师专业与实际教学职位",
      !!mentor && mentorQualified(g, mentor, t.cap),
      "安排具有本专业资质和正式教学职务的导师；继任者也可成为后续导师",
    ),
    c(
      "导师与学员能投入教学",
      available(mentor) && available(student),
      "专职工程、拒绝履职或其他临时事务会暂停课程；短期中断保留进度",
    ),
    c(
      "教学地区可通行",
      !g.machine.matters.some((m) => m.province === t.province && m.isolated),
      "解除地区隔离后恢复，不能以学院资质绕过隔离",
    ),
    c(
      "教学制度与地方渠道",
      g.machine.cooperation &&
        g.machine.rights[t.province] &&
        g.machine.trust[t.province] >= 2 &&
        !g.machine.suppressed[t.province],
      "保留地方教学权、信任2与实际合作渠道",
    ),
    c(
      "对应专业的政策条件",
      t.cap === "leywork"
        ? hasFeature(g, t.province, "leyline") &&
            (g.machine.surveyed ||
              g.machine.discoveries[t.province].includes("resources"))
        : t.cap === "seal"
          ? g.machine.knowledge && g.core.policies.disclosure !== 1
          : g.core.policies.disclosure !== 0,
      "灵脉教学需已调查灵脉；收容需档案与非全面公开政策；救援需允许公开群众活动",
    ),
    ...(t.method === "academy"
      ? [
          c(
            "教学学院实际运营",
            g.machine.works.some(
              (w) =>
                w.id === t.facility &&
                w.province === t.province &&
                w.type === "academy" &&
                facilityOperating(g, w),
            ),
            "选择本地正常运行的学院；维护欠付、隔离或渠道中断会暂停学院课程",
          ),
        ]
      : []),
  ];
}
export type TrainingAction = Extract<
  Action,
  { type: "train" | "trainingControl" | "legacyTraining" }
>;
export function trainingPreview(
  g: V2Game,
  a: TrainingAction,
): Pick<
  V2Preview,
  | "title"
  | "conditions"
  | "costs"
  | "actors"
  | "institutions"
  | "effects"
  | "parents"
> {
  const list = g.machine.trainings ?? [],
    old =
      a.type !== "train" ? list.find((t) => t.id === a.training) : undefined;
  const conditions: Condition[] = [],
    effects: string[] = [];
  let actors: string[] = [],
    costs = {
      commands: 1,
      treasury: 0,
      capital: 0,
      stock: 0,
      province: undefined as Training["province"] | undefined,
    };
  if (a.type === "train") {
    const t: Training = {
      id: "preview",
      mentor: a.mentor,
      student: a.student,
      cap: a.cap,
      province: a.province,
      facility: a.facility,
      method: a.method,
      start: g.core.turn,
      progress: 0,
      duration: a.method === "academy" ? 2 : 3,
      state: "active",
      reason: "",
      source: "preview",
    };
    conditions.push(
      c(
        "具体且不同的导师与学员",
        !!getPerson(a.mentor) &&
          !!getPerson(a.student) &&
          a.mentor !== a.student,
        "必须指定两名不同人物；不能将国家教习里程碑授予所有人",
      ),
      c(
        "学员基础专业与未重复培养",
        admission(a.student, a.cap) &&
          !hasCredential(g, a.student, a.cap) &&
          !list.some(
            (x) =>
              x.student === a.student && ["active", "paused"].includes(x.state),
          ),
        "学员基础专业至少2，灵脉另需异常2；不得重复获取同一资质，同期一人一课程",
      ),
      ...courseConditions(g, t),
    );
    const ongoing = list.filter((t) => ["active", "paused"].includes(t.state));
    conditions.push(
      c(
        "有限师资与教学容量",
        ongoing.filter((t) => t.mentor === a.mentor).length <
          (a.method === "academy" &&
          !ongoing.some((t) => t.mentor === a.mentor && t.method === "field")
            ? 2
            : 1) &&
          (a.method !== "academy" ||
            ongoing.filter((t) => t.facility === a.facility).length < 2),
        "基层教习一名导师同期一人；学院一名导师及每座学院最多两人，课程占用即使暂停仍保留",
      ),
    );
    costs = {
      commands: 1,
      treasury: a.method === "academy" ? 1 : 2,
      capital: 0,
      stock: a.method === "academy" ? 0 : 1,
      province: a.province,
    };
    actors = [a.mentor, a.student];
    effects.push(
      `${getPerson(a.mentor)?.name}在${a.method === "academy" ? "指定学院" : "基层现场"}培养${getPerson(a.student)?.name}：${trainingNames[a.cap]}，持续${t.duration}个有效教学周期`,
      "只有指定学员完成后取得资格；能力仍受正式岗位、政策、占用与设施条件限制；不会增加通用属性",
      a.method === "academy"
        ? "学院维护与运行决定课程是否继续；学院支持两名学员，费用1，无额外教材库存"
        : "基层教习费用2及教材实物1，同期一名学员，需3个有效周期",
    );
  } else if (a.type === "legacyTraining") {
    conditions.push(
      c(
        "旧档待确认的历史培养",
        !!old && old.state === "unassigned" && old.method === "legacy",
        "只用于旧版本未记录学员的真实历史里程碑",
      ),
      c(
        "明确指定合格继任者",
        !!old &&
          admission(a.student, old.cap) &&
          !hasCredential(g, a.student, old.cap) &&
          !list.some(
            (t) =>
              t.student === a.student &&
              t.cap === old.cap &&
              ["active", "paused"].includes(t.state),
          ),
        "选择有基础专业的人物；不会推断或伪造旧导师姓名",
      ),
    );
    actors = [a.student];
    effects.push(
      "确认旧历史的唯一继任者，保留原培养来源；导师记为旧版未记录，不给所有人物共享资格",
    );
  } else {
    conditions.push(
      c(
        "未完成的实际课程",
        !!old && ["active", "paused"].includes(old.state),
        "已完成的资质不撤回，已取消课程不能刷取奖励",
      ),
    );
    if (a.operation === "resume" && old) {
      const mentor = a.mentor ?? old.mentor;
      conditions.push(
        ...courseConditions(g, { ...old, mentor }),
        c(
          "替任导师教学容量",
          list.filter(
            (t) =>
              t.id !== old.id &&
              t.mentor === mentor &&
              ["active", "paused"].includes(t.state),
          ).length <
            (old.method === "academy" &&
            !list.some(
              (t) =>
                t.id !== old.id &&
                t.mentor === mentor &&
                t.method === "field" &&
                ["active", "paused"].includes(t.state),
            )
              ? 2
              : 1),
          "更换导师也必须遵守基层一人、学院两人的有限容量",
        ),
      );
    }
    actors = old?.mentor ? [old.mentor] : [];
    effects.push(
      a.operation === "cancel"
        ? "取消课程并释放容量，教材及已支付费用不退还；已有个人资质不受影响"
        : "按当前资质和岗位重新检查，可更换导师；保留已获得课程进度",
    );
  }
  return {
    title:
      a.type === "train"
        ? `培养${getPerson(a.student)?.name ?? "学员"} · ${trainingNames[a.cap]}`
        : a.type === "legacyTraining"
          ? "确认旧档历史继任者"
          : "调整人才培养安排",
    conditions,
    costs,
    actors,
    institutions: a.type === "train" ? [`gov-${a.province}`] : [],
    effects,
    parents: [old?.source].filter((x): x is string => !!x),
  };
}
export function applyTraining(g: V2Game, a: TrainingAction, source: string) {
  const list = (g.machine.trainings ??= []);
  if (a.type === "train") {
    list.push({
      id: `training-${g.core.nextId++}`,
      mentor: a.mentor,
      student: a.student,
      cap: a.cap,
      province: a.province,
      facility: a.facility,
      method: a.method,
      start: g.core.turn,
      progress: 0,
      duration: a.method === "academy" ? 2 : 3,
      state: "active",
      reason: "等待有效教学周期",
      source,
    });
    g.machine.occupied[a.mentor] = source;
    g.machine.occupied[a.student] = source;
  } else {
    const t = list.find((t) => t.id === a.training)!;
    if (a.type === "legacyTraining") {
      t.student = a.student;
      t.state = "completed";
      t.completedAt = g.core.turn;
      t.reason = "玩家明确指定旧档继任者，旧导师未记录";
    } else {
      t.state = a.operation === "cancel" ? "cancelled" : "active";
      if (a.mentor) t.mentor = a.mentor;
      t.reason = a.operation === "cancel" ? "玩家取消，保留历史" : "恢复课程";
    }
  }
}
export function advanceTrainings(g: V2Game, onComplete: (t: Training) => void) {
  for (const t of g.machine.trainings ?? []) {
    if (!["active", "paused"].includes(t.state)) continue;
    const missing = courseConditions(g, t).filter((c) => !c.met);
    if (missing.length) {
      t.state = "paused";
      t.reason = missing.map((c) => c.reason).join("；");
      continue;
    }
    t.state = "active";
    t.progress = Math.min(t.duration, t.progress + 1);
    t.reason = `有效教学${t.progress}/${t.duration}`;
    if (t.progress === t.duration) {
      t.state = "completed";
      t.completedAt = g.core.turn;
      t.reason = "指定学员完成专业培养，导师离任不抹除资质";
      if (!g.machine.milestones.includes(`training:${t.cap}`))
        g.machine.milestones.push(`training:${t.cap}`);
      g.machine.origins[`training:${t.cap}`] = t.source;
      onComplete(t);
    }
  }
}
