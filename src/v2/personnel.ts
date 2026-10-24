import {
  domainNames,
  factionNames,
  getOffice,
  getPerson,
  offices,
  people,
} from "../data";
import type { Domain, FactionId, ProvinceId } from "../types";
import { traitFor } from "./traits";
import type { Action, Condition, V2Game, Work, WorkType } from "./model";

/** A side appointment fills a vacant office; it never creates a second holder. */
export function officePerson(g: V2Game, office: string): string | null {
  return (
    g.core.appointments[office] ||
    g.machine.secondaryAppointments?.[office] ||
    null
  );
}

export function assignedOffices(g: V2Game, person: string): string[] {
  return offices
    .filter((office) => officePerson(g, office.id) === person)
    .map((office) => office.id);
}

export const personnelWorkNames: Record<WorkType, string> = {
  relay: "通讯建设",
  energy: "宗门灵脉能源工程",
  warning: "异常预警站",
  farm: "地方农业合作改良",
  factory: "工业设施改造",
  port: "浮空贸易港",
  cooperative: "地方合作企业",
  rail: "跨省符阵铁路",
  grid: "跨省灵能电网",
  academy: "诸界专业学院",
};

export type PersonnelWorkState =
  | "available"
  | "concurrent"
  | "advisor"
  | "dedicated"
  | "temporary"
  | "restricted"
  | "training"
  | "teaching";

export const personnelStateNames: Record<PersonnelWorkState, string> = {
  training: "指定学员培养中",
  teaching: "承担导师课程",
  available: "可投入任务",
  concurrent: "正式兼职",
  advisor: "工程顾问兼任",
  dedicated: "专职派遣",
  temporary: "临时任务占用",
  restricted: "拒绝履职",
};

export interface PersonAssignments {
  mainOffice: string | null;
  secondaryOffices: string[];
  projects: Work[];
  activeProject?: Work;
  temporaryTask?: { source: string; title: string; province?: ProvinceId };
  adminAvailable: boolean;
  projectAvailable: boolean;
  restrictions: string[];
  state: PersonnelWorkState;
}

/** All panels derive work state from the save, without an independent UI roster. */
export function assignmentsFor(g: V2Game, person: string): PersonAssignments {
  const mainOffice =
    Object.entries(g.core.appointments).find(([, id]) => id === person)?.[0] ||
    null;
  const secondaryOffices = offices
    .filter(
      (office) =>
        !g.core.appointments[office.id] &&
        g.machine.secondaryAppointments?.[office.id] === person,
    )
    .map((office) => office.id);
  const projects = g.machine.works.filter((work) => work.worker === person);
  const activeProject = projects.find(
    (work) => !work.completed && !work.paused && !work.cancelled,
  );
  const source = g.machine.occupied[person];
  const history = source
    ? g.machine.history.find((item) => item.id === source)
    : undefined;
  const result = source
    ? g.machine.results.find((item) => item.id === source)
    : undefined;
  const matterId =
    result?.action.type === "resolve" || result?.action.type === "authorize"
      ? result.action.matter
      : undefined;
  const matter = matterId
    ? [...g.machine.matters, ...g.machine.backlog, ...g.machine.archive].find(
        (item) => item.id === matterId,
      )
    : undefined;
  const temporaryTask = source
    ? {
        source,
        title: history?.title || result?.title || "本回合临时事务",
        province: matter?.province,
      }
    : undefined;
  const restricted = (g.core.grievances[person] ?? 0) >= 3;
  const dedicated = activeProject?.assignment === "dedicated";
  const restrictions: string[] = [];
  if (restricted) restrictions.push("积怨达到3，须先政治和解恢复履职");
  if (temporaryTask)
    restrictions.push(
      `已投入${temporaryTask.title}，下次回合结算后释放短期占用`,
    );
  if (dedicated)
    restrictions.push("专职工程保留正式职位，但暂不提供行政行动能力");
  if (activeProject && !dedicated)
    restrictions.push("工程顾问仍能履行行政职责；行政抽调会影响施工");
  const courses = (g.machine.trainings ?? []).filter(
    (t) =>
      ["active", "paused"].includes(t.state) &&
      (t.mentor === person || t.student === person),
  );
  if (courses.length)
    restrictions.push(
      "正在承担具体培养课程；专职抽调或其他即时任务会暂停教学并保留进度",
    );
  return {
    mainOffice,
    secondaryOffices,
    projects,
    activeProject,
    temporaryTask,
    adminAvailable:
      !!(mainOffice || secondaryOffices.length) &&
      !restricted &&
      !temporaryTask &&
      !dedicated,
    projectAvailable:
      !!getPerson(person) && !restricted && !temporaryTask && !activeProject,
    restrictions,
    state: restricted
      ? "restricted"
      : temporaryTask
        ? "temporary"
        : dedicated
          ? "dedicated"
          : activeProject
            ? "advisor"
            : courses.some((t) => t.student === person)
              ? "training"
              : courses.length
                ? "teaching"
                : secondaryOffices.length
                  ? "concurrent"
                  : "available",
  };
}

