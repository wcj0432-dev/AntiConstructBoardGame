import type { V2Game } from "./model";
import { getPerson } from "../data";
import { facilityOperating } from "./operations";
import { assignmentsFor, officePerson } from "./personnel";
import { workFunding } from "./fiscal";
import { specialistCapability } from "./traits";
export interface PoliticalStory {
  id: string;
  title: string;
  phase: string;
  fact: string;
  origins: string[];
  panel: "finance" | "staff" | "goals" | "matters";
  province?: "industry" | "south" | "north";
}
/** Narrative chapters are projections of contracts, courses and actual joint work, not another reward counter. */
export function politicalStories(g: V2Game): PoliticalStory[] {
  const m = g.machine,
    out: PoliticalStory[] = [];
  const asset = m.works.find(
    (w) =>
      !w.cancelled &&
      ["cult", "joint", "multi", "local"].includes(workFunding(g, w).mode),
  );
  if (asset) {
    const academy = m.works.some(
      (w) =>
        w.type === "academy" &&
        w.province === asset.province &&
        facilityOperating(g, w),
    );
    const conflict =
      (asset.maintenance?.arrears ?? 0) > 0 || !m.rights[asset.province];
    out.push({
      id: "civilization-contract",
      title: "宗门自治与统一工程",
      phase: conflict
        ? "履约与权利争议"
        : academy
          ? "知识与工程共同体"
          : asset.completed
            ? "从建设走向经营"
            : "共同出资的起点",
      fact: `${asset.id}的真实${workFunding(g, asset).mode}合同仍由${workFunding(g, asset).owner}经营。${conflict ? "欠付或地方权利缺失正在影响能力。" : academy ? "同省学院已实际运营，产权协作进入知识传承阶段。" : "后续教育、收益和维护取决于您的实际决定。"}`,
      origins: [
        asset.source,
        ...(m.relationships
          ?.filter((r) => r.province === asset.province)
          .map((r) => r.source) ?? []),
      ],
      panel: "finance",
      province: asset.province,
    });
  }
  const publicRescue = m.history.find(
    (h) =>
      h.title.includes("公开") &&
      h.actors.some((id) => ["xing", "suyi"].includes(id)),
  );
  if (
    publicRescue ||
    (Object.values(g.core.appointments).includes("xing") && m.suppressed.south)
  ) {
    out.push({
      id: "rescue-security",
      title: "救援社团与安全机关",
      phase: m.suppressed.south
        ? "被压制的地方组织"
        : m.drillsUntil >= g.core.turn
          ? "共同演习的同僚"
          : m.cooperation && g.core.policies.disclosure === 1
            ? "公开协作的制度化"
            : "谁有权公开消息",
      fact: m.suppressed.south
        ? "南岭群众组织实际受压制，群众能力已受限制。"
        : `当前公开政策${g.core.policies.disclosure === 1 ? "生效" : "未生效"}，合作渠道${m.cooperation ? "有效" : "尚未建立"}。${m.drillsUntil >= g.core.turn ? "真实应急演习仍在有效期。" : "如要进一步协作，须有实际权限、政策与共同工作。"}`,
      origins: [publicRescue?.id ?? m.origins["suppressed:south"] ?? ""].filter(
        Boolean,
      ),
      panel: "matters",
      province: "south",
    });
  }
  const course = m.trainings?.find(
    (t) =>
      t.student &&
      t.mentor &&
      ["active", "paused", "completed"].includes(t.state),
  );
  if (course) {
    const mentor = assignmentsFor(g, course.mentor!),
      graduate = course.state === "completed",
      successor =
        graduate &&
        !!course.student &&
        specialistCapability(g, course.cap, course.province, [course.student])
          .length > 0;
    out.push({
      id: "academy-succession",
      title: "国家学院的继任问题",
      phase: successor
        ? "学员已经走上岗位"
        : graduate
          ? "毕业以后，岗位以前"
          : !mentor.adminAvailable
            ? "导师离任或被抽调"
            : "具体名字的传承",
      fact: `${getPerson(course.mentor)?.name}→${getPerson(course.student)?.name}，真实进度${course.progress}/${course.duration}。${graduate ? "个人资质已形成；能否替任还要检查对应专业岗位。" : "课程是否推进由当前教学条件决定，故事不会赠送毕业资质。"}${officePerson(g, "plan") === course.student ? "这位学员目前主持计划委员会。" : ""}`,
      origins: [course.source],
      panel: "staff",
      province: course.province,
    });
  }
  return out;
}
