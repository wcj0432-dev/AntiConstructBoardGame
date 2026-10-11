import { hasCredential } from "./training";
import { transportConditions } from "./qualifications";
import { people } from "../data";
import type { ProvinceId } from "../types";
import { hasDepartment, workOperating, workSpecs } from "./administration";
import { gridOperating, nationalForecast } from "./fiscal";
import type { Capability, Condition, Goal, V2Game, Work } from "./model";
import { assignmentsFor, officePerson } from "./personnel";
import { specialistCapability } from "./traits";

const provinces: ProvinceId[] = ["industry", "south", "north"];
const condition = (
  label: string,
  met: boolean,
  reason: string,
  source?: string,
): Condition => ({ label, met, reason, source });

/** These are the same physical blockers checked by an actual railway transfer. */
function regionPassable(g: V2Game, province: ProvinceId) {
  return !g.machine.matters.some(
    (matter) =>
      matter.province === province && (matter.isolated || matter.stage >= 3),
  );
}

function usableRail(g: V2Game, work: Work) {
  return (
    work.type === "rail" &&
    !!work.to &&
    work.to !== work.province &&
    workOperating(g, work) &&
    regionPassable(g, work.province) &&
    regionPassable(g, work.to)
  );
}

/** A port elsewhere does not count as a connection to a completed railway. */
function railNetwork(g: V2Game): ProvinceId[] {
  const rails = g.machine.works.filter((work) => usableRail(g, work));
  return [...new Set(rails.flatMap((work) => [work.province, work.to!]))];
}

function usableGrid(g: V2Game, regions?: ProvinceId[]) {
  return g.machine.works.some(
    (work) =>
      work.type === "grid" &&
      gridOperating(g, work) &&
      (!regions || regions.includes(work.province)),
  );
}

const trainingCaps: Capability[] = ["leywork", "mobilize", "seal"];
const inherentSpecialists: Partial<Record<Capability, string[]>> = {
  leywork: ["mo", "bai", "linruoxu"],
  mobilize: ["xing", "suyi"],
  seal: ["sergei", "qi"],
};

/** The training must actually unlock a successor, rather than counting its teacher's name. */
function successorAvailable(g: V2Game, cap: Capability) {
  if (
    !(g.machine.trainings ?? []).some(
      (t) => t.cap === cap && t.state === "completed",
    )
  )
    return false;
  const candidates = people
    .filter((person) => !inherentSpecialists[cap]?.includes(person.id))
    .map((person) => person.id);
  const regions = cap === "leywork" ? (["south"] as ProvinceId[]) : provinces;
  return regions.some(
    (province) => specialistCapability(g, cap, province, candidates).length > 0,
  );
}

function fiscalOrganizationsReady(g: V2Game) {
  const fiscal = g.machine.fiscal;
  if (!fiscal || g.machine.departmentBudgets.plan === 0) return false;
  const governorsAvailable = provinces.every((province) => {
    const governor = officePerson(g, `gov-${province}`);
    return !!governor && assignmentsFor(g, governor).adminAvailable;
  });
  const plan = officePerson(g, "plan");
  if (!plan || !assignmentsFor(g, plan).adminAvailable || !governorsAvailable)
    return false;
  if (fiscal.taxSystem === "central")
    return (
      g.machine.regime === "vertical" &&
      g.core.paralysis < 2 &&
      provinces.every((province) => g.machine.trust[province] > 0)
    );
  if (fiscal.taxSystem === "autonomy")
    return (
      g.core.policies.authority === 1 &&
      g.core.policies.method === 1 &&
      g.machine.cooperation &&
      provinces.every(
        (province) =>
          g.machine.rights[province] && g.machine.trust[province] >= 2,
      )
    );
  return (
    g.machine.cooperation &&
    g.core.policies.method === 1 &&
    provinces.every((province) => g.machine.trust[province] > 0)
  );
}

