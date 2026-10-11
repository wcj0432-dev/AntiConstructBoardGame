import { describe, expect, it } from "vitest";
import { people } from "../data";
import {
  deserializeV2,
  executeCommand,
  newV2,
  previewAction,
  serializeV2,
} from "./engine";
import type { Action, V2Game, Work } from "./model";
import {
  appointmentImpact,
  applyConcurrent,
  assignedOffices,
  assignmentsFor,
  clearSecondaryAppointments,
  concurrentConditions,
  filterPersonnelRows,
  officePerson,
  personnelRows,
  sortPersonnelRows,
} from "./personnel";
import { personMechanics } from "./traits";

function state(): V2Game {
  const g = newV2("national", "spark", "人事统一模型-v05");
  for (const office of Object.keys(g.core.appointments))
    g.core.appointments[office] = null;
  g.core.appointments.plan = "mo";
  g.core.appointments["gov-industry"] = "zhou";
  g.machine.secondaryAppointments = {};
  return g;
}

function work(overrides: Partial<Work> = {}): Work {
  return {
    id: "work-personnel",
    type: "energy",
    province: "south",
    worker: "mo",
    assignment: "advisor",
    progress: 1,
    duration: 2,
    paused: false,
    completed: false,
    source: "decision-project",
    ...overrides,
  };
}

const permitted = (g: V2Game, office: string, person: string | null) =>
  concurrentConditions(g, office, person).every((condition) => condition.met);

