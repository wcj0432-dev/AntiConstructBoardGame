import { useRef, useState, useEffect } from "react";
import { offices, getPerson, domainNames, factionNames } from "../data";
import {
  officePerson,
  assignmentsFor,
  appointmentImpact,
  personnelStateNames,
} from "../v2/personnel";
import { previewAction } from "../v2/engine";
import type { Action, V2Game } from "../v2/model";
import { PersonBadge } from "./Visuals";
import { people } from "../data";
import { ActionButton } from "./AdministrativeConsole";
export function OrganizationChart({
  game,
  office,
  onOffice,
  onPerson,
  onChoose,
}: {
  game: V2Game;
  office: string;
  onOffice: (id: string) => void;
  onPerson: (id: string) => void;
  onChoose: (a: Action) => void;
}) {
  const [scope, setScope] = useState("central"),
    [layer, setLayer] = useState("formal"),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [candidate, setCandidate] = useState("lin");
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      pan: { x: number; y: number };
    } | null>(null);
  const nodes = offices.filter(
    (o) =>
      scope === "all" ||
      (scope === "central"
        ? !o.province
        : scope === "local"
          ? !!o.province
          : o.domains.includes(scope as "production" | "social" | "anomaly")),
  );
  const multiRow = nodes.length > 3;
  const positions = nodes.map((o, i) => {
    return {
      ...o,
      x: 80 + (i % 3) * 300,
      y: multiRow ? (i < 3 ? 135 : 330) : 170,
    };
  });
  const holder = officePerson(game, office),
    status = holder ? assignmentsFor(game, holder) : undefined;
  const impact = appointmentImpact(game, office, candidate, "primary"),
    p = previewAction(game, { type: "appoint", office, person: candidate });
  const fit = () => {
    const r = viewport.current?.getBoundingClientRect();
    setZoom(
      Math.max(
        0.8,
        Math.min(
          1.4,
          (r?.width ?? 900) / 940,
          (r?.height ?? 500) / (multiRow ? 510 : 340),
        ),
      ),
    );
    setPan({ x: 0, y: 0 });
  };
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setZoom(
        Math.max(
          0.8,
          Math.min(
            1.4,
            node.clientWidth / 940,
            node.clientHeight / (multiRow ? 510 : 340),
          ),
        ),
      );
      setPan({ x: 0, y: 0 });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [scope, multiRow]);
  return (
    <section aria-label="国家组织与人事指挥图" className="organization-chart">
      <h3>国家组织与人事指挥图</h3>
      <div className="org-toolbar">
        <label>
          机构范围
          <select
            aria-label="组织机构范围"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPan({ x: 0, y: 0 });
            }}
          >
            <option value="all">中央与地方</option>
            <option value="central">中央机关</option>
            <option value="local">省级政府</option>
            <option value="production">生产领域</option>
            <option value="social">社会领域</option>
            <option value="anomaly">异常领域</option>
          </select>
        </label>
        <label>
          关系图层
          <select
            aria-label="组织关系图层"
            value={layer}
            onChange={(e) => setLayer(e.target.value)}
          >
            <option value="formal">正式组织与兼职</option>
            <option value="faction">派系联系</option>
          </select>
        </label>
        <button
          onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}
          aria-label="组织图缩小"
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
          aria-label="组织图放大"
        >
          ＋
        </button>
        <button onClick={fit}>适配组织图</button>
      </div>
      <p>
        默认查看中央分支，可切换省级或完整组织。最低缩放80%保持正文可读；小窗通过筛选和平移查看。实线表示正式机构；虚线表示同一人物兼职。项目和课程显示真实任务标记；派系图层单独查看。拖动空白区域平移。
      </p>
      <div
        className="org-viewport"
        ref={viewport}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { x: e.clientX, y: e.clientY, pan };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setPan({
              x: drag.current.pan.x + e.clientX - drag.current.x,
              y: drag.current.pan.y + e.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="org-canvas"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <strong className="org-root">中央执政委员会</strong>
          <svg
            className="org-connections"
            width="940"
            height="520"
            aria-label="组织关系连接"
          >
            {layer === "formal" &&
              positions.map((n) => (
                <path
                  key={n.id}
                  d={`M470 65 V100 H${n.x + 110} V${n.y}`}
                  stroke="#bca87a"
                  fill="none"
                />
              ))}
            {positions.flatMap((a, i) =>
              positions.slice(i + 1).map((b) => {
                const aid = officePerson(game, a.id),
                  bid = officePerson(game, b.id);
                const connected =
                  layer === "formal"
                    ? !!aid && aid === bid
                    : !!aid &&
                      !!bid &&
                      getPerson(aid)?.faction === getPerson(bid)?.faction;
                return connected ? (
                  <path
                    key={`${a.id}:${b.id}`}
                    d={`M${a.x + 110} ${a.y + 125} Q470 260 ${b.x + 110} ${b.y}`}
                    stroke={layer === "formal" ? "#68cfca" : "#c096dc"}
                    strokeDasharray="7 5"
                    fill="none"
                  />
                ) : null;
              }),
            )}
          </svg>
          {positions.map((n) => {
            const id = officePerson(game, n.id),
              state = id ? assignmentsFor(game, id) : undefined;
            return (
              <button
                key={n.id}
                data-office-id={n.id}
                className={`org-node ${n.id === office ? "selected" : ""} ${!id || !state?.adminAvailable ? "restricted" : ""}`}
                style={{ left: n.x, top: n.y }}
                onClick={() => {
                  onOffice(n.id);
                  if (id) onPerson(id);
                }}
              >
                <strong>{n.name}</strong>
                {id ? <PersonBadge id={id} /> : <span>职位空缺</span>}
                <span>
                  {id ? personnelStateNames[state!.state] : "须任命负责人"}
                  {game.machine.secondaryAppointments?.[n.id] && " · 正式兼职"}
                </span>
                <span>
                  {layer === "faction" && id
                    ? factionNames[getPerson(id)!.faction]
                    : n.domains.map((d) => domainNames[d]).join(" / ")}
                </span>
                {state?.activeProject && (
                  <span>
                    工程：
                    {state.activeProject.assignment === "dedicated"
                      ? "专职派遣"
                      : "顾问"}
                  </span>
                )}
                {game.machine.trainings?.some(
                  (t) =>
                    t.mentor === id && ["active", "paused"].includes(t.state),
                ) && <span>教学任务</span>}
              </button>
            );
          })}
        </div>
      </div>
      <section
        className="document-card org-position-detail"
        aria-label="职位与候选人比较"
      >
        <h4>
          {offices.find((o) => o.id === office)?.name} ·{" "}
          {getPerson(holder)?.name ?? "空缺"}
        </h4>
        <p>
          {status?.restrictions.join("；") ||
            (holder
              ? "负责人可以履职；具体行动仍需权限、预算和地区条件"
              : "当前机构没有负责人，不能调用岗位能力")}
        </p>
        <p>
          法定领域：
          {offices
            .find((o) => o.id === office)
            ?.domains.map((d) => domainNames[d])
            .join("、")}
          ；可用职责与任命后果由同一预览生成。
        </p>
        <label>
          比较候选人
          <select
            aria-label="组织候选人"
            value={candidate}
            onChange={(e) => {
              setCandidate(e.target.value);
              onPerson(e.target.value);
            }}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ·{" "}
                {assignmentsFor(game, person.id).mainOffice ?? "待命人才"}
              </option>
            ))}
          </select>
        </label>
        <div className="impact-grid">
          {(
            [
              ["新增职责", impact.gainedCapabilities],
              [
                "失去 / 受限能力",
                [
                  ...impact.lostCapabilities,
                  ...impact.vacancies,
                  ...impact.projectEffects,
                ],
              ],
              ["政治与组织影响", impact.politicalEffects],
            ] as const
          ).map(([name, lines]) => (
            <div key={name}>
              <h4>{name}</h4>
              {lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          ))}
        </div>
        {p.conditions
          .filter((c) => !c.met)
          .map((c) => (
            <p key={c.label} className="unmet">
              {c.label}：{c.reason}
            </p>
          ))}
        {assignmentsFor(game, candidate).mainOffice &&
          assignmentsFor(game, candidate).mainOffice !== office && (
            <ActionButton
              game={game}
              action={{
                type: "appoint",
                office: assignmentsFor(game, candidate).mainOffice!,
                person: null,
              }}
              onChoose={onChoose}
              label="先预览解除候选人原主职"
            />
          )}
        <div className="quick-grid">
          <ActionButton
            game={game}
            action={{ type: "appoint", office, person: candidate }}
            onChoose={onChoose}
            label="比较后预览主职任命"
          />
          <ActionButton
            game={game}
            action={{ type: "concurrent", office, person: candidate }}
            onChoose={onChoose}
            label="预览正式兼职安排"
          />
        </div>
      </section>
    </section>
  );
}