export interface PersonnelRow extends PersonAssignments {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  factionName: string;
  specialty: Domain;
  skills: Record<Domain, number>;
  ability: string;
  mainOfficeLabel: string;
  secondaryOfficeLabel: string;
  regions: (ProvinceId | "central")[];
  regionLabel: string;
  taskLabel: string;
  stateLabel: string;
  grievance: number;
  roots: number;
  promises: string[];
}

const regionName = (g: V2Game, province: ProvinceId | "central") =>
  province === "central"
    ? "中央"
    : g.core.provinces.find((item) => item.id === province)?.name || province;

export function personnelRows(g: V2Game): PersonnelRow[] {
  return people.map((person) => {
    const assignment = assignmentsFor(g, person.id);
    const held = [assignment.mainOffice, ...assignment.secondaryOffices].filter(
      (id): id is string => !!id,
    );
    const regions = new Set<ProvinceId | "central">();
    for (const id of held) regions.add(getOffice(id)?.province || "central");
    for (const work of assignment.projects) {
      if (!work.completed && !work.cancelled) {
        regions.add(work.province);
        if (work.to) regions.add(work.to);
      }
    }
    if (assignment.temporaryTask?.province)
      regions.add(assignment.temporaryTask.province);
    const promises: string[] = [];
    for (const office of held) {
      const province = getOffice(office)?.province;
      if (!province) continue;
      if (g.machine.rights[province])
        promises.push(`${regionName(g, province)}本地收益权协议`);
      if (g.machine.budgets.includes(province))
        promises.push(`${regionName(g, province)}部门预算承诺`);
    }
    if (person.id === "ye" && g.machine.cooperation)
      promises.push("跨省合作承诺网有效");
    if (assignment.activeProject)
      promises.push(
        `${personnelWorkNames[assignment.activeProject.type]}施工承诺`,
      );
    const tasks = assignment.projects
      .filter((work) => !work.completed && !work.cancelled)
      .map(
        (work) =>
          `${personnelWorkNames[work.type]}（${work.paused ? "暂停" : `${work.progress}/${work.duration}`}）`,
      );
    if (assignment.temporaryTask) tasks.unshift(assignment.temporaryTask.title);
    return {
      ...assignment,
      id: person.id,
      name: person.name,
      title: person.title,
      faction: person.faction,
      factionName: factionNames[person.faction],
      specialty: person.specialty,
      skills: person.skills,
      ability: traitFor(person.id)?.title || person.ability,
      mainOfficeLabel: assignment.mainOffice
        ? getOffice(assignment.mainOffice)?.short || assignment.mainOffice
        : "待任命",
      secondaryOfficeLabel: assignment.secondaryOffices.length
        ? assignment.secondaryOffices
            .map((id) => getOffice(id)?.short || id)
            .join("、")
        : "无",
      regions: [...regions],
      regionLabel: regions.size
        ? [...regions].map((id) => regionName(g, id)).join("、")
        : "未派驻",
      taskLabel: tasks.join("；") || "无活动任务",
      stateLabel: personnelStateNames[assignment.state],
      grievance: g.core.grievances[person.id] ?? 0,
      roots: g.core.roots[person.id] ?? 0,
      promises,
    };
  });
}

export interface PersonnelFilter {
  search?: string;
  region?: ProvinceId | "central" | "unassigned" | "all";
  institution?: string;
  faction?: FactionId | "all";
  specialty?: Domain | "all";
  state?: PersonnelWorkState | "all";
}

