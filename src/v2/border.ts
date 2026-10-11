import { transportConditions } from "./qualifications";
import { getPerson } from "../data";
import type { Condition, V2Game, V2Preview } from "./model";
import { hasDepartment, workOperating } from "./administration";
import { gridOperating } from "./fiscal";
import { assignmentsFor, officePerson } from "./personnel";
import { heldOffices, specialistCapability } from "./traits";

export interface BorderAction {
  type: "borderSupply";
  route: "rail" | "jianghu" | "local";
}
export const isBorder = (a: { type: string }): a is BorderAction =>
  a.type === "borderSupply";
const c = (label: string, met: boolean, reason: string): Condition => ({
  label,
  met,
  reason,
});
const corridorOpen = (g: V2Game) =>
  !g.machine.matters.some(
    (m) =>
      ["industry", "north"].includes(m.province) &&
      (m.isolated ||
        (["accident", "oldgod"].includes(m.kind) &&
          m.stage >= 3 &&
          m.containment === 0)),
  );
const officerAvailable = (g: V2Game, id: string | null) =>
  !!id && assignmentsFor(g, id).adminAvailable;
const routeNames = {
  rail: "铁路运输防线设备",
  jianghu: "江湖护送防线设备",
  local: "北境库存应急改装",
};

export function borderPreview(
  g: V2Game,
  a: BorderAction,
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
  const m = g.machine;
  const north = g.core.provinces.find((p) => p.id === "north");
  const industry = g.core.provinces.find((p) => p.id === "industry");
  const governor = officePerson(g, "gov-north");
  const planner = officePerson(g, "plan");
  const powered = m.works.find(
    (w) =>
      gridOperating(g, w) &&
      (w.contract?.beneficiary || "industry") === "industry",
  );
  const factory = m.works.find(
    (w) =>
      w.province === "industry" && w.type === "factory" && workOperating(g, w),
  );
  const rail = m.works.find(
    (w) =>
      w.type === "rail" &&
      workOperating(g, w) &&
      ((w.province === "industry" && w.to === "north") ||
        (w.province === "north" && w.to === "industry")),
  );
  const logistics = specialistCapability(g, "transport", "north").filter((id) =>
    ["ye", "yanxingzhou", "luchaosheng"].includes(id),
  );
  const messenger = logistics[0];
  const conditions: Condition[] = [
    c(
      "有效防线补给方式",
      ["rail", "jianghu", "local"].includes(a.route),
      "选择铁路、江湖护送或本地库存",
    ),
    c(
      "尚未动用该补给安排",
      !m.milestones.includes(`border-supply:${a.route}`),
      "每种补给安排只可登记一次，不能重复领取预留资格或物资",
    ),
    c(
      "北境实际负责人",
      officerAvailable(g, governor),
      "北境政府须有可履职负责人；专职派遣、即时占用或拒绝协办会使安排不可执行",
    ),
    c(
      "实际国防运作预算",
      m.departmentBudgets.defense > 0,
      "恢复国防基本预算才能组织防线工程与设备预留",
    ),
  ];
  const actors = governor ? [governor] : [];
  const institutions = ["gov-north", "defense"];
  const effects: string[] = [];
  const parents = [
    m.origins.reserve,
    m.origins.cooperation,
    m.origins.department,
  ].filter((x): x is string => !!x);
  const costs = {
    commands: 1,
    treasury: 0,
    capital: 0,
    stock: 0,
    province: undefined as "north" | undefined,
  };
  if (a.route === "local") {
    costs.stock = 2;
    costs.province = "north";
    conditions.push(
      c(
        "北境本地预留实物",
        !!north && north.stock >= 2,
        "北境库存至少2，实际转换为防线设备，不从中央财政补造物资",
      ),
      c(
        "本地改装专业资格",
        !!governor &&
          !!getPerson(governor) &&
          getPerson(governor)!.skills.anomaly >= 2,
        "北境负责人须具有异常专业至少2；没有技术人员不能将普通库存变成异常防护装备",
      ),
      c(
        "地方管理协议",
        m.rights.north && m.trust.north > 0 && !m.suppressed.north,
        "北境须保有本地收益管理权、基本信任及可用组织；中央不能绕过本地控制权征用库存",
      ),
    );
    effects.push(
      "北境实物-2，转换为本地控制的防线预留设备；无需依赖已中断的工业供能或铁路",
      "北境技术负责人获得本地设备协办资格；仍须满足档案、保密政策与异常预算条件",
    );
  } else {
    conditions.push(
      c(
        "实际工业供能",
        !!powered,
        "完成并保持南岭→工业省电网供能；电网停机、故障或供应省严重异常会中断设备制造",
      ),
      c(
        "实际工业设备产线",
        !!factory,
        "工业省必须有已竣工、标准兼容且未被隔离的工业改造设施",
      ),
      c(
        "工业库存与安全通道",
        !!industry && industry.stock >= 3 && corridorOpen(g),
        "工业省库存至少3；两端隔离或失控严重异常禁止通行，不能以物流技能突破灾害隔离",
      ),
    );
    if (powered) parents.push(powered.source);
    if (factory) parents.push(factory.source);
    if (a.route === "rail") {
      costs.treasury = 1;
      actors.push(...(planner ? [planner] : []));
      institutions.push("plan");
      if (rail) parents.push(rail.source);
      conditions.push(
        ...transportConditions(g, "industry", "north"),
        c(
          "实际跨省铁路",
          !!rail,
          "须完成直接连接工业省与北境的铁路；其他地区铁路不提供本次运输通道",
        ),
        c(
          "计划调度人员与预算",
          officerAvailable(g, planner) && m.departmentBudgets.plan > 0,
          "计划委须有实际在岗人员且保有基本调度预算",
        ),
        c(
          "运输标准与法定调配权",
          m.standards &&
            (m.regime === "vertical" ||
              hasDepartment(g, "transport", "north") ||
              (m.cooperation &&
                m.rights.industry &&
                m.rights.north &&
                g.core.policies.method === 1)),
          "兼容标准之外，还需中央运输事权或两端合作与收益协议；铁路本身不会自动授予征调权",
        ),
      );
      effects.push(
        "工业省实物-3、北境实物+2、运输损耗1；中央财政-1用于实际调度",
        "建立中央管理的防线设备预留；本地人员不能单凭库存取得中央设备关闭或高级收容权",
      );
    } else {
      costs.capital = 1;
      if (messenger) {
        actors.push(messenger);
        institutions.push(...heldOffices(g, messenger));
      }
      conditions.push(
        c(
          "江湖物流负责人实际参与",
          !!messenger,
          "叶冬、燕行舟或具备航路资格的陆潮生须在可履职职位上；被专职派遣、抽调或拒绝履职后私人承诺不可调用",
        ),
        c(
          "地方协作与私人承诺",
          m.cooperation &&
            g.core.policies.method === 1 &&
            m.rights.industry &&
            m.rights.north &&
            m.trust.north > 0 &&
            !m.suppressed.north,
          "须有协商政策、两端地方收益权、合作网络和基本信任；不能将江湖关系作为无条件国家征调",
        ),
      );
      effects.push(
        "工业省实物-3、北境实物+2、护送损耗1；政治资本-1履行私人运输承诺",
        "物流负责人本回合被护送占用；北境与协作组织共同管理预留设备，可由合格本地人员协办异常收容",
      );
    }
  }
  return {
    title: routeNames[a.route] || "未知防线补给",
    conditions,
    costs,
    actors: [...new Set(actors)],
    institutions: [...new Set(institutions)],
    effects,
    parents: [...new Set(parents)],
  };
}

