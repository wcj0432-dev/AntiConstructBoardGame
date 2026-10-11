import { Tooltip } from "./Tooltip";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { getPerson } from "../data";
import type { ProvinceId } from "../types";
import { workSpecs } from "../v2/administration";
import type { V2Game } from "../v2/model";
export type MapMode = "political" | "administrative" | "resources" | "crisis";
const modes: Record<MapMode, string> = {
  political: "政治",
  administrative: "行政",
  resources: "资源",
  crisis: "危机",
};
const regions = [
  {
    pid: "industry",
    points: "160,140 310,100 480,140 465,270 320,290 195,250",
    x: 320,
    y: 195,
  },
  {
    pid: "industry",
    points: "195,250 320,290 465,270 455,405 305,445 170,360",
    x: 315,
    y: 345,
  },
  {
    pid: "south",
    points: "170,360 305,445 455,405 460,525 320,580 185,510 120,425",
    x: 290,
    y: 495,
  },
  {
    pid: "south",
    points: "455,405 570,345 680,410 690,520 580,570 460,525",
    x: 575,
    y: 465,
  },
  {
    pid: "north",
    points: "480,140 595,70 755,105 845,210 755,290 620,270 465,270",
    x: 645,
    y: 180,
  },
  {
    pid: "north",
    points: "465,270 620,270 755,290 810,390 680,410 570,345 455,405",
    x: 640,
    y: 335,
  },
] as const;
export function GameMap({
  g,
  selected,
  district,
  onSelect,
}: {
  g: V2Game;
  selected: ProvinceId;
  district: number;
  onSelect: (p: ProvinceId, d: number) => void;
}) {
  const [ratio, setRatio] = useState(1);
  const [mode, setMode] = useState<MapMode>("political");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    pan: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setRatio(Math.max(0.1, Math.min(r.width / 1000, r.height / 650)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  function moveZoom(amount: number) {
    setZoom((z) => Math.max(0.8, Math.min(2.4, z + amount)));
  }
  return (
    <div className="map-stage">
      <div className="map-toolbar" role="group" aria-label="地图模式">
        {Object.entries(modes).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mode === id}
            onClick={() => setMode(id as MapMode)}
          >
            {label}
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        className="federation-map"
        viewBox={`${(1000 - 1000 / zoom) / 2 - pan.x} ${(650 - 650 / zoom) / 2 - pan.y} ${1000 / zoom} ${650 / zoom}`}
        aria-label="联邦交互地图"
        role="img"
        onWheel={(e) => moveZoom(e.deltaY < 0 ? 0.15 : -0.15)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, pan, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
          const rect = e.currentTarget.getBoundingClientRect();
          setPan({
            x: Math.max(
              -350,
              Math.min(350, d.pan.x + (dx * 1000) / rect.width / zoom),
            ),
            y: Math.max(
              -240,
              Math.min(240, d.pan.y + (dy * 650) / rect.height / zoom),
            ),
          });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest("[data-map-region]");
          if (d && !d.moved && target)
            onSelect(
              target.getAttribute("data-province") as ProvinceId,
              Number(target.getAttribute("data-district")),
            );
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="map-grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M50 0H0V50"
              fill="none"
              stroke="#406069"
              strokeWidth=".6"
            />
          </pattern>
          <pattern
            id="terrain"
            width="23"
            height="23"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M3 14l5-7 5 7M16 7l4-5"
              fill="none"
              stroke="#c9d5ac"
              opacity=".10"
            />
          </pattern>
          <filter id="map-shadow">
            <feDropShadow dx="0" dy="7" stdDeviation="12" floodOpacity=".5" />
          </filter>
        </defs>
        <rect x="-500" y="-500" width="2000" height="1650" fill="#172d36" />
        <rect
          x="-500"
          y="-500"
          width="2000"
          height="1650"
          fill="url(#map-grid)"
        />
        <g className="map-ocean-label">
          <text x="80" y="85">
            诸 界 联 邦
          </text>
          <text x="735" y="570">
            静 谧 海
          </text>
          <text x="825" y="85">
            北境裂隙
          </text>
        </g>
        <g filter="url(#map-shadow)">
          {regions.map((r, i) => {
            const p = g.core.provinces.find((p) => p.id === r.pid)!;
            const d = i % 2;
            const matters = g.machine.matters.filter(
              (m) =>
                m.province === r.pid &&
                ["oldgod", "accident", "supply", "distrust"].includes(m.kind),
            );
            const intense = matters.some((m) => m.stage >= 3);
            const fill =
              mode === "crisis"
                ? intense
                  ? "#7c3f39"
                  : matters.length
                    ? "#715b40"
                    : "#3c5e55"
                : mode === "resources"
                  ? ["#666649", "#456857", "#526975"][
                      Math.min(2, Math.floor(p.stock / 7))
                    ]
                  : mode === "administrative"
                    ? g.machine.regime === "vertical"
                      ? "#526777"
                      : g.machine.regime === "joint"
                        ? "#68604d"
                        : "#456259"
                    : r.pid === "industry"
                      ? "#667053"
                      : r.pid === "south"
                        ? "#4d7260"
                        : "#656881";
            return (
              <Tooltip
                key={i}
                title={`${p.name} · ${p.districts[d].name}`}
                content={
                  <>
                    <p>
                      政：
                      {getPerson(g.core.appointments[`gov-${r.pid}`])?.name ||
                        "负责人空缺"}
                      ；当前体制
                      {g.machine.regime === "vertical"
                        ? "中央垂直"
                        : g.machine.regime === "joint"
                          ? "联合委员会"
                          : "地方分权"}
                      。
                    </p>
                    <p>
                      建：
                      {g.machine.works
                        .filter((w) => w.province === r.pid && !w.cancelled)
                        .map(
                          (w) =>
                            `${workSpecs[w.type].name} ${w.completed ? "已竣工" : `${w.progress}/${w.duration}`}`,
                        )
                        .join("；") || "暂无设施"}
                    </p>
                    <p>
                      危机：
                      {matters
                        .map(
                          (x) =>
                            `${x.title} · 阶段${x.stage} · ${x.isolated ? "持续隔离 · 本省停产" : x.containment > 0 ? `遏制${x.containment}回合` : "下次结算恶化"}`,
                        )
                        .join("；") || "暂无持续危机"}
                    </p>
                    <p>
                      库存{p.stock} · 信任{g.machine.trust[r.pid]}/3 ·{" "}
                      {g.machine.rights[r.pid]
                        ? "保留地方收益权"
                        : "收益协议尚未建立"}
                      。点击调阅地方；地图上的管控标记不代表异常源已消除。
                    </p>
                  </>
                }
              >
                <g
                  data-map-region={i}
                  data-province={r.pid}
                  data-district={d}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.name} ${p.districts[d].name}`}
                  aria-pressed={selected === r.pid && district === d}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(r.pid, d);
                    }
                  }}
                  className={selected === r.pid ? "selected-region" : ""}
                >
                  <polygon
                    points={r.points}
                    fill={fill}
                    stroke={selected === r.pid ? "#dfc98d" : "#9da990"}
                    strokeWidth={selected === r.pid ? 3 : 1.5}
                  />
                  <polygon
                    points={r.points}
                    fill="url(#terrain)"
                    pointerEvents="none"
                  />
                  <text
                    x={r.x}
                    y={r.y - 3}
                    className="district-name"
                    style={{ fontSize: Math.max(22, 16 / ratio / zoom) }}
                  >
                    {p.districts[d].name}
                  </text>
                  <text
                    x={r.x}
                    y={r.y + 22}
                    className="district-detail"
                    style={{ fontSize: Math.max(16, 14 / ratio / zoom) }}
                  >
                    {mode === "resources"
                      ? `区产出 ${p.districts[d].output} / 省库存 ${p.stock}`
                      : mode === "administrative"
                        ? `${g.machine.overrides[r.pid] ? "特定异常主责" : g.machine.regime === "vertical" ? "中央审批" : g.machine.regime === "joint" ? "联合批准" : "地方自主"}`
                        : mode === "crisis"
                          ? `持续事项 ${matters.length} / 异常压力 ${p.pressure.anomaly}`
                          : getPerson(g.core.appointments[`gov-${r.pid}`])
                              ?.name || "负责人空缺"}
                  </text>
                  {d === 0 && (
                    <text
                      x={r.x}
                      y={r.y - 65}
                      className="province-name"
                      style={{ fontSize: Math.max(18, 16 / ratio / zoom) }}
                    >
                      {p.name}
                    </text>
                  )}
                  {d === 0 && (
                    <g className="map-marker">
                      <circle cx={r.x - 65} cy={r.y - 43} r="12" />
                      <text x={r.x - 65} y={r.y - 38}>
                        政
                      </text>
                    </g>
                  )}
                  {d === 1 &&
                    g.machine.works.some((w) => w.province === r.pid) && (
                      <g className="map-marker works">
                        <circle cx={r.x + 60} cy={r.y - 43} r="12" />
                        <text x={r.x + 60} y={r.y - 38}>
                          建
                        </text>
                      </g>
                    )}
                  {d === 0 && matters.length > 0 && (
                    <g className="map-marker crisis">
                      <circle cx={r.x + 65} cy={r.y - 43} r="13" />
                      <text x={r.x + 65} y={r.y - 38}>
                        !
                      </text>
                    </g>
                  )}
                </g>
              </Tooltip>
            );
          })}
        </g>
        <path
          d="M315 190L315 345 290 495 575 465 640 335 645 180"
          fill="none"
          stroke="#dac591"
          strokeWidth="2"
          strokeDasharray="5 8"
          opacity=".4"
          pointerEvents="none"
        />
        {g.machine.works
          .filter(
            (w) => w.type === "rail" && w.completed && !w.cancelled && w.to,
          )
          .map((w) => {
            const from = regions.find((r) => r.pid === w.province)!,
              to = regions.find((r) => r.pid === w.to)!;
            const blocked = g.machine.matters.some(
              (x) =>
                [w.province, w.to].includes(x.province) &&
                (x.isolated || x.stage >= 3),
            );
            return (
              <Tooltip
                key={w.id}
                title="跨省符阵铁路"
                content={
                  <p>
                    {blocked
                      ? "连接被危机/隔离阻断，先处理源头"
                      : "竣工连接：保留两端收益权与合作后可在经济面板调运"}
                    ；失控异常可能沿连接传播。
                  </p>
                }
              >
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`铁路连接${w.province}与${w.to}`}
                  onClick={() => onSelect(w.to!, 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(w.to!, 0);
                    }
                  }}
                >
                  <line
                    x1={from.x}
                    y1={from.y + 20}
                    x2={to.x}
                    y2={to.y + 20}
                    stroke={blocked ? "#db8e72" : "#f6d692"}
                    strokeWidth="6"
                  />
                  <line
                    x1={from.x}
                    y1={from.y + 20}
                    x2={to.x}
                    y2={to.y + 20}
                    stroke="transparent"
                    strokeWidth="18"
                  />
                </g>
              </Tooltip>
            );
          })}
        <g className="compass" transform="translate(890 455)">
          <path d="M0-34L8 0 0 34-8 0zM-34 0L0-8 34 0 0 8z" fill="#a8b4ac" />
          <text x="0" y="-45">
            N
          </text>
          <circle r="42" fill="none" stroke="#a8b4ac" />
        </g>
      </svg>
      <div className="map-caption">
        <span>FEDERAL ATLAS · 三省六区</span>
        <small>点击地区调阅 / 拖动平移 / 滚轮缩放</small>
      </div>
      <div className="map-zoom">
        <button aria-label="放大地图" onClick={() => moveZoom(0.2)}>
          <Plus size={20} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="缩小地图" onClick={() => moveZoom(-0.2)}>
          <Minus size={20} />
        </button>
        <button
          aria-label="复位地图"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