export function filterPersonnelRows(
  rows: PersonnelRow[],
  filter: PersonnelFilter,
) {
  const query = filter.search?.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (
      query &&
      !`${row.name} ${row.title} ${row.ability}`
        .toLocaleLowerCase()
        .includes(query)
    )
      return false;
    if (filter.region && filter.region !== "all") {
      if (
        filter.region === "unassigned"
          ? row.regions.length > 0
          : !row.regions.includes(filter.region)
      )
        return false;
    }
    if (
      filter.institution &&
      filter.institution !== "all" &&
      row.mainOffice !== filter.institution &&
      !row.secondaryOffices.includes(filter.institution)
    )
      return false;
    if (
      filter.faction &&
      filter.faction !== "all" &&
      row.faction !== filter.faction
    )
      return false;
    if (
      filter.specialty &&
      filter.specialty !== "all" &&
      row.specialty !== filter.specialty
    )
      return false;
    if (filter.state && filter.state !== "all" && row.state !== filter.state)
      return false;
    return true;
  });
}

export type PersonnelSort =
  | "name"
  | "factionName"
  | "mainOfficeLabel"
  | "secondaryOfficeLabel"
  | "regionLabel"
  | "taskLabel"
  | "specialty"
  | "stateLabel"
  | "grievance"
  | "roots";

export function sortPersonnelRows(
  rows: PersonnelRow[],
  sort: PersonnelSort,
  direction: "asc" | "desc" = "asc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const first = a[sort],
      second = b[sort];
    const difference =
      typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second), "zh-CN");
    return difference * multiplier || a.id.localeCompare(b.id);
  });
}

export type PersonnelAppointmentAction =
  | Extract<Action, { type: "appoint" }>
  | { type: "concurrent"; office: string; person: string | null };

export interface AppointmentImpactDetails {
  changes: string[];
  vacancies: string[];
  lostCapabilities: string[];
  gainedCapabilities: string[];
  projectEffects: string[];
  politicalEffects: string[];
}

export function appointmentImpact(
  g: V2Game,
  office: string,
  person: string | null,
  mode: "primary" | "secondary" = "primary",
): AppointmentImpactDetails {
  const next = getPerson(person),
    position = getOffice(office);
  const oldId =
    mode === "secondary"
      ? g.machine.secondaryAppointments?.[office]
      : g.core.appointments[office];
  const old = getPerson(oldId),
    oldAssignments = oldId ? assignmentsFor(g, oldId) : undefined;
  const nextAssignments = person ? assignmentsFor(g, person) : undefined;
  const changes = [
    `${position?.name || office}：${old?.name || "空缺"} → ${next?.name || "空缺"}（${mode === "secondary" ? "正式兼职" : "主职"}）`,
  ];
  const vacancies: string[] = [],
    lostCapabilities: string[] = [],
    gainedCapabilities: string[] = [],
    projectEffects: string[] = [],
    politicalEffects: string[] = [];
  if (old && old.id !== person) {
    lostCapabilities.push(
      `${position?.name || office}失去${old.name}的专业与条件式能力`,
    );
    politicalEffects.push(`${factionNames[old.faction]}失去该职控制权`);
    if (mode === "primary" && (g.core.roots[old.id] ?? 0) >= 2)
      politicalEffects.push(`撤换已扎根的${old.name}会增加1积怨`);
    if (mode === "primary") {
      for (const secondary of oldAssignments?.secondaryOffices || []) {
        changes.push(
          `${old.name}失去主职，其${getOffice(secondary)?.name || secondary}兼职同步取消`,
        );
        vacancies.push(`${getOffice(secondary)?.name || secondary}将空缺`);
        lostCapabilities.push(
          `${getOffice(secondary)?.name || secondary}失去${old.name}的兼职行政能力`,
        );
      }
    }
  }
  if (!person) vacancies.push(`${position?.name || office}将空缺`);
  if (next) {
    gainedCapabilities.push(
      `${next.name}取得该职正式参与资格；${position?.domains.map((domain) => `${domainNames[domain]}专业${next.skills[domain]}`).join(" / ") || "职位未识别"}`,
    );
    politicalEffects.push(
      `${factionNames[next.faction]}取得该职控制权，同一人物不会重复计算派系人数`,
    );
    if (
      mode === "primary" &&
      nextAssignments?.mainOffice &&
      nextAssignments.mainOffice !== office
    )
      changes.push(
        `仍任${getOffice(nextAssignments.mainOffice)?.name}；本次不会自动调离，须先免去原主职`,
      );
    if (mode === "secondary")
      changes.push(
        `保留${getOffice(nextAssignments?.mainOffice || "")?.name || "原主职"}，两职共享同一份实际行动能力`,
      );
  }
  const affected = new Set([oldId, person].filter((id): id is string => !!id));
  for (const id of affected) {
    const assignment = assignmentsFor(g, id);
    const name = getPerson(id)?.name || id;
    for (const work of assignment.projects.filter(
      (item) => !item.completed && !item.cancelled,
    )) {
      if (work.assignment === "dedicated") {
        projectEffects.push(
          `${name}专职负责${personnelWorkNames[work.type]}，人事调整不会自动取消工程；行政能力仍暂停`,
        );
        continue;
      }
      const remaining = assignedOffices(g, id).filter(
        (held) =>
          held !== office &&
          !(
            mode === "primary" &&
            id === oldId &&
            assignment.secondaryOffices.includes(held)
          ),
      );
      if (id === person) remaining.push(office);
      const compatible = remaining.some((held) =>
        ["plan", `gov-${work.province}`].includes(held),
      );
      projectEffects.push(
        `${name}担任${personnelWorkNames[work.type]}顾问：${compatible ? "调整后仍有计划委或所在省资格，满足其他条件时可继续施工" : "调整后缺少计划委/所在省资格，施工将中断；可改派专职或恢复合适任职"}`,
      );
    }
    if (assignment.temporaryTask)
      projectEffects.push(
        `${name}已投入${assignment.temporaryTask.title}，任命不会提前释放本回合任务占用`,
      );
  }
  return {
    changes,
    vacancies,
    lostCapabilities,
    gainedCapabilities,
    projectEffects,
    politicalEffects,
  };
}