describe("v0.5 全国人事与真实有限兼职", () => {
  it("总览包含全部正式可用人物，旧存档没有兼职字段仍可读取", () => {
    const g = state();
    delete g.machine.secondaryAppointments;
    const rows = personnelRows(g);
    expect(rows).toHaveLength(people.length);
    expect(rows.find((row) => row.id === "mo")).toMatchObject({
      mainOffice: "plan",
      secondaryOffices: [],
      adminAvailable: true,
    });
    expect(rows.every((row) => row.name && row.ability)).toBe(true);
    expect(rows.find((row) => row.id === "chenjiliang")?.ability).toBe(
      "账外账",
    );
  });

  it("正式兼职补空缺职位，并共享同一个人而非制造第二名工作人员", () => {
    const g = state(),
      before = structuredClone(g.core.appointments);
    expect(permitted(g, "anomaly", "mo")).toBe(true);
    applyConcurrent(g, "anomaly", "mo", "decision-side");
    expect(officePerson(g, "anomaly")).toBe("mo");
    expect(assignedOffices(g, "mo")).toEqual(["plan", "anomaly"]);
    expect(g.core.appointments).toEqual(before);
    expect(assignmentsFor(g, "mo").state).toBe("concurrent");
    expect(personnelRows(g).filter((row) => row.id === "mo")).toHaveLength(1);
    expect(g.machine.origins["secondary:anomaly"]).toBe("decision-side");
  });

  it("没有主职、已被主职占据或专业不足的兼职请求不能生效", () => {
    const g = state();
    expect(permitted(g, "anomaly", "bai")).toBe(false);
    expect(permitted(g, "plan", "zhou")).toBe(false);
    g.core.appointments.anomaly = "sergei";
    g.core.appointments.plan = null;
    expect(permitted(g, "plan", "sergei")).toBe(false);
    const before = structuredClone(g.machine.secondaryAppointments);
    expect(() => applyConcurrent(g, "plan", "sergei", "bad")).toThrow();
    expect(g.machine.secondaryAppointments).toEqual(before);
  });

  it("每人最多一个兼职，取消后才可换兼另一机构；替换不改变双方主职", () => {
    const g = state();
    applyConcurrent(g, "anomaly", "mo", "side-1");
    expect(permitted(g, "gov-south", "mo")).toBe(false);
    applyConcurrent(g, "anomaly", "zhou", "side-replacement");
    expect(assignedOffices(g, "mo")).toEqual(["plan"]);
    expect(g.core.appointments["gov-industry"]).toBe("zhou");
    applyConcurrent(g, "gov-south", "mo", "side-2");
    expect(permitted(g, "gov-north", "mo")).toBe(false);
    applyConcurrent(g, "gov-south", null, "cancel-side");
    expect(permitted(g, "gov-north", "mo")).toBe(true);
    expect(permitted(g, "gov-south", null)).toBe(false);
  });

  it("顾问可行政兼任，专职派遣与临时占用真实限制新增兼职", () => {
    const g = state();
    g.machine.works.push(work());
    expect(assignmentsFor(g, "mo")).toMatchObject({
      state: "advisor",
      adminAvailable: true,
      projectAvailable: false,
    });
    expect(permitted(g, "anomaly", "mo")).toBe(true);
    g.machine.works[0].assignment = "dedicated";
    expect(assignmentsFor(g, "mo")).toMatchObject({
      state: "dedicated",
      adminAvailable: false,
    });
    expect(permitted(g, "anomaly", "mo")).toBe(false);
    g.machine.works[0].paused = true;
    expect(permitted(g, "anomaly", "mo")).toBe(true);
    g.machine.occupied.mo = "immediate-task";
    expect(assignmentsFor(g, "mo").state).toBe("temporary");
    expect(permitted(g, "anomaly", "mo")).toBe(false);
    delete g.machine.occupied.mo;
    g.core.grievances.mo = 3;
    expect(assignmentsFor(g, "mo").state).toBe("restricted");
    expect(permitted(g, "anomaly", "mo")).toBe(false);
  });

  it("暂停、取消与竣工释放工程占用，未结算的临时任务不会被释放", () => {
    const g = state();
    const project = work({ assignment: "dedicated" });
    g.machine.works.push(project);
    for (const field of ["paused", "cancelled", "completed"] as const) {
      project[field] = true;
      expect(assignmentsFor(g, "mo").adminAvailable).toBe(true);
      expect(assignmentsFor(g, "mo").projectAvailable).toBe(true);
      project[field] = false;
    }
    project.completed = true;
    g.machine.occupied.mo = "real-temporary-task";
    expect(assignmentsFor(g, "mo").adminAvailable).toBe(false);
    expect(
      personnelRows(g).find((row) => row.id === "mo")?.taskLabel,
    ).not.toContain("宗门灵脉能源工程");
  });

  it("临时任务来源和有效承诺来自同一保存状态，并与特征实际可用性一致", () => {
    const g = state();
    applyConcurrent(g, "gov-south", "mo", "side");
    g.machine.rights.south = true;
    g.machine.budgets.push("south");
    g.machine.history.unshift({
      id: "temporary",
      turn: 1,
      title: "南岭资源普查",
      actors: ["mo"],
      institutions: ["gov-south"],
      conditions: [],
      effects: [],
      parents: [],
    });
    g.machine.occupied.mo = "temporary";
    const row = personnelRows(g).find((entry) => entry.id === "mo")!;
    expect(row.taskLabel).toBe("南岭资源普查");
    expect(row.promises).toHaveLength(2);
    expect(row.adminAvailable).toBe(
      personMechanics(g, "mo", "south").available,
    );
    const loaded = JSON.parse(JSON.stringify(g)) as V2Game;
    expect(personnelRows(loaded).find((entry) => entry.id === "mo")).toEqual(
      row,
    );
    delete loaded.machine.occupied.mo;
    expect(assignmentsFor(loaded, "mo").adminAvailable).toBe(true);
  });

  it("筛选机构包括正式兼职，派驻包括工程地区，组合筛选不会遗漏状态", () => {
    const g = state();
    applyConcurrent(g, "gov-south", "mo", "side");
    g.machine.works.push(work({ type: "factory", province: "industry" }));
    const rows = personnelRows(g);
    expect(
      filterPersonnelRows(rows, {
        region: "industry",
        institution: "gov-south",
        faction: "technocrat",
        specialty: "production",
        state: "advisor",
      }).map((row) => row.id),
    ).toEqual(["mo"]);
    expect(
      filterPersonnelRows(rows, { search: "符阵工程勘定" }).map(
        (row) => row.id,
      ),
    ).toEqual(["mo"]);
    expect(
      filterPersonnelRows(rows, { region: "unassigned" }).every(
        (row) => !row.regions.length,
      ),
    ).toBe(true);
  });

  it("积怨与根基排序使用数值，筛选和排序不修改保存状态或原数组", () => {
    const g = state();
    g.core.grievances.mo = 3;
    g.core.grievances.zhou = 1;
    g.core.roots.zhou = 3;
    const before = JSON.stringify(g),
      rows = personnelRows(g),
      ids = rows.map((row) => row.id);
    expect(
      sortPersonnelRows(rows, "grievance", "desc")
        .slice(0, 2)
        .map((row) => row.id),
    ).toEqual(["mo", "zhou"]);
    expect(sortPersonnelRows(rows, "roots", "desc")[0].id).toBe("zhou");
    expect(rows.map((row) => row.id)).toEqual(ids);
    expect(JSON.stringify(g)).toBe(before);
  });

  it("免主职预览列出兼职空缺、失去能力和顾问中断，但不会自动修改工程", () => {
    const g = state();
    applyConcurrent(g, "anomaly", "mo", "side");
    g.machine.works.push(work());
    g.core.roots.mo = 2;
    const before = JSON.stringify(g);
    const impact = appointmentImpact(g, "plan", null);
    expect(impact.vacancies).toContain("国家异常事务局将空缺");
    expect(
      impact.projectEffects.some((effect) => effect.includes("施工将中断")),
    ).toBe(true);
    expect(
      impact.politicalEffects.some((effect) => effect.includes("增加1积怨")),
    ).toBe(true);
    expect(JSON.stringify(g)).toBe(before);
    expect(clearSecondaryAppointments(g, "mo", "dismiss")).toEqual(["anomaly"]);
    g.core.appointments.plan = null;
    expect(officePerson(g, "anomaly")).toBeNull();
    expect(g.machine.works[0]).toMatchObject({
      progress: 1,
      paused: false,
      completed: false,
    });
  });

  it("调离专职工程师保留项目事实，新职不会立即获得已占用的行政能力", () => {
    const g = state();
    g.machine.works.push(work({ assignment: "dedicated" }));
    const impact = appointmentImpact(g, "plan", null);
    expect(
      impact.projectEffects.some((effect) =>
        effect.includes("不会自动取消工程"),
      ),
    ).toBe(true);
    g.core.appointments.plan = null;
    g.core.appointments["gov-south"] = "mo";
    expect(assignmentsFor(g, "mo").adminAvailable).toBe(false);
    g.machine.works[0].completed = true;
    expect(assignmentsFor(g, "mo").adminAvailable).toBe(true);
  });

  it("无效双重占位不会让总览和能力判定看到两个机构负责人", () => {
    const g = state();
    g.machine.secondaryAppointments = { plan: "zhou" };
    expect(officePerson(g, "plan")).toBe("mo");
    expect(assignedOffices(g, "zhou")).toEqual(["gov-industry"]);
    expect(assignmentsFor(g, "zhou").secondaryOffices).toEqual([]);
    expect(personMechanics(g, "zhou").offices).toEqual(["gov-industry"]);
  });
});

