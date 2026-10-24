import { MapReliefV7 } from "./art/V7Map";
import { communicationReady } from "../v2/nationalStrategy";
import { facilityStateNames, facilityStatus } from "../v2/operations";
import { Tooltip } from "./Tooltip";
import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { getPerson } from "../data";
import type { ProvinceId } from "../types";
import { workSpecs } from "../v2/administration";
import {
  accountLabel,
  fundingLabels,
  gridOperating,
  workFunding,
} from "../v2/fiscal";
import type { V2Game, Work } from "../v2/model";
import { officePerson } from "../v2/personnel";
import { FacilityMarkerV5, MapGeographyV5, V5_REGION_PATHS } from "./art/V5Art";
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
    x: 320,
    y: 195,
  },
  {
    pid: "industry",
    x: 315,
    y: 345,
  },
  {
    pid: "south",
    x: 290,
    y: 495,
  },
  {
    pid: "south",
    x: 575,
    y: 465,
  },
  {
    pid: "north",
    x: 645,
    y: 180,
  },
  {
    pid: "north",
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
  const mapId = `atlas-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
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
  function contractSummary(work: Work) {
    const contract = workFunding(g, work);
    const owner =
      contract.owner === "joint"
        ? "联合共同管理"
        : accountLabel(g, contract.owner);
    const beneficiary = contract.beneficiary || work.province;
    return `${fundingLabels[contract.mode]}；经营权：${owner}；受益地区：${accountLabel(g, beneficiary)}；出资份额：${contract.shares.map((share) => `${accountLabel(g, share.account)} ${share.weight}份`).join("、")}`;
  }
  function workState(work: Work) {
    return `${facilityStateNames[facilityStatus(g, work).state]}${!work.completed ? ` · ${work.progress}/${work.duration}` : ""}`;
  }
  function workMarkers(r: (typeof regions)[number]) {
    return g.machine.works
      .filter((work) => work.province === r.pid && !work.cancelled)
      .map((work, index) => (
        <Tooltip
          key={work.id}
          title={`${workSpecs[work.type].name} · ${workState(work)}`}
          content={
            <>
              <p>{contractSummary(work)}。</p>
              <p>
                工程负责人：
                {getPerson(work.worker)?.name || "无需专职工程师"}；
                {work.assignment === "dedicated"
                  ? "专职工程派遣"
                  : "工程顾问兼任"}
                。竣工后维护 {workSpecs[work.type].maintenance} 财政/回合。
              </p>
              {work.type === "grid" && (
                <p>
                  {gridOperating(g, work)
                    ? "正常供给使中央工业省的常规税源和物资产出各增加2；当地隔离会停止产出，产权收入按合同分配。"
                    : work.network?.fault
                      ? "设备故障已切断供给；处理国家事务中的能源故障后恢复。"
                      : work.completed
                        ? "网络当前停运；在经济建设中检查经营方同意、供给开关与当地危机。"
                        : "施工中的连接尚不提供供电与财政收益。"}
                </p>
              )}
            </>
          }
        >
          <g
            role="button"
            tabIndex={0}
            data-map-work={work.id}
            aria-label={`${workSpecs[work.type].name} · ${workState(work)}`}
            onClick={() => onSelect(r.pid, 1)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSelect(r.pid, 1);
              }
            }}
          >
            <FacilityMarkerV5
              type={work.type}
              status={
                work.paused ||
                (work.completed &&
                  facilityStatus(g, work).state !== "operating")
                  ? "paused"
                  : work.completed
                    ? "completed"
                    : "construction"
              }
              x={r.x + 55 + (index % 3) * 34}
              y={r.y - 52 - Math.floor(index / 3) * 35}
            />
            {facilityStatus(g, work).state === "maintenance" && (
              <g aria-label="维护欠付">
                <circle
                  cx={r.x + 55 + (index % 3) * 34}
                  cy={r.y - 65 - Math.floor(index / 3) * 35}
                  r="8"
                  fill="#d27e6d"
                />
                <text
                  x={r.x + 55 + (index % 3) * 34}
                  y={r.y - 62 - Math.floor(index / 3) * 35}
                  textAnchor="middle"
                  fill="#161f20"
                  fontSize="12"
                  fontWeight="bold"
                >
                  !
                </text>
              </g>
            )}
          </g>
        </Tooltip>
      ));
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
          {V5_REGION_PATHS.map((path, index) => (
            <clipPath id={`${mapId}-district-${index}`} key={index}>
              <path d={path} />
            </clipPath>
          ))}
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
                [
                  "oldgod",
                  "accident",
                  "energyFault",
                  "supply",
                  "distrust",
                ].includes(m.kind),
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
                      {getPerson(officePerson(g, `gov-${r.pid}`))?.name ||
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
                        .map((w) => `${workSpecs[w.type].name} ${workState(w)}`)
                        .join("；") || "暂无设施"}
                    </p>
                    {communicationReady(g, r.pid) && (
                      <p>
                        通讯预警：本省中继与指挥协议在线。
                        {matters
                          .filter((x) => !x.isolated && x.containment === 0)
                          .map((x) => `${x.title}未受遏制，下一结算会升级；`)
                          .join("") ||
                          "当前持续危机已遏制或隔离，仍需关注期限。"}
                      </p>
                    )}
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
                  <path
                    className="map-province-shape"
                    d={V5_REGION_PATHS[i]}
                    fill={fill}
                    stroke={selected === r.pid ? "#dfc98d" : "#9da990"}
                    strokeWidth={selected === r.pid ? 3 : 1.5}
                  />
                  <path
                    d={V5_REGION_PATHS[i]}
                    fill="url(#terrain)"
                    pointerEvents="none"
                  />
                  <g
                    clipPath={`url(#${mapId}-district-${i})`}
                    pointerEvents="none"
                  >
                    <MapGeographyV5 province={r.pid} />
                    <MapReliefV7
                      province={r.pid}
                      features={g.machine.regionFeatures?.[r.pid] ?? []}
                      quiet={mode !== "political"}
                    />
                  </g>
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
                          : getPerson(officePerson(g, `gov-${r.pid}`))?.name ||
                            "负责人空缺"}
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
        <g className="map-comms-links" pointerEvents="none">
          {g.machine.works
            .filter((w) => w.type === "relay" && !w.cancelled)
            .map((w) => {
              const here = regions.find((r) => r.pid === w.province)!;
              const hub = regions.find((r) => r.pid === "industry")!;
              const ready = communicationReady(g, w.province);
              return (
                <g key={w.id}>
                  <path
                    d={`M${hub.x + 20} ${hub.y + 30} Q${here.x + 100} ${here.y - 80} ${here.x + 20} ${here.y + 30}`}
                    fill="none"
                    stroke={ready ? "#b8e2f1" : "#b5a18c"}
                    strokeWidth="3"
                    strokeDasharray={ready ? "3 5" : "2 10"}
                  />
                  <circle
                    cx={here.x + 20}
                    cy={here.y + 30}
                    r="10"
                    fill={ready ? "#b8e2f1" : "#857d75"}
                  />
                  <text
                    x={here.x + 20}
                    y={here.y + 35}
                    textAnchor="middle"
                    fontSize="14"
                    fill="#162a32"
                  >
                    讯
                  </text>
                </g>
              );
            })}
        </g>
        <g className="map-work-markers">
          {regions.filter((_, index) => index % 2 === 1).flatMap(workMarkers)}
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
          .filter((work) => work.type === "grid" && !work.cancelled)
          .map((work) => {
            const from = regions.find(
              (region) => region.pid === work.province,
            )!;
            const beneficiary = workFunding(g, work).beneficiary || "industry";
            const to = regions.find((region) => region.pid === beneficiary)!;
            const operating = gridOperating(g, work);
            const color = work.network?.fault
              ? "#ffc0b1"
              : operating
                ? "#a2e8da"
                : work.completed
                  ? "#c0c7c5"
                  : "#f4d695";
            const path = `M${from.x - 40} ${from.y - 35}C${from.x - 60} ${from.y - 170},${to.x - 85} ${to.y + 130},${to.x - 40} ${to.y + 40}`;
            return (
              <Tooltip
                key={work.id}
                title={`跨省能源网络 · ${workState(work)}`}
                content={
                  <>
                    <p>
                      {accountLabel(g, work.province)} →{" "}
                      {accountLabel(g, beneficiary)}；{workState(work)}。
                    </p>
                    <p>{contractSummary(work)}。</p>
                    <p>
                      {operating
                        ? "正常供给使工业省每回合实物产出与税源各增加2；当地隔离会停止产出，收益按实际税制和产权合同分配。"
                        : work.network?.fault
                          ? "能源故障令供给中断，完成故障事务的检修或分工处理后可恢复。"
                          : work.completed
                            ? "已竣工但未供给。先检查停机控制权、经营协议与沿线危机。"
                            : "线路仍在施工；竣工后才形成实际能源供给。"}
                    </p>
                  </>
                }
              >
                <g
                  className={`map-energy-link ${operating ? "network-active" : work.network?.fault ? "network-fault" : "network-inactive"}`}
                  role="button"
                  tabIndex={0}
                  data-map-energy={work.id}
                  aria-label={`能源连接${accountLabel(g, work.province)}与${accountLabel(g, beneficiary)} · ${workState(work)}`}
                  onClick={() => onSelect(beneficiary, 0)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(beneficiary, 0);
                    }
                  }}
                >
                  <path d={path} fill="none" stroke="#1b3036" strokeWidth="8" />
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray={
                      operating
                        ? undefined
                        : work.network?.fault
                          ? "3 6"
                          : "8 6"
                    }
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  <circle
                    cx={from.x - 40}
                    cy={from.y - 35}
                    r="6"
                    fill={color}
                    stroke="#1b3036"
                    strokeWidth="2"
                  />
                  <circle
                    cx={to.x - 40}
                    cy={to.y + 40}
                    r="6"
                    fill={color}
                    stroke="#1b3036"
                    strokeWidth="2"
                  />
                </g>
              </Tooltip>
            );
          })}
        {g.machine.works
          .filter(
            (w) => w.type === "rail" && w.completed && !w.cancelled && w.to,
          )
          .map((w) => {
            const from = regions.find((r) => r.pid === w.province)!,
              to = regions.find((r) => r.pid === w.to)!;
            const railStatus = facilityStatus(g, w);
            const blocked = railStatus.state !== "operating";
            return (
              <Tooltip
                key={w.id}
                title="跨省符阵铁路"
                content={
                  <>
                    <p>
                      {blocked
                        ? railStatus.reason
                        : "竣工连接：保留两端收益权与合作后可在经济面板调运"}
                      ；失控异常可能沿连接传播。
                    </p>
                    <p>{contractSummary(w)}。</p>
                  </>
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