const condition = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});

export function concurrentConditions(
  g: V2Game,
  office: string,
  person: string | null,
): Condition[] {
  const position = getOffice(office),
    candidate = getPerson(person),
    current = g.machine.secondaryAppointments?.[office] || null;
  const assignment = person ? assignmentsFor(g, person) : undefined;
  const conditions = [
    condition(
      "真实兼职职位",
      !!position,
      "选择现有正式职位；兼职只能补充空缺机构",
    ),
    condition(
      "主职席位空缺",
      !!position && !g.core.appointments[office],
      "该机构已有主职负责人，先免职才能设兼职；每个机构仅一个正式负责人",
    ),
    condition("实际调整", current !== person, "兼职安排没有变化"),
  ];
  if (!person) return conditions;
  conditions.push(
    condition(
      "已有有效主职",
      !!candidate &&
        !!assignment?.mainOffice &&
        assignment.mainOffice !== office,
      "正式兼职必须依托另一项主职；空闲人物请直接任主职",
    ),
    condition(
      "最多一项正式兼职",
      !!assignment &&
        !assignment.secondaryOffices.some((held) => held !== office),
      "一人最多一个主职和一个兼职；请先取消其他兼职",
    ),
    condition(
      "专业适配",
      !!candidate &&
        !!position &&
        position.domains.some((domain) => candidate.skills[domain] >= 2),
      "目标机构至少一项责任领域专业达到2；不能仅凭正式任职替代专业能力",
    ),
    condition(
      "愿意履职",
      !!candidate && (g.core.grievances[person] ?? 0) < 3,
      "积怨达到3时无法兼任；先进行政治和解",
    ),
    condition(
      "有可投入行政能力",
      !!assignment &&
        !assignment.temporaryTask &&
        assignment.activeProject?.assignment !== "dedicated",
      "专职工程或本回合临时任务占用时不能新增兼职；结束或暂停工程、等待任务结算后再任命",
    ),
  );
  return conditions;
}

/** Resources, history and results remain the command engine's responsibility. */
export function applyConcurrent(
  g: V2Game,
  office: string,
  person: string | null,
  source: string,
): void {
  const errors = concurrentConditions(g, office, person).filter(
    (item) => !item.met,
  );
  if (errors.length)
    throw new Error(errors.map((item) => item.reason).join("；"));
  g.machine.secondaryAppointments ??= {};
  const old = g.machine.secondaryAppointments[office];
  g.machine.secondaryAppointments[office] = person;
  g.machine.origins[`secondary:${office}`] = source;
  if (person) g.machine.origins[`person:${person}`] = source;
  if (old) g.machine.origins[`person:${old}`] = source;
}

export function clearSecondaryAppointments(
  g: V2Game,
  person: string,
  source: string,
): string[] {
  const removed = offices
    .filter((office) => g.machine.secondaryAppointments?.[office.id] === person)
    .map((office) => office.id);
  for (const office of removed) {
    g.machine.secondaryAppointments![office] = null;
    g.machine.origins[`secondary:${office}`] = source;
  }
  return removed;
}
