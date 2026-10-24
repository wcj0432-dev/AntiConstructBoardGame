import { useRef, useState } from "react";
import { goals, strategyDetails } from "../v2/data";
import { duration, milestones, previewAction } from "../v2/engine";
import {
  branchCatalog,
  communicationConditions,
  realmIds,
  validLawRecord,
} from "../v2/nationalStrategy";
import { workSpecs } from "../v2/administration";
import { officePerson } from "../v2/personnel";
import { facilityStateNames, facilityStatus } from "../v2/operations";
import type { Action, Goal, V2Game } from "../v2/model";
import { ActionButton } from "./AdministrativeConsole";
import { ConditionsList } from "./SemanticText";
type NodeState =
  "locked" | "blocked" | "ready" | "progress" | "done" | "invalid";
const stateNames: Record<NodeState, string> = {
  locked: "尚未解锁",
  blocked: "条件不足",
  ready: "当前可执行",
  progress: "正在推进",
  done: "已完成",
  invalid: "失效 / 互斥",
};
export function StrategyTree({
  game,
  onChoose,
  onNavigate,
}: {
  game: V2Game;
  onChoose: (a: Action) => void;
  onNavigate: (
    p: "economy" | "finance" | "staff" | "reform" | "matters",
  ) => void;
}) {
  const detailRef = useRef<HTMLElement>(null);
  const m = game.machine,
    [route, setRoute] = useState<Goal>(m.goal),
    [node, setNode] = useState("root"),
    [chosenWorks, setChosenWorks] = useState<Record<string, string>>({});
  const checks = milestones(game, route),
    selected = route === m.goal && !m.goalPending,
    b = m.strategy?.branch;
  const relatedTypes: Record<Goal, string[]> = {
    spark: ["energy", "grid"],
    accord: [],
    night: ["warning"],
    traffic: ["rail", "port", "grid"],
    learning: ["academy", "grid"],
    prosperity: ["energy", "factory", "cooperative", "port", "grid"],
    codex: Object.keys(workSpecs),
    comms: ["relay"],
  };
  const inProgress = (label: string) =>
    /设施|工程|能源|铁路|港口|通讯节点|学院|教育|税基|合同登记/.test(label) &&
    m.works.some(
      (w) =>
        !w.completed &&
        !w.cancelled &&
        !w.paused &&
        relatedTypes[route].includes(w.type),
    );
  const rootState: NodeState = selected
    ? "done"
    : !m.goalPending
      ? "invalid"
      : game.core.turn < 2
        ? "locked"
        : "ready";
  const root: Action = { type: "selectGoal", goal: route };
  const branches = ["central", "plural"] as const;
  const nodeButton = (id: string, title: string, status: NodeState) => (
    <button
      key={id}
      className={`strategy-node ${status} ${node === id ? "selected" : ""}`}
      onClick={() => {
        setNode(id);
        requestAnimationFrame(() =>
          detailRef.current?.scrollIntoView({ block: "nearest" }),
        );
      }}
      data-strategy-node={id}
      aria-pressed={node === id}
    >
      <span>{stateNames[status]}</span>
      <strong>{title}</strong>
    </button>
  );
  return (
    <section className="national-planning">
      <div className="planning-heading">
        <span className="eyebrow">NATIONAL DEVELOPMENT COUNCIL</span>
        <h2>国家发展规划</h2>
        <p>召开规划会议，决定联邦将如何运转。</p>
      </div>
      <label className="v2-field">
        查看国家战略
        <select
          aria-label="查看国家战略"
          value={route}
          onChange={(e) => {
            setRoute(e.target.value as Goal);
            setNode("root");
          }}
        >
          {Object.entries(goals).map(([id, x]) => (
            <option key={id} value={id}>
              {x.name}
              {selected && id === route ? " · 主要战略" : ""}
            </option>
          ))}
        </select>
      </label>
      {m.goalPending && (
        <>
          <h3>国家发展规划会议</h3>
          <p>
            {game.core.turn === 1
              ? "第1回合先认识国情；第2～3回合召开国家发展规划会议。"
              : "会议已开放；最迟第3回合结束前立项。"}
          </p>
          <details className="planning-route-picker">
            <summary>查看全部八项立项提案</summary>
            <div className="planning-candidates">
              {Object.entries(goals).map(([id, x]) => (
                <div key={id}>
                  <button
                    className="planning-route"
                    onClick={() => {
                      setRoute(id as Goal);
                      setNode("root");
                    }}
                  >
                    {x.name}
                  </button>
                  <ActionButton
                    game={game}
                    action={{ type: "selectGoal", goal: id as Goal }}
                    label={`${game.core.turn < 2 ? "预览" : "提交"}${x.name}立项`}
                    onChoose={onChoose}
                  />
                </div>
              ))}
            </div>
          </details>
        </>
      )}
      <div
        className="strategy-board"
        role="group"
        aria-label={`${goals[route].name}战略树`}
      >
        <div className="strategy-row one">
          {nodeButton("root", `战略立项：${goals[route].name}`, rootState)}
        </div>
        <div className="strategy-connector" aria-hidden="true">
          ┌────────────┴────────────┐
        </div>
        <div className="strategy-row two">
          {branches.map((branch) =>
            nodeButton(
              branch,
              branchCatalog[route][branch].name,
              !selected
                ? "locked"
                : b === branch
                  ? "done"
                  : b
                    ? "invalid"
                    : previewAction(game, { type: "strategyBranch", branch })
                          .errors.length
                      ? "blocked"
                      : "ready",
            ),
          )}
        </div>
        <div className="strategy-connector" aria-hidden="true">
          └────────────┬────────────┘
        </div>
        <div className="strategy-row checks">
          {checks.map((c, i) =>
            nodeButton(
              `check-${i}`,
              c.label,
              !selected
                ? "locked"
                : c.met
                  ? "done"
                  : m.milestones.includes(c.label)
                    ? "invalid"
                    : inProgress(c.label)
                      ? "progress"
                      : "blocked",
            ),
          )}
        </div>
        <div className="strategy-connector" aria-hidden="true">
          │
        </div>
        <div className="strategy-row one">
          {nodeButton(
            "final",
            goals[route].finale,
            m.finalDone && selected
              ? "done"
              : !selected
                ? "locked"
                : checks.every((c) => c.met)
                  ? "ready"
                  : "blocked",
          )}
        </div>
      </div>
      <article
        ref={detailRef}
        className="strategy-detail"
        aria-label="战略节点详情"
      >
        {node === "root" ? (
          <>
            <h3>{goals[route].name}</h3>
            <p>{goals[route].description}</p>
            <p>
              <b>建设与组织：</b>
              {strategyDetails[route].needs}
            </p>
            <p>
              <b>受益者：</b>
              {strategyDetails[route].beneficiaries}
            </p>
            <p>
              <b>政治阻力：</b>
              {strategyDetails[route].resistance}
            </p>
            {m.goalPending && (
              <ActionButton
                game={game}
                action={root}
                label="预览立项会议"
                onChoose={onChoose}
              />
            )}
          </>
        ) : node === "central" || node === "plural" ? (
          <>
            <h3>{branchCatalog[route][node].name}</h3>
            <p>{branchCatalog[route][node].effect}</p>
            <p>
              这两个方向互斥。选择不改写旧合同；后续建设与最终资格实时服从所选制度。
            </p>
            {selected && (
              <ActionButton
                game={game}
                action={{ type: "strategyBranch", branch: node }}
                label={`预览${branchCatalog[route][node].name}`}
                onChoose={onChoose}
              />
            )}
          </>
        ) : node === "final" ? (
          <>
            <h3>{goals[route].finale}</h3>
            <p>
              第{duration(game)}
              回合开放正式仪式，届时重新复核全部条件。十二回合模式先在第10～11回合演练。
            </p>
            <ConditionsList conditions={checks} title="当前终局条件" />
            {selected && m.mode === "experimental" && (
              <ActionButton
                game={game}
                action={{ type: "inspect" }}
                label="预览全国协作演练"
                onChoose={onChoose}
              />
            )}{" "}
            {selected &&
              m.matters
                .filter((x) => x.kind === "final")
                .map((x) => (
                  <ActionButton
                    key={x.id}
                    game={game}
                    action={{
                      type: "resolve",
                      matter: x.id,
                      option: "activate",
                    }}
                    label={goals[route].finale}
                    onChoose={onChoose}
                  />
                ))}
          </>
        ) : (
          <>
            <h3>{checks[Number(node.slice(6))]?.label}</h3>
            <ConditionsList
              conditions={checks.filter((_, i) => i === Number(node.slice(6)))}
              title="真实规则要求"
            />
            <button onClick={() => onNavigate("economy")}>
              调阅工程与跨路线设施
            </button>
            <button onClick={() => onNavigate("staff")}>
              查看岗位与个人传承
            </button>
            <button onClick={() => onNavigate("reform")}>查看现行制度</button>
          </>
        )}
      </article>
      {selected && m.goal === "codex" && (
        <section className="document-card">
          <h3>三省契约登记处</h3>
          <p>
            每省登记一座运营设施。合同变化需重新登记；停运会使验收失效，恢复后仍检查原合同。
          </p>
          {realmIds.map((pid) => {
            const works = m.works.filter(
                (w) => w.province === pid && !w.cancelled,
              ),
              id = chosenWorks[pid] ?? works[0]?.id ?? "";
            return (
              <div className="legal-register" key={pid}>
                <label>
                  {game.core.provinces.find((p) => p.id === pid)?.name}
                  <select
                    aria-label={`${pid}登记设施`}
                    value={id}
                    onChange={(e) =>
                      setChosenWorks({ ...chosenWorks, [pid]: e.target.value })
                    }
                  >
                    {!works.length && <option value="">尚无设施</option>}
                    {works.map((w) => (
                      <option key={w.id} value={w.id}>
                        {workSpecs[w.type].name} ·{" "}
                        {facilityStateNames[facilityStatus(game, w).state]}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {validLawRecord(game, pid)
                    ? "✓ 现有合同有效"
                    : "○ 尚无有效登记"}
                </span>
                <ActionButton
                  game={game}
                  action={{ type: "lawRegister", province: pid, work: id }}
                  label={`登记${game.core.provinces.find((p) => p.id === pid)?.name}契约`}
                  onChoose={onChoose}
                />
              </div>
            );
          })}
        </section>
      )}
      {selected && m.goal === "comms" && (
        <section className="document-card">
          <h3>通讯网络调度台</h3>
          {realmIds.map((pid) => (
            <div key={pid}>
              <h4>{game.core.provinces.find((p) => p.id === pid)?.name}</h4>
              <ConditionsList
                conditions={communicationConditions(game, pid)}
                title="节点与协议"
              />
              <ActionButton
                game={game}
                action={{
                  type: "project",
                  project: "relay",
                  province: pid,
                  worker: officePerson(game, `gov-${pid}`) ?? "",
                  funding: b === "plural" ? "local" : "central",
                }}
                label={`建设${game.core.provinces.find((p) => p.id === pid)?.name}中继`}
                onChoose={onChoose}
              />
            </div>
          ))}
          <h4>真实事务指令</h4>
          {m.matters
            .filter((x) => x.kind !== "final")
            .map((x) => (
              <div key={x.id}>
                <p>{x.title}</p>
                <ActionButton
                  game={game}
                  action={{ type: "dispatch", matter: x.id }}
                  label={`传达指令：${x.title}`}
                  onChoose={onChoose}
                />
              </div>
            ))}
        </section>
      )}
      <details>
        <summary>跨路线成果与原始里程碑</summary>
        <p>
          已完成的学院、铁路、电网和真实合同均可被其他路线条件引用，选择节点不会重复生成设施。既有存档保留原始六路线；附加分支一经选择即执行对应约束。
        </p>
        <ConditionsList conditions={checks} title="当前实际里程碑" />
        {m.works
          .filter((w) => !w.cancelled)
          .map((w) => (
            <p key={w.id}>
              {workSpecs[w.type].name} ·{" "}
              {facilityStateNames[facilityStatus(game, w).state]} · 来源
              {w.source}
            </p>
          ))}
      </details>
    </section>
  );
}
