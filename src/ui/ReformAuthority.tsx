import { useState } from "react";
import { getOffice, getPerson, offices } from "../data";
import type { ProvinceId } from "../types";
import { participants } from "../v2/engine";
import { regimes } from "../v2/data";
import { hasDepartment } from "../v2/administration";
import type { Action, Department, Regime, V2Game } from "../v2/model";
import { ActionButton } from "./AdministrativeConsole";
export function reformImpact(g: V2Game, a: Action) {
  const scope =
    a.type === "authorize"
      ? g.machine.matters.find((x) => x.id === a.matter)?.province
      : a.type === "local"
        ? a.province
        : a.type === "department"
          ? a.scope
          : undefined;
  const regions =
    scope && scope !== "nation" ? [scope] : g.core.provinces.map((p) => p.id);
  const area = regions
    .map((pid) => g.core.provinces.find((p) => p.id === pid)!.name)
    .join("、");
  if (a.type === "authorize")
    return {
      nature: "临时行政授权",
      area,
      field: "选中的具体事务",
      time: "立即生效，本回合结算后到期",
      gain: `${getOffice(a.lead).name}获得主持权${a.joint ? "，中央与地方正式协办" : ""}`,
      loss: "原主管退出主持；授权不创造人才、技术、异省收益权或越过能力前置",
      politics: a.emergency
        ? "紧急强制仍会按具体执行方案增加反对者积怨"
        : "审批关系临时变化，不永久改动制度",
    };
  if (a.type === "local")
    return {
      nature: "部门与地区的制度性改革",
      area,
      field: "本省异常主责",
      time: "立即生效，持续到国家基础体制过渡完成",
      gain: `${getOffice(a.lead).name}获得本省长期异常主责`,
      loss: "旧本省主持权被替代，不自动赋予跨省指挥",
      politics:
        "改变今后同省异常事务的正式参与人员与能力；后续国家体制改革重置此主责",
    };
  if (a.type === "department")
    return {
      nature: "部门与地区的制度性改革",
      area,
      field: {
        anomaly: "异常处置与工程审批接口",
        evacuation: "灾害疏散与地方快速应急",
        transport: "兼容运输与跨省资源调配",
      }[a.department],
      time: "下一回合生效，长期有效，可与其他领域改革并存",
      gain: {
        anomaly: "异常局获得所选地区异常主责及工程审批接口",
        evacuation: "所选省政府获得独立疏散与快速应急权",
        transport: "计划委获得所选地区的运输调配接口；全国运输能力仍需覆盖三省",
      }[a.department],
      loss: "该领域旧主持/批准关系被替代，其他领域保持现行配置",
      politics:
        a.department === "evacuation"
          ? "中央审批权收缩：异常局负责人积怨+1"
          : "被改变主责/征调权的地方出现社会压力+1；保留收益权可缓解运输改革阻力",
    };
  if (a.type === "regime")
    return {
      nature: "国家基本体制改革",
      area,
      field: "中央、地方与全国主要机构的根本组织关系",
      time: "下一回合过渡完成，长期有效；无前置升级顺序",
      gain: regimes[a.regime].gain,
      loss:
        regimes[a.regime].loss + "旧地区异常主责重置；部门长期事权继续保留。",
      politics:
        "与改革方向相反的在任负责人在过渡完成时积怨+1；已协商准备可降低本次政治资本成本",
    };
  return null;
}
export function OrganizationDiagram({
  game,
  proposal,
}: {
  game: V2Game;
  proposal?: Action;
}) {
  const affected = reformImpact(
    game,
    proposal || { type: "regime", regime: game.machine.regime },
  );
  return (
    <section className="organization-diagram" aria-label="国家组织与事权图">
      <div className="organization-root">
        <b>联邦最高议事厅</b>
        <span>
          {regimes[game.machine.regime].name}
          {proposal ? " · 高亮为拟调整范围" : " · 当前有效关系"}
        </span>
      </div>
      <div className="organization-arrow">中央职责 ↓ 地方职责 / 合作接口 ↔</div>
      <div className="organization-central">
        {offices
          .filter((o) => !o.province)
          .map((o) => (
            <div key={o.id} className="organization-node">
              <b>{o.name}</b>
              <span>
                {getPerson(game.core.appointments[o.id])?.name || "空缺"}
              </span>
              <span>
                {o.id === "anomaly"
                  ? "异常技术与收容"
                  : o.id === "plan"
                    ? "工业标准与资源调配"
                    : "安全与军事隔离"}
              </span>
            </div>
          ))}
      </div>
      <div className="organization-arrow">
        {game.machine.regime === "vertical"
          ? "中央批准 ↓ 全国统筹"
          : game.machine.regime === "joint"
            ? "中央 ↔ 地方：重大事务联合批准"
            : "地方自主 ↓ 跨省合作需协议"}
      </div>
      <div className="organization-regions">
        {game.core.provinces.map((p) => {
          const dummy = {
            id: "diagram",
            kind: "accident" as const,
            province: p.id,
            title: "",
            description: "",
            stage: 1,
            containment: 0,
            age: 0,
            evacuated: false,
            isolated: false,
          };
          const owner = participants(game, dummy).lead;
          const inScope =
            proposal && (!affected || affected.area.includes(p.name));
          return (
            <div
              key={p.id}
              className={`organization-node ${inScope ? "affected" : ""}`}
            >
              <b>{p.name}</b>
              <span>
                {getPerson(game.core.appointments[`gov-${p.id}`])?.name ||
                  "省政府空缺"}
              </span>
              <span>异常主持 → {getOffice(owner).name}</span>
              <span>
                疏散 →{" "}
                {game.machine.regime !== "vertical" ||
                hasDepartment(game, "evacuation", p.id)
                  ? "省政府自主"
                  : "须具体授权"}
              </span>
              <span>
                运输 →{" "}
                {hasDepartment(game, "transport", p.id)
                  ? "已建立制度接口"
                  : "仍需全国统筹/合作协约"}
              </span>
              <span>
                收益权 → {game.machine.rights[p.id] ? "地方保留" : "尚未签订"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function ReformImpact({
  game,
  action,
}: {
  game: V2Game;
  action: Action;
}) {
  const data = reformImpact(game, action);
  if (!data) return null;
  return (
    <section className="reform-impact">
      <h3>事权变化预览</h3>
      <dl>
        {Object.entries({
          "法律/行政性质": data.nature,
          适用地域: data.area,
          事务领域: data.field,
          生效与期限: data.time,
          新增权限及受益机构: data.gain,
          失去权限与受影响机构: data.loss,
          政治后果: data.politics,
        }).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <OrganizationDiagram game={game} proposal={action} />
    </section>
  );
}
export function LastingReforms({
  game,
  province,
  category,
  onChoose,
}: {
  game: V2Game;
  province: ProvinceId;
  category: "department" | "constitution";
  onChoose: (a: Action) => void;
}) {
  const [scope, setScope] = useState<ProvinceId | "nation">("nation");
  return category === "department" ? (
    <>
      <h3>调整某类事务的长期归属</h3>
      <p>
        领域改革可以并存；地区改革只覆盖所选省份。它与临时授权、国家体制改革都没有升级先后关系。
      </p>
      <label className="v2-field">
        制度改革适用范围
        <select
          aria-label="制度改革适用范围"
          value={scope}
          onChange={(e) => setScope(e.target.value as ProvinceId | "nation")}
        >
          <option value="nation">全国三省</option>
          {game.core.provinces.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="quick-grid">
        {(["anomaly", "evacuation", "transport"] as Department[]).map(
          (department) => (
            <ActionButton
              game={game}
              key={department}
              action={{ type: "department", department, scope }}
              label={
                {
                  anomaly: "全国异常垂直主责",
                  evacuation: "各省独立灾害疏散权",
                  transport: "中央跨省运输体系",
                }[department]
              }
              onChoose={onChoose}
            />
          ),
        )}
      </div>
      <h3>
        本省长期异常主责 ·{" "}
        {game.core.provinces.find((p) => p.id === province)!.name}
      </h3>
      <div className="quick-grid">
        {offices
          .filter(
            (o) =>
              o.domains.includes("anomaly") &&
              (!o.province || o.province === province),
          )
          .map((o) => (
            <ActionButton
              key={o.id}
              game={game}
              action={{ type: "local", province, lead: o.id }}
              label={`本省主责交给${o.name}`}
              onChoose={onChoose}
            />
          ))}
      </div>
    </>
  ) : (
    <>
      <h3>改变国家基本管理体制</h3>
      <p>
        覆盖全国根本组织关系，需政治资本与一回合过渡；不要求先做临时授权或部门改革。
      </p>
      {(Object.keys(regimes) as Regime[]).map((regime) => (
        <section className="document-card" key={regime}>
          <h3>{regimes[regime].name}</h3>
          <p>获得：{regimes[regime].gain}</p>
          <p>限制：{regimes[regime].loss}</p>
          <ActionButton
            game={game}
            action={{ type: "regime", regime }}
            label={regimes[regime].name}
            onChoose={onChoose}
          />
        </section>
      ))}
    </>
  );
}