/** The engine pays the preview costs first, including local stock-2. */
export function applyBorder(
  g: V2Game,
  a: BorderAction,
  source: string,
): string[] {
  const validation = a.route === "local" ? structuredClone(g) : g;
  if (a.route === "local")
    validation.core.provinces.find((p) => p.id === "north")!.stock += 2;
  const preview = borderPreview(validation, a);
  if (preview.conditions.some((c) => !c.met))
    throw new Error(
      preview.conditions
        .filter((c) => !c.met)
        .map((c) => c.reason)
        .join("；"),
    );
  if (a.route !== "local") {
    g.core.provinces.find((p) => p.id === "industry")!.stock -= 3;
    g.core.provinces.find((p) => p.id === "north")!.stock += 2;
  }
  const m = g.machine;
  m.reserve = true;
  m.origins.reserve = source;
  m.origins["border-reserve"] = source;
  m.milestones = m.milestones.filter(
    (mark) => !mark.startsWith("border-owner:"),
  );
  m.milestones.push(
    `border-supply:${a.route}`,
    `border-owner:${a.route === "rail" ? "central" : a.route === "local" ? "north" : "joint"}`,
  );
  if (!m.milestones.includes("border-network"))
    m.milestones.push("border-network");
  for (const id of preview.actors) m.occupied[id] = source;
  return preview.effects;
}

/** Equipment ownership changes the eligible local collaborator, not just damage. */
export function borderSealActors(g: V2Game, actors?: string[]) {
  const m = g.machine,
    governor = officePerson(g, "gov-north");
  if (
    !m.reserve ||
    !m.milestones.includes("border-network") ||
    !m.milestones.some((mark) =>
      ["border-owner:north", "border-owner:joint"].includes(mark),
    ) ||
    !governor ||
    !officerAvailable(g, governor) ||
    (actors && !actors.includes(governor)) ||
    !m.knowledge ||
    m.departmentBudgets.anomaly === 0 ||
    m.departmentBudgets.defense === 0 ||
    g.core.policies.disclosure === 1 ||
    !m.rights.north ||
    m.trust.north < 1 ||
    m.suppressed.north ||
    (getPerson(governor)?.skills.anomaly || 0) < 2
  )
    return [];
  return [governor];
}
