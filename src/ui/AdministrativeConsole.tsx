import { useState } from "react";
import { getOffice, getPerson, people } from "../data";
import type { ProvinceId } from "../types";
import type {
  Action,
  Regime,
  V2Game,
  WorkAssignment,
  WorkType,
} from "../v2/model";
import { previewAction } from "../v2/engine";
import {
  assignmentFor,
  departmentLabels,
  officerOffice,
  workReadiness,
  workSpecs,
} from "../v2/administration";
import { Tooltip } from "./Tooltip";
export function ActionButton({
  game,
  action,
  label,
  onChoose,
}: {
  game: V2Game;
  action: Action;
  label: string;
  onChoose: (a: Action) => void;
}) {
  const v = previewAction(game, action);
  return (
    <Tooltip
      title={v.title}
      content={
        <>
          <p>
            代价：{v.costs.commands}命令 / {v.costs.treasury}财政 /{" "}
            {v.costs.capital}资本 / {v.costs.stock}物资
          </p>
          {v.effects.map((x) => (
            <p key={x}>{x}</p>
          ))}
          {v.conditions.map((x, i) => (
            <p key={i} className={x.met ? "met" : "unmet"}>
              {x.met ? "✓" : "✕"} {x.label}：{x.reason}
            </p>
          ))}
        </>
      }
    >
      <button
        className={v.errors.length ? "blocked" : "available"}
        disabled={game.core.status !== "playing"}
        onClick={() => onChoose(action)}
      >
        {label}
        {v.errors.length > 0 && <small> · 查看条件</small>}
      </button>
    </Tooltip>
  );
}
export function AdministrativeConsole({
  game,
  province,
  onChoose,
}: {
  game: V2Game;
  province: ProvinceId;
  onChoose: (a: Action) => void;
}) {
  const [type, setType] = useState<WorkType>("energy"),
    [worker, setWorker] = useState("mo"),
    [assignment, setAssignment] = useState<WorkAssignment>("advisor"),
    [to, setTo] = useState<ProvinceId>("north"),
    [reform, setReform] = useState<Regime>("vertical");
  const [budgets, setBudgets] = useState(game.machine.departmentBudgets);
  const spec = workSpecs[type],
    m = game.machine;
  const project: Action = {
    type: "project",
    project: type,
    province,
    worker,
    assignment,
    to: type === "rail" ? to : undefined,
  };
  const view = previewAction(game, project),
    person = getPerson(worker),
    job = officerOffice(game, worker),
    busy = assignmentFor(game, worker);
  return (
    <div className="administrative-console">
      <h3>主动治理 · 当前地区</h3>
      <p>
        治理会占用真实主管、改变未来能力并留下政治代价。富余命令可以保留至结算作废。
      </p>
      <section className="document-card">
        <h3>财政稽核与主动调查</h3>
        <div className="quick-grid">
          <ActionButton
            game={game}
            action={{ type: "audit", province, lead: `gov-${province}` }}
            label="地方财政稽核"
            onChoose={onChoose}
          />
          <ActionButton
            game={game}
            action={{ type: "audit", province, lead: "plan" }}
            label="计划委税收整顿"
            onChoose={onChoose}
          />
          {(["resources", "routes", "anomaly"] as const).map((field) => (
            <ActionButton
              key={field}
              game={game}
              action={{ type: "survey", province, field }}
              label={
                {
                  resources: "资源普查",
                  routes: "运输网络调查",
                  anomaly: "异常地质勘探",
                }[field]
              }
              onChoose={onChoose}
            />
          ))}
        </div>
        <p>
          本地稽核：
          {m.audits[province]
            ? `${m.audits[province]!.rounds}/2轮，最近第${m.audits[province]!.last}回合`
            : "尚未稽核"}
          。调查记录：
          {m.discoveries[province]
            .map(
              (x) =>
                ({
                  resources: "资源普查",
                  routes: "运输网络",
                  anomaly: "异常档案",
                  "production-potential": "生产潜力",
                  "stable-findings": "稳定勘察记录",
                })[x as "resources"],
            )
            .join("、") || "尚未调查"}
          。
        </p>
      </section>
      <section className="document-card">
        <h3>经济投资与人员分配</h3>
        <div className="form-grid">
          <label className="v2-field">
            建设类型
            <select
              aria-label="建设类型"
              value={type}
              onChange={(e) => setType(e.target.value as WorkType)}
            >
              {Object.entries(workSpecs).map(([id, w]) => (
                <option key={id} value={id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="v2-field">
            项目负责人
            <select
              aria-label="项目负责人"
              value={worker}
              disabled={type === "warning"}
              onChange={(e) => setWorker(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · 生产{p.skills.production}
                </option>
              ))}
            </select>
          </label>
          <label className="v2-field">
            工作分配
            <select
              aria-label="工作分配"
              value={assignment}
              disabled={type === "warning"}
              onChange={(e) => setAssignment(e.target.value as WorkAssignment)}
            >
              <option value="advisor">顾问兼任 · 保留行政能力</option>
              <option value="dedicated">专职派遣 · 暂停行政能力</option>
            </select>
          </label>
          {type === "rail" && (
            <label className="v2-field">
              铁路目的省
              <select
                aria-label="铁路目的省"
                value={to}
                onChange={(e) => setTo(e.target.value as ProvinceId)}
              >
                {game.core.provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p>
          {spec.duration}回合，开工{spec.cost}财政/{spec.stock}
          物资，每次可施工结算另付1财政。{spec.benefit}。
        </p>
        <p>
          竣工税收{spec.income}/年，维护{spec.maintenance}/年。
          {spec.income > spec.maintenance
            ? `仅按税收净收益，约需${Math.ceil((spec.cost + spec.duration) / (spec.income - spec.maintenance))}个竣工后年度回收投资与常规施工费；资源/能力收益另计。`
            : "主要回报是物资与组织能力，不能仅按财政收入评估。"}
        </p>
        {type !== "warning" && (
          <p className="person-work-state">
            {person?.name} · 正式职位：
            {job ? getOffice(job).name : "未任正式职位"} ·{" "}
            {busy ? `正承担${workSpecs[busy.type].name}` : "没有其他活动工程"} ·{" "}
            {m.occupied[worker] ? "本回合已被即时工作占用" : "本回合无即时占用"}
            。
            {assignment === "dedicated"
              ? "可保留名义职位；派遣期间行政才能不可用，岗位变化不会取消这项派遣。"
              : "须在计划委或工程所在地任职；调任和抽调会影响施工。"}
          </p>
        )}
        <div className="project-readiness">
          {view.conditions.map((c, i) => (
            <p key={i} className={c.met ? "met" : "unmet"}>
              {c.met ? "✓" : "✕"} {c.label}：{c.reason}
            </p>
          ))}
        </div>
        <ActionButton
          game={game}
          action={project}
          label="预览项目开工"
          onChoose={onChoose}
        />
      </section>
      <section className="document-card">
        <h3>实际项目 · 进度与占用</h3>
        {m.works.length === 0 && <p>暂无已开工项目。</p>}
        {m.works.map((w) => (
          <article key={w.id} className="work-row">
            <h4>
              {game.core.provinces.find((p) => p.id === w.province)!.name} ·{" "}
              {workSpecs[w.type].name}
              {w.to
                ? ` → ${game.core.provinces.find((p) => p.id === w.to)!.name}`
                : ""}
            </h4>
            <progress max={w.duration} value={w.progress} />
            <p>
              {w.cancelled
                ? "已取消"
                : w.completed
                  ? "竣工 · 人员占用已释放"
                  : w.paused
                    ? "已暂停 · 人员占用已释放"
                    : `施工 ${w.progress}/${w.duration}`}{" "}
              ·{" "}
              {w.worker
                ? `${getPerson(w.worker)?.name} / ${w.assignment === "dedicated" ? "专职" : "顾问"}`
                : "机构常规工程"}
            </p>
            {!w.completed &&
              !w.cancelled &&
              !w.paused &&
              workReadiness(game, w)
                .filter((c) => !c.met)
                .map((c) => (
                  <p className="unmet" key={c.label}>
                    {c.reason}
                  </p>
                ))}
            {!w.completed && (
              <div className="quick-grid">
                {!w.cancelled && (
                  <ActionButton
                    game={game}
                    action={{ type: "pause", work: w.id }}
                    label={w.paused ? "恢复施工" : "暂停施工"}
                    onChoose={onChoose}
                  />
                )}
                <ActionButton
                  game={game}
                  action={{
                    type: "workControl",
                    work: w.id,
                    operation: w.cancelled ? "restart" : "cancel",
                  }}
                  label={w.cancelled ? "恢复已取消工程" : "撤销工程与派遣"}
                  onChoose={onChoose}
                />
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="document-card">
        <h3>部门预算 · 财政与能力同时改变</h3>
        {Object.entries(departmentLabels).map(([id, label]) => {
          const key = id as keyof typeof budgets;
          return (
            <div className="budget-row" key={id}>
              <label className="v2-field">
                {label} · 当前{m.departmentBudgets[key]}
                <select
                  aria-label={`${label}预算`}
                  value={budgets[key]}
                  onChange={(e) =>
                    setBudgets({
                      ...budgets,
                      [key]: Number(e.target.value) as 0 | 1 | 2,
                    })
                  }
                >
                  <option value={0}>紧缩0 · 降低能力</option>
                  <option value={1}>基本1</option>
                  <option value={2}>专项2 · 增加维护</option>
                </select>
              </label>
              <ActionButton
                game={game}
                action={{
                  type: "budget",
                  department: key,
                  level: budgets[key],
                }}
                label={`预览${label}预算`}
                onChoose={onChoose}
              />
            </div>
          );
        })}
      </section>
      <section className="document-card">
        <h3>提前协调与改革准备</h3>
        <label className="v2-field">
          准备的国家体制
          <select
            value={reform}
            aria-label="准备的国家体制"
            onChange={(e) => setReform(e.target.value as Regime)}
          >
            <option value="vertical">中央垂直</option>
            <option value="devolved">地方自治</option>
            <option value="joint">联合委员会</option>
          </select>
        </label>
        <div className="quick-grid">
          {(["agreement", "exercise", "prepare"] as const).map((kind) => (
            <ActionButton
              key={kind}
              game={game}
              action={{ type: "coordinate", province, kind, regime: reform }}
              label={
                {
                  agreement: "合作磋商",
                  exercise: "应急演习",
                  prepare: "改革协商准备",
                }[kind]
              }
              onChoose={onChoose}
            />
          ))}
        </div>
      </section>
      <section className="document-card">
        <h3>跨省连接与物资调运</h3>
        <label className="v2-field">
          调运目的省
          <select
            value={to}
            aria-label="调运目的省"
            onChange={(e) => setTo(e.target.value as ProvinceId)}
          >
            {game.core.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <ActionButton
          game={game}
          action={{ type: "transfer", from: province, to, amount: 2 }}
          label="调运2物资（另损耗1）"
          onChoose={onChoose}
        />
        <p>
          铁路需要实际合作与两端收益权；失控异常会沿连接增加邻省异常压力，先管理源头可以避免传播。
        </p>
      </section>
    </div>
  );
}