/** Original campaign milestones remain owned by the existing engine. */
export function expandedMilestones(g: V2Game, goal: Goal): Condition[] {
  const m = g.machine;
  if (goal === "traffic") {
    const connected = railNetwork(g);
    const grid = usableGrid(g, connected);
    return [
      condition(
        "真实跨省铁路通行",
        connected.length >= 2,
        "完成连接不同省份的符阵铁路；两端不得被隔离或阶段3危机阻断",
      ),
      condition(
        "港口与铁路实际联运",
        m.works.some(
          (work) =>
            work.type === "port" &&
            connected.includes(work.province) &&
            workOperating(g, work),
        ),
        "在铁路沿线完成浮空贸易港，维持当地收益权、信任2和营业条件",
      ),
      condition(
        "可执行的跨省运输规则",
        connected.length >= 2 &&
          m.works.some(
            (w) =>
              w.type === "rail" &&
              !!w.to &&
              transportConditions(g, w.province, w.to).every((c) => c.met),
          ) &&
          m.standards &&
          m.cooperation &&
          g.core.policies.method === 1 &&
          m.departmentBudgets.plan > 0 &&
          connected.every(
            (province) =>
              m.rights[province] &&
              m.trust[province] > 0 &&
              (hasDepartment(g, "transport", province) || m.regime === "joint"),
          ),
        "建立兼容标准和合作渠道，保留沿线收益权；运输改革覆盖两端，或采用联合体制",
        m.origins.department || m.origins.cooperation,
      ),
      condition(
        "灵能供电与可用物流专家",
        grid &&
          connected.some(
            (province) =>
              specialistCapability(g, "transport", province).length > 0,
          ),
        "完成沿线灵能电网并保持正常运行；叶冬、燕行舟或具备航线条件的陆潮生须有合法职位且能实际履职",
      ),
    ];
  }
  if (goal === "learning") {
    const academyRegions = [
      ...new Set(
        m.works
          .filter((work) => work.type === "academy" && workOperating(g, work))
          .map((work) => work.province),
      ),
    ];
    const trained = trainingCaps.filter((cap) =>
      (m.trainings ?? []).some(
        (t) =>
          t.cap === cap &&
          t.state === "completed" &&
          !!t.student &&
          hasCredential(g, t.student, cap as "leywork" | "mobilize" | "seal"),
      ),
    );
    return [
      condition(
        "跨省专业教育设施",
        academyRegions.length >= 2,
        "在两个不同省份完成且实际运营的专业学院；取消或被隔离的设施不计入",
      ),
      condition(
        "不同专业的真实传承",
        trained.length >= 2,
        "通过云松、陶祈或许照的真实教习，建立灵脉、救援、收容中至少两类专业传承",
      ),
      condition(
        "可持续的跨组织教学渠道",
        academyRegions.length >= 2 &&
          m.cooperation &&
          g.core.policies.method === 1 &&
          academyRegions.every(
            (province) =>
              m.rights[province] &&
              m.trust[province] >= 2 &&
              !m.suppressed[province],
          ),
        "保持合作与协商制度，学院所在地保有收益权、信任2，群众组织未被压制",
        m.origins.cooperation,
      ),
      condition(
        "供电与关键能力继任者",
        usableGrid(g) && trained.some((cap) => successorAvailable(g, cap)),
        "电网须正常运行；至少一类已传承专业有原专家之外的合格继任者，并保有实际可用的专业职位、政策和地方条件",
      ),
    ];
  }
  if (goal === "prosperity") {
    const fiscal = m.fiscal;
    const forecast = nationalForecast(g);
    const incomeFacilities = m.works.filter(
      (work) =>
        workSpecs[work.type].income > 0 &&
        (work.type === "grid"
          ? gridOperating(g, work)
          : workOperating(g, work)),
    );
    return [
      condition(
        "税制与行政组织配合",
        fiscalOrganizationsReady(g),
        "中央集税须有可用垂直审批；共享税源须有合作协商；地方自留还须分权政策与各省收益权。计划委和三个省政府须能履职",
      ),
      condition(
        "分布式持续营业税基",
        incomeFacilities.length >= 2 &&
          new Set(incomeFacilities.map((work) => work.province)).size >= 2,
        "在至少两省维持两处真实产生收入的设施；关停、隔离、失去合作的企业不能充当税基",
      ),
      condition(
        "连续稳定的国家结算",
        !!fiscal && fiscal.settlements >= 3 && fiscal.stableTurns >= 3,
        "完成至少三次连续无中央或地方违约的真实结算；临时现金注入不能代替结算记录",
      ),
      condition(
        "供电与地方公共支付能力",
        usableGrid(g) &&
          forecast.locals.length === provinces.length &&
          !forecast.default &&
          forecast.locals.every((local) => !local.default && local.next > 0),
        "灵能电网须正常运行；中央与三省都能按实际账本支付下一次公共支出，地方结余须大于0",
      ),
    ];
  }
  return [];
}
