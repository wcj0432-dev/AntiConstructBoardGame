import type { Matter, V2Game } from "./model";
/** Shared with settlement. Facts under the current protection configuration, no random draws. */
export function crisisStep(g: V2Game, m: Matter) {
  const staged = ![
    "gazette",
    "opportunity",
    "warning",
    "final",
    "energyFault",
    "fiscalClaim",
  ].includes(m.kind);
  const escalating = staged && !m.isolated && m.containment === 0;
  const stage = escalating ? Math.min(4, m.stage + 1) : m.stage;
  const station = g.machine.works.some(
    (w) =>
      w.type === "warning" &&
      w.province === m.province &&
      w.completed &&
      !w.cancelled,
  );
  const severity = Math.max(
    1,
    (m.evacuated || station ? 1 : stage >= 3 ? 2 : 1) -
      (g.machine.departmentBudgets.anomaly === 2 ? 1 : 0) -
      (g.machine.drillsUntil >= g.core.turn ? 1 : 0) -
      (g.machine.discoveries[m.province].includes("anomaly") ? 1 : 0),
  );
  const rails = g.machine.works.filter(
    (w) =>
      w.type === "rail" &&
      w.completed &&
      !w.cancelled &&
      w.to &&
      [w.province, w.to].includes(m.province),
  );
  const propagation =
    escalating && stage >= 3
      ? rails.map((w) => ({
          work: w.id,
          to: w.province === m.province ? w.to! : w.province,
        }))
      : [];
  const grids = g.machine.works.filter(
    (w) =>
      w.type === "grid" &&
      !w.cancelled &&
      [w.province, w.to ?? "industry"].includes(m.province),
  );
  return {
    propagation,
    linkedWorks: [...rails, ...grids].map((w) => w.id),
    staged,
    escalating,
    stage,
    crisis: escalating ? severity : 0,
    paralysis: escalating && stage >= 3 && !m.evacuated ? 1 : 0,
    stock: escalating && stage >= 2 ? 1 : 0,
    label: !staged
      ? ((
          {
            energyFault: "已发生电网故障，须组织真实维修",
            fiscalClaim: "财政诉求，按当前账户与管理权处理",
            warning: "公开预警，后续触发按原事件规则",
            final: "正式终局事项，按国家目标验收",
            opportunity: "主动发展机会，条件由具体方案判定",
            gazette: "普通政务，可能改变实际协议与制度",
          } as Record<string, string>
        )[m.kind] ?? "按具体事件规则处理")
      : m.isolated
        ? "持续隔离；暂停升级，本地停产"
        : m.containment > 0
          ? `本次受控；遏制余量${m.containment} → ${m.containment - 1}`
          : `当前防护不变：阶段${m.stage} → ${stage}`,
    certainty: staged
      ? "已知升级规则；新设施竣工、有效演习或其他本次操作可能改变防护。未来随机议程仍未知。"
      : "此类事务没有额外的四阶段升级惩罚；实际费用和权限以方案预览为准，未揭示风险仍未知。",
  };
}