describe("v0.5 正式兼职通过真实命令履职", () => {
  const command = (g: V2Game, action: Action) => {
    const execution = executeCommand(g, action);
    expect(
      execution.result.status,
      execution.result.errors.join("；"),
    ).not.toBe("failed");
    return execution.game;
  };

  it("免空省政府后计划主管可正式兼任，下一回合真实主持地方检修并按预览扣费", () => {
    let g = newV2("national", "spark", "正式兼职-真实地方主持");
    g = command(g, { type: "appoint", office: "gov-south", person: null });
    g = command(g, { type: "concurrent", office: "gov-south", person: "lin" });
    expect(g.core.appointments["gov-south"]).toBeNull();
    expect(officePerson(g, "gov-south")).toBe("lin");
    expect(g.core.appointments.plan).toBe("lin");
    g = command(g, { type: "end" });
    expect(g.core.turn).toBe(2);
    expect(g.machine.occupied.lin).toBeUndefined();
    expect(personnelRows(g).find((row) => row.id === "lin")).toMatchObject({
      mainOffice: "plan",
      secondaryOffices: ["gov-south"],
      adminAvailable: true,
    });
    const warning = g.machine.matters.find(
      (matter) => matter.kind === "warning",
    )!;
    const action: Action = {
      type: "resolve",
      matter: warning.id,
      option: "repair",
    };
    const preview = previewAction(g, action);
    expect(preview.errors).toEqual([]);
    expect(preview.actors).toContain("lin");
    expect(preview.institutions).toContain("gov-south");
    expect(
      preview.conditions.find(
        (condition) => condition.label === "主持职位有人履职",
      )?.met,
    ).toBe(true);
    const treasury = g.core.treasury,
      commands = g.core.commands,
      stock = g.core.provinces.find(
        (province) => province.id === "south",
      )!.stock;
    const execution = executeCommand(g, action);
    expect(execution.result.status).toBe("resolved");
    g = execution.game;
    expect(g.core.treasury).toBe(treasury - preview.costs.treasury);
    expect(g.core.commands).toBe(commands - preview.costs.commands);
    expect(
      g.core.provinces.find((province) => province.id === "south")!.stock,
    ).toBe(stock - preview.costs.stock);
    expect(g.machine.matters.some((matter) => matter.id === warning.id)).toBe(
      false,
    );
    expect(g.machine.archive.some((matter) => matter.id === warning.id)).toBe(
      true,
    );
    expect(assignedOffices(g, "lin")).toEqual(["plan", "gov-south"]);
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });

  it("在任国安主管可正式兼任空缺异常局，兼职中央主管真实调查产生档案事务及地方代价", () => {
    let g = newV2("national", "night", "正式兼职-真实中央调查");
    g = command(g, { type: "appoint", office: "anomaly", person: null });
    g = command(g, { type: "concurrent", office: "anomaly", person: "lu" });
    g = command(g, { type: "end" });
    expect(g.core.appointments.anomaly).toBeNull();
    expect(g.core.appointments.defense).toBe("lu");
    expect(officePerson(g, "anomaly")).toBe("lu");
    expect(assignedOffices(g, "lu")).toEqual(["defense", "anomaly"]);
    expect(personnelRows(g).find((row) => row.id === "lu")).toMatchObject({
      mainOffice: "defense",
      secondaryOffices: ["anomaly"],
      adminAvailable: true,
    });
    const action: Action = { type: "investigate", deck: "archive" };
    const preview = previewAction(g, action),
      commands = g.core.commands,
      treasury = g.core.treasury,
      trust = g.machine.trust.north;
    expect(preview.errors).toEqual([]);
    expect(
      preview.conditions.find((condition) => condition.label === "主管机构有人")
        ?.met,
    ).toBe(true);
    const execution = executeCommand(g, action);
    expect(execution.result.status).toBe("applied");
    g = execution.game;
    expect(g.core.commands).toBe(commands - preview.costs.commands);
    expect(g.core.treasury).toBe(treasury - preview.costs.treasury);
    expect(g.machine.trust.north).toBe(trust - 1);
    expect(g.machine.knowledge).toBe(true);
    expect(
      [...g.machine.matters, ...g.machine.backlog].some(
        (matter) =>
          matter.kind === "gazette" &&
          matter.province === "north" &&
          matter.variant === "dream" &&
          !!matter.source,
      ),
    ).toBe(true);
    expect(officePerson(g, "anomaly")).toBe("lu");
    expect(deserializeV2(serializeV2(g))).toEqual(g);
  });
});
