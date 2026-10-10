import { useState } from "react";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  Download,
  Flag,
  Globe2,
  Landmark,
  Layers,
  LockKeyhole,
  MapPin,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
  AlertTriangle,
  ScrollText,
} from "lucide-react";
import {
  abandon,
  appoint,
  deserialize,
  endTurn,
  execute,
  investigate,
  mediate,
  newGame,
  policy,
  preview,
  reform,
  SAVE_KEY,
  serialize,
  transfer,
  unblock,
} from "./engine";
import {
  domainNames,
  factionNames,
  getCard,
  getOffice,
  getPerson,
  issueNames,
  offices,
  people,
} from "./data";
import type {
  Choice,
  ConflictType,
  Domain,
  FactionId,
  GameState,
  Issue,
  ProvinceId,
  Strategy,
} from "./types";
const domains: Domain[] = ["production", "social", "anomaly"];
const strategies: Record<ConflictType, { id: Strategy; label: string }[]> = {
  jurisdiction: [
    { id: "coordinate", label: "临时协调 · 1命令" },
    { id: "force", label: "强制指定 · 积怨" },
  ],
  route: [
    { id: "coordinate", label: "路线协调 · 1命令" },
    { id: "negotiate", label: "政治协议 · 1资本" },
    { id: "force", label: "强制执行 · 积怨" },
  ],
  interest: [
    { id: "coordinate", label: "征调协商 · 1命令" },
    { id: "compensate", label: "财政补偿 · 2财政" },
    { id: "delegate", label: "权限补偿 · 1资本" },
    { id: "force", label: "强制征调 · 积怨" },
  ],
};
const catNames = { base: "基础危机", chain: "连锁事件", active: "主动局势" };
const avatarColors = [
  "#61736b",
  "#7c7563",
  "#66717c",
  "#7f706c",
  "#737957",
  "#637d77",
];
function Avatar({
  id,
  size = 36,
}: {
  id: string | null | undefined;
  size?: number;
}) {
  const p = getPerson(id);
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background:
          avatarColors[
            Math.max(
              0,
              people.findIndex((p) => p.id === id),
            ) % 6
          ],
      }}
    >
      {p ? p.name.slice(0, 1) : "—"}
    </span>
  );
}
function WorldMap({
  selected,
  onSelect,
  dangers,
}: {
  selected: ProvinceId;
  onSelect: (id: ProvinceId) => void;
  dangers: Set<number>;
}) {
  return (
    <div className="map-wrap">
      <svg viewBox="0 0 380 330" role="img" aria-label="联邦三省示意地图">
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#cccdbb"
              strokeWidth=".5"
            />
          </pattern>
          <pattern
            id="water"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 6 Q3 3 6 6 T12 6"
              fill="none"
              stroke="#b9c4bd"
              strokeWidth=".5"
            />
          </pattern>
        </defs>
        <rect width="380" height="330" fill="#e6e8dc" />
        <rect width="380" height="330" fill="url(#grid)" />
        <path
          d="M0 278 Q80 245 110 282 T210 305 T380 245 L380 330H0Z"
          fill="url(#water)"
        />
        <g
          className="territory"
          onClick={() => onSelect("north")}
          role="button"
          aria-label="选择北境异常省"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect("north")}
        >
          <path
            d="M123 35L161 23 194 44 228 30 258 61 296 74 287 119 256 147 208 133 183 155 132 139 106 109Z"
            className={selected === "north" ? "selected north" : "north"}
          />
          <text x="205" y="91">
            北境异常省
          </text>
          <text x="205" y="109" className="map-en">
            NORTHERN FRONTIER
          </text>
        </g>
        <g
          className="territory"
          onClick={() => onSelect("industry")}
          role="button"
          aria-label="选择中央工业省"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect("industry")}
        >
          <path
            d="M106 109L132 139 183 155 208 133 256 147 278 178 256 217 213 228 180 211 155 229 119 207 93 223 62 198 72 157Z"
            className={
              selected === "industry" ? "selected industry" : "industry"
            }
          />
          <text x="168" y="178">
            中央工业省
          </text>
          <text x="168" y="197" className="map-en">
            CENTRAL INDUSTRIAL
          </text>
        </g>
        <g
          className="territory"
          onClick={() => onSelect("south")}
          role="button"
          aria-label="选择南岭修仙省"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect("south")}
        >
          <path
            d="M93 223L119 207 155 229 180 211 213 228 256 217 275 240 261 269 228 275 201 297 161 285 137 300 105 275 70 263Z"
            className={selected === "south" ? "selected south" : "south"}
          />
          <text x="175" y="255">
            南岭修仙省
          </text>
          <text x="175" y="273" className="map-en">
            SOUTHERN HIGHLANDS
          </text>
        </g>
        <path
          d="M224 62L201 124 155 179 182 242"
          stroke="#f8f5e7"
          strokeWidth="3"
          strokeDasharray="4 5"
          fill="none"
          pointerEvents="none"
        />
        {[
          [224, 62],
          [201, 124],
          [155, 179],
          [231, 184],
          [182, 242],
          [121, 259],
        ].map(([x, y], i) => (
          <g key={i} pointerEvents="none">
            <circle
              cx={x}
              cy={y}
              r={dangers.has(i) ? 7 : 4}
              fill={dangers.has(i) ? "#ba694b" : "#f9f7ed"}
              stroke="#65786d"
              strokeWidth="2"
            />
            {dangers.has(i) && (
              <circle
                cx={x}
                cy={y}
                r="13"
                stroke="#ba694b"
                fill="none"
                strokeDasharray="2 3"
              />
            )}
          </g>
        ))}
        <text x="28" y="38" className="map-compass">
          N
        </text>
        <path d="M32 45L27 62 32 57 37 62Z" fill="#64776d" />
        <text x="280" y="307" className="map-scale">
          0 ─── 200 km
        </text>
      </svg>
      <div className="map-caption">
        <span>
          <i className="dot green" />
          联邦辖区
        </span>
        <span>
          <i className="dot orange" />
          危机地点
        </span>
        <span>示意地图 / 01</span>
      </div>
    </div>
  );
}
function App() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [selected, setSelected] = useState<ProvinceId>("south");
  const [uid, setUid] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>({
    optionId: "public",
    strategies: {},
  });
  const [tab, setTab] = useState<"current" | "backlog">("current");
  const [modal, setModal] = useState<
    | "task"
    | "people"
    | "reform"
    | "policy"
    | "transfer"
    | "help"
    | "new"
    | "end"
    | null
  >(null);
  const [notice, setNotice] = useState("");
  const [seed, setSeed] = useState("南岭-071");
  const [demo, setDemo] = useState(true);
  const [officeId, setOfficeId] = useState("anomaly");
  const [personId, setPersonId] = useState("");
  const [domain, setDomain] = useState<Domain>("anomaly");
  const [reformOffice, setReformOffice] = useState("gov-south");
  const [issue, setIssue] = useState<Issue>("disclosure");
  const [side, setSide] = useState(1);
  const [from, setFrom] = useState<ProvinceId>("industry");
  const [to, setTo] = useState<ProvinceId>("south");
  const [forceTransfer, setForceTransfer] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [focusedPerson, setFocusedPerson] = useState("sergei");
  const province = state.provinces.find((p) => p.id === selected)!;
  const task = state.tasks.find((t) => t.uid === uid);
  const p = task ? preview(state, task.uid, choice) : null;
  const playing = state.status === "playing";
  function run(action: () => GameState, success?: string) {
    try {
      const n = action();
      setState(n);
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    }
  }
  function openTask(id: string) {
    const t = state.tasks.find((t) => t.uid === id)!;
    setUid(id);
    setChoice({ optionId: getCard(t.cardId).options[0].id, strategies: {} });
    setShowPreview(false);
    setModal("task");
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, serialize(state));
      setNotice(`已保存第${state.turn}季度，包含全部资源、人物与随机状态。`);
    } catch {
      setNotice("浏览器无法写入存档，请检查存储权限。");
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) throw new Error("还没有本地存档");
      setState(deserialize(raw));
      setModal(null);
      setUid(null);
      setNotice("已恢复完整存档。");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function restart() {
    setState(newGame(state.seed, true));
    setUid(null);
    setModal(null);
    setNotice("已用相同种子重启演示场景。");
  }
  const selectedPerson = getPerson(focusedPerson)!;
  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">
            <Globe2 size={25} />
          </span>
          <div>
            <h1>
              诸界联邦<span>FEDERATION OF WORLDS</span>
            </h1>
            <p>中央治理委员会 · 决策终端</p>
          </div>
          <span className="prototype">原型 v0.1</span>
        </div>
        <nav>
          <button onClick={() => setModal("help")}>
            <BookOpen size={15} />
            规则手册
          </button>
          <span className="nav-sep" />
          <button onClick={save}>
            <Save size={15} />
            存档
          </button>
          <button onClick={load}>
            <Download size={15} />
            读档
          </button>
          <button onClick={() => setModal("new")} className="new-btn">
            <Plus size={15} />
            新游戏
          </button>
        </nav>
      </header>
      <div className="resource-bar">
        <div className="turn-block">
          <span className="eyebrow">
            联邦历 · 第{Math.ceil(state.turn / 4)}年
          </span>
          <div>
            第 <strong>{String(state.turn).padStart(2, "0")}</strong> 季度{" "}
            <span>/ 08</span>
          </div>
        </div>
        <div className="resource">
          <Coins />
          <div>
            <span>中央财政</span>
            <strong>
              {state.treasury}
              <small>财政</small>
            </strong>
          </div>
        </div>
        <div className="resource commands">
          <ScrollText />
          <div>
            <span>行政命令</span>
            <strong>
              {state.commands}
              <small>/ {state.paralysis >= 2 ? 4 : 5}</small>
            </strong>
          </div>
          <div className="command-ticks">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} className={i < state.commands ? "filled" : ""} />
            ))}
          </div>
        </div>
        <div className="resource">
          <Landmark />
          <div>
            <span>政治资本</span>
            <strong>
              {state.capital}
              <small>资本</small>
            </strong>
          </div>
        </div>
        <div className="resource crisis">
          <Activity />
          <div>
            <span>全国危机</span>
            <strong>
              {state.crisis}
              <small>/ 12</small>
            </strong>
          </div>
          <div className="crisis-meter">
            <i style={{ width: `${(state.crisis / 12) * 100}%` }} />
          </div>
        </div>
        <div className="status-label">
          <i className={`dot ${state.crisis < 6 ? "green" : "orange"}`} />
          {state.status === "won"
            ? "任期完成"
            : state.status === "lost"
              ? "联邦失序"
              : state.crisis < 4
                ? "秩序尚可维持"
                : "局势需要关注"}
          <span>固定种子 · {state.seed}</span>
        </div>
      </div>
      <div className="workspace">
        <aside className="map-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / TERRITORIES</span>
              <h2>
                <MapPin size={17} />
                联邦疆域
              </h2>
            </div>
            <span className="badge">3省 · 6区</span>
          </div>
          <WorldMap
            selected={selected}
            onSelect={setSelected}
            dangers={
              new Set(
                state.tasks
                  .filter((t) => getCard(t.cardId).category !== "active")
                  .map((t) => {
                    const c = getCard(t.cardId);
                    return (
                      (c.province === "north"
                        ? 0
                        : c.province === "industry"
                          ? 2
                          : 4) + c.district
                    );
                  }),
              )
            }
          />
          <div className="province-tabs">
            {state.provinces.map((p) => (
              <button
                key={p.id}
                className={p.id === selected ? "active" : ""}
                onClick={() => setSelected(p.id)}
              >
                {p.name.slice(0, 2)}
                <span>{p.stock}</span>
              </button>
            ))}
          </div>
          <div className="province-card">
            <div className="province-title">
              <div>
                <h3>{province.name}</h3>
                <p>{province.subtitle}</p>
              </div>
              <span className="stock-badge">
                <Boxes size={16} />
                {province.stock}
              </span>
            </div>
            <div className="pressure-list">
              {domains.map((d) => (
                <div key={d}>
                  <span>{domainNames[d]}压力</span>
                  <div className={`pressure-dots ${d}`}>
                    {Array.from(
                      {
                        length: Math.max(4, Math.min(8, province.pressure[d])),
                      },
                      (_, i) => (
                        <i
                          key={i}
                          className={i < province.pressure[d] ? "on" : ""}
                        />
                      ),
                    )}
                  </div>
                  <b>{province.pressure[d]}</b>
                </div>
              ))}
            </div>
            {domains.some((d) => province.pressure[d] >= 2) && (
              <div className="inline-warning">
                <AlertTriangle size={13} />
                下季度将触发连锁事件，每类消耗2压力
              </div>
            )}
            <div className="districts">
              {province.districts.map((d, i) => (
                <div key={d.name} className="district">
                  <span className="district-icon">
                    {i === 0 ? <Zap size={17} /> : <Building2 size={17} />}
                  </span>
                  <div>
                    <b>{d.name}</b>
                    <span>{d.type}</span>
                  </div>
                  <span className="output">
                    +{d.output}
                    <Boxes size={12} />
                  </span>
                </div>
              ))}
            </div>
            <div className="governor">
              <Avatar id={state.appointments[`gov-${selected}`]} size={30} />
              <div>
                <span>省政府负责人</span>
                <b>
                  {getPerson(state.appointments[`gov-${selected}`])?.name ||
                    "职位空缺"}
                </b>
              </div>
              <button
                onClick={() => {
                  setOfficeId(`gov-${selected}`);
                  setPersonId("");
                  setFocusedPerson(
                    state.appointments[`gov-${selected}`] || "bai",
                  );
                  setModal("people");
                }}
                aria-label="调整省政府负责人"
              >
                <Settings2 size={16} />
              </button>
            </div>
            <div className="autonomy">
              <span>地方自治特权</span>
              <b>{province.autonomy}</b>
            </div>
            {state.tasks.filter((t) => getCard(t.cardId).province === selected)
              .length > 0 && (
              <div className="local-matters">
                {state.tasks
                  .filter((t) => getCard(t.cardId).province === selected)
                  .map((t) => (
                    <button key={t.uid} onClick={() => openTask(t.uid)}>
                      <i className="dot orange" />
                      {getCard(t.cardId).title}
                      <ChevronRight size={12} />
                    </button>
                  ))}
              </div>
            )}
            {state.projects
              .filter((p) => p.province === selected)
              .map((p) => (
                <div className="project" key={p.id}>
                  <Layers size={14} />
                  <span>
                    {p.name}
                    <small>
                      产出 +{p.output} · 已运行{p.age}季度
                    </small>
                  </span>
                  {p.risk && <AlertTriangle size={13} />}
                </div>
              ))}
          </div>
          <div className="map-note">
            <Compass size={16} />
            <p>
              每个省都在运转。
              <br />
              <span>但没有一种秩序能让所有人满意。</span>
            </p>
          </div>
        </aside>
        <main className="events-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / MATTERS OF STATE</span>
              <h2>
                <Layers size={17} />
                当前事务
              </h2>
            </div>
            <span className="live">
              <i className="dot orange" />
              行动阶段
            </span>
          </div>
          <div className="event-tabs">
            <button
              className={tab === "current" ? "active" : ""}
              onClick={() => setTab("current")}
            >
              立即处理 <span>{state.tasks.length}</span>
            </button>
            <button
              className={tab === "backlog" ? "active" : ""}
              onClick={() => setTab("backlog")}
            >
              公开待办 <span>{state.backlog.length}</span>
            </button>
            <span className="admission">本季接纳 {state.admitted}/3</span>
          </div>
          <div className="events-scroll">
            {(tab === "current" ? state.tasks : state.backlog).map(
              (t, index) => {
                const c = getCard(t.cardId),
                  pr = state.provinces.find((p) => p.id === c.province)!;
                return (
                  <article
                    className={`event-card ${c.category === "active" ? "opportunity" : ""}`}
                    key={t.uid}
                    data-task-id={t.uid}
                  >
                    <div className="card-top">
                      <span className="card-type">
                        {c.category === "active" ? (
                          <Sparkles size={13} />
                        ) : (
                          <AlertTriangle size={13} />
                        )}{" "}
                        {catNames[c.category]}
                      </span>
                      <span className="card-number">
                        档案 {String(index + 1).padStart(3, "0")} / Q{t.created}
                      </span>
                    </div>
                    <div className="event-location">
                      <MapPin size={12} />
                      {pr.name} · {pr.districts[c.district].name}
                    </div>
                    <h3>{c.title}</h3>
                    <p className="event-description">{c.description}</p>
                    <div className="event-tags">
                      <span>{domainNames[c.domain]}事务</span>
                      <span>
                        {
                          getOffice(
                            state.jurisdictions[`${c.province}:${c.domain}`] ||
                              c.lead,
                          ).short
                        }
                        主责
                      </span>
                      <span>中央 × 地方</span>
                    </div>
                    {c.id === "base-0" && (
                      <div className="conflict-summary">
                        <span>
                          <span className="conflict-symbol">权</span>事权重叠
                        </span>
                        <span>
                          <span className="conflict-symbol">策</span>路线分歧
                        </span>
                        <span>
                          <span className="conflict-symbol">资</span>资源征调
                        </span>
                      </div>
                    )}
                    <div className="event-bottom">
                      <span>
                        {c.category === "active"
                          ? "机会保留2个季度"
                          : t.age
                            ? `已延期${t.age}季度 · 每季继续恶化`
                            : "未处理：危机 +1 / 压力 +1"}
                      </span>
                      {tab === "current" ? (
                        <button
                          className="button-primary"
                          onClick={() => openTask(t.uid)}
                          disabled={!playing}
                        >
                          审议事务 <ArrowRight size={14} />
                        </button>
                      ) : (
                        <span className="badge">下季度接纳</span>
                      )}
                    </div>
                  </article>
                );
              },
            )}
            {(tab === "current" ? state.tasks : state.backlog).length === 0 && (
              <div className="empty-state">
                <Check size={32} />
                <h3>
                  {tab === "current" ? "本季事务已处理" : "待办栏暂无事务"}
                </h3>
                <p>
                  {tab === "current"
                    ? "秩序是暂时的。你可以投资未来，或调整国家机器。"
                    : "每季度最多3张新事件进入立即处理区。"}
                </p>
              </div>
            )}
            <div className="agenda-card">
              <div>
                <span className="eyebrow">主动塑造局势</span>
                <h3>危机之外，仍有选择。</h3>
                <p>支付1枚命令揭牌。机会与后果同时到来。</p>
              </div>
              <div className="explore-actions">
                {(
                  [
                    { id: "survey", name: "调查灵脉", icon: Search },
                    { id: "build", name: "建设探索", icon: Building2 },
                    { id: "reform", name: "制度探索", icon: Landmark },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      run(
                        () => investigate(state, a.id),
                        "已揭开主动局势。请留意压力变化与待办栏。",
                      )
                    }
                    disabled={!playing || state.commands < 1}
                  >
                    <a.icon size={18} />
                    <span>{a.name}</span>
                    <small>
                      1命令 <ArrowRight size={12} />
                    </small>
                  </button>
                ))}
              </div>
            </div>
            <div className="forecast">
              <Radio size={16} />
              <div>
                <b>未来局势预告</b>
                <p>
                  {state.provinces.some((p) =>
                    domains.some((d) => p.pressure[d] >= 2),
                  )
                    ? "部分省份压力已达到阈值，下季度会生成连锁事件。"
                    : "当前各类压力低于连锁阈值。下一季度将揭开新的基础危机。"}
                </p>
              </div>
            </div>
          </div>
        </main>
        <aside className="machine-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / STATE APPARATUS</span>
              <h2>
                <Landmark size={17} />
                国家机器
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="人事管理"
              onClick={() => setModal("people")}
            >
              <Settings2 size={17} />
            </button>
          </div>
          <div className="offices">
            {offices
              .filter((o) => !o.province)
              .map((o, i) => {
                const person = getPerson(state.appointments[o.id]);
                return (
                  <button
                    className="office-card"
                    key={o.id}
                    onClick={() => {
                      setOfficeId(o.id);
                      setPersonId("");
                      setFocusedPerson(person?.id || "sergei");
                      setModal("people");
                    }}
                  >
                    <div className="office-top">
                      <span className="office-symbol">
                        {i === 0 ? (
                          <Building2 size={16} />
                        ) : i === 1 ? (
                          <Shield size={16} />
                        ) : (
                          <Sparkles size={16} />
                        )}
                      </span>
                      <span>{o.name}</span>
                      <ChevronRight size={14} />
                    </div>
                    <div className="office-person">
                      <Avatar id={person?.id} />
                      <div>
                        <b>{person?.name || "职位空缺"}</b>
                        <span>{person?.title || "事务无法主持"}</span>
                      </div>
                      <span
                        className={`grievance ${person && state.grievances[person.id] >= 2 ? "high" : ""}`}
                      >
                        {person ? `积怨 ${state.grievances[person.id]}` : "—"}
                      </span>
                    </div>
                    <div className="office-skills">
                      {o.domains.map((d) => (
                        <span key={d}>
                          {domainNames[d]} <b>{person?.skills[d] || 0}</b>
                        </span>
                      ))}
                      <span className="faction-label">
                        {person
                          ? factionNames[person.faction]
                              .replace("集团", "")
                              .replace("革命", "")
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="factions-heading">
            <h3>
              <Users size={15} />
              政治派系
            </h3>
            <span>影响 / 不满</span>
          </div>
          <div className="factions">
            {(
              Object.keys(state.factions) as (keyof typeof state.factions)[]
            ).map((id, i) => (
              <div key={id}>
                <div className="faction-row">
                  <span>
                    <i className={`faction-dot f${i}`} />
                    {factionNames[id]}
                  </span>
                  <b>
                    {state.factions[id].influence}
                    <small> / {state.factions[id].discontent}</small>
                  </b>
                </div>
                <div className="faction-track">
                  <i
                    className={`f${i}`}
                    style={{
                      width: `${Math.min(100, (state.factions[id].influence / 14) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="institutions-note">
            <LockKeyhole size={16} />
            <div>
              <b>权力不是免费的。</b>
              <p>关键职位提供派系优势；积怨与自治会改变未来事务的成本。</p>
            </div>
          </div>
          {state.paralysis > 0 && (
            <div className="paralysis-warning">
              <AlertTriangle size={16} />
              <b>行政阻塞 {state.paralysis} / 4</b>
              <p>阻塞≥2，下季命令减少1；连续两季≥4失败。</p>
              <button
                onClick={() => run(() => unblock(state))}
                disabled={!playing}
              >
                紧急疏通 · 1命令 + 1财政
              </button>
            </div>
          )}
          <div className="policies-mini">
            <h3>全国政策</h3>
            {(Object.keys(issueNames) as Issue[]).map((i) => (
              <div key={i}>
                <span>{issueNames[i].join(" / ")}</span>
                <b>
                  {state.policies[i] === null
                    ? "未定路线"
                    : issueNames[i][state.policies[i]!]}
                </b>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <section className="decision-log">
        <div className="log-title">
          <ScrollText size={16} />
          <b>决策记录</b>
          <span>DECISION ARCHIVE</span>
        </div>
        <div className="log-content">
          {state.logs.slice(0, 3).map((l, i) => (
            <div className={`log-line ${l.kind}`} key={i}>
              <span>Q{String(l.turn).padStart(2, "0")}</span>
              <p>{l.text}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setModal("help")}>
          全部记录 <ChevronRight size={14} />
        </button>
      </section>
      <footer className="action-bar">
        <div className="action-group">
          <button onClick={() => setModal("people")} disabled={!playing}>
            <Users size={16} />
            人事任命<small>1命令</small>
          </button>
          <button onClick={() => setModal("reform")} disabled={!playing}>
            <Settings2 size={16} />
            权限改革<small>1命令 / 2+资本</small>
          </button>
          <button onClick={() => setModal("transfer")} disabled={!playing}>
            <ArrowDownUp size={16} />
            物资调拨<small>1–2命令</small>
          </button>
          <button onClick={() => setModal("policy")} disabled={!playing}>
            <Flag size={16} />
            政策路线<small>1命令 / 1资本</small>
          </button>
        </div>
        <button
          className="end-turn"
          onClick={() => setModal("end")}
          disabled={!playing}
        >
          结束本季度 <ArrowRight size={17} />
        </button>
      </footer>
      <div className="footer-caption">
        <span>诸界联邦 · 单人 PvE 策略原型</span>
        <span>没有完美的组织，只有可以承担的后果。</span>
        <button onClick={() => setModal("help")}>
          <CircleHelp size={12} />
          游戏帮助
        </button>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="关闭提示">
            <X size={15} />
          </button>
        </div>
      )}
      {state.status !== "playing" && !modal && (
        <div className="modal-overlay">
          <div className="modal ending">
            <span className="eyebrow">FEDERATION / FINAL REPORT</span>
            <h2>
              {state.status === "won" ? "联邦仍在运转。" : "国家机器停止运转。"}
            </h2>
            <p>{state.ending}</p>
            <div className="ending-stats">
              <div>
                中央财政<strong>{state.treasury}</strong>
              </div>
              <div>
                完成事务<strong>{state.resolved}</strong>
              </div>
              <div>
                危机指标<strong>{state.crisis}/12</strong>
              </div>
            </div>
            <div className="ending-report">
              <p>
                累积危机{" "}
                {
                  state.logs.filter(
                    (l) =>
                      l.text.startsWith("揭开基础危机") ||
                      l.text.startsWith("揭开连锁事件"),
                  ).length
                }{" "}
                / 未完成危机{" "}
                {
                  state.tasks.filter(
                    (t) => getCard(t.cardId).category !== "active",
                  ).length
                }{" "}
                / 待办 {state.backlog.length}
              </p>
              {state.provinces.map((p) => (
                <p key={p.id}>
                  {p.name}：物资 {p.stock} / 生产 {p.pressure.production} · 社会{" "}
                  {p.pressure.social} · 异常 {p.pressure.anomaly} / 自治{" "}
                  {p.autonomy}
                </p>
              ))}
              {(Object.keys(state.factions) as FactionId[]).map((id) => (
                <p key={id}>
                  {factionNames[id]}：影响 {state.factions[id].influence} / 不满{" "}
                  {state.factions[id].discontent}
                </p>
              ))}
              <p>
                人物积怨：
                {people
                  .map((p) => `${p.name} ${state.grievances[p.id]}`)
                  .join(" · ")}
              </p>
              <h4>关键政策与组织调整</h4>
              {state.logs
                .filter((l) =>
                  /政策调整|组织改革|人事调整|负责人|省政府.*→|权限补偿/.test(
                    l.text,
                  ),
                )
                .map((l, i) => (
                  <p key={i}>
                    Q{l.turn} · {l.text}
                  </p>
                ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal("help")}>查看完整决策记录</button>
              <button className="button-primary" onClick={restart}>
                <RotateCcw size={15} />
                重新开始
              </button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === "task" ? "task-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="治理决策"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="关闭"
            >
              <X size={20} />
            </button>
            {modal === "task" && p && (
              <>
                <span className="eyebrow">
                  议事档案 / {catNames[p.card.category]}
                </span>
                <h2>{p.card.title}</h2>
                <p className="modal-intro">{p.card.description}</p>
                <div className="participants">
                  {p.participants.map(({ office, person }) => (
                    <div key={office.id}>
                      <Avatar id={person?.id} size={28} />
                      <span>
                        <b>{person?.name || "空缺"}</b>
                        <small>
                          {office.short}
                          {office.id === p.lead ? " · 主持" : ""}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                <h4 className="form-heading">01 / 选择处置路线</h4>
                <div className="option-grid">
                  {p.card.options.map((o) => (
                    <button
                      key={o.id}
                      className={`option-card ${choice.optionId === o.id ? "selected" : ""}`}
                      onClick={() => {
                        setChoice({ ...choice, optionId: o.id });
                        setShowPreview(false);
                      }}
                    >
                      <span className="radio-circle">
                        {choice.optionId === o.id && <i />}
                      </span>
                      <b>{o.name}</b>
                      <p>{o.description}</p>
                      <small>
                        原始成本 {o.commands}命令 · {o.treasury}财政 · {o.stock}
                        地方物资
                      </small>
                    </button>
                  ))}
                </div>
                <h4 className="form-heading">
                  02 / 动态冲突 · {p.conflicts.length} 项
                </h4>
                {p.conflicts.length === 0 && (
                  <p className="no-conflict">
                    <Check size={14} />
                    当前参与者与权限配置未产生基础冲突。
                  </p>
                )}
                {p.conflicts.map((c) => (
                  <div className="conflict-detail" key={c.type}>
                    <div>
                      <span className="conflict-symbol">
                        {c.type === "jurisdiction"
                          ? "权"
                          : c.type === "route"
                            ? "策"
                            : "资"}
                      </span>
                      <b>{c.title}</b>
                    </div>
                    <p>{c.reason}</p>
                    <label>
                      处理方式
                      <select
                        value={c.strategy}
                        onChange={(e) => {
                          setChoice({
                            ...choice,
                            strategies: {
                              ...choice.strategies,
                              [c.type]: e.target.value as Strategy,
                            },
                          });
                          setShowPreview(false);
                        }}
                      >
                        {strategies[c.type].map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} />
                    </label>
                    <small>{c.future}</small>
                  </div>
                ))}
                <div className="preview-controls">
                  <span>
                    专业能力{" "}
                    <b>
                      {p.ability} / {p.required}
                    </b>
                    {p.resentmentCost > 0 && " · 主持人积怨阻力 +1命令"}
                  </span>
                  <button
                    className="button-outline"
                    onClick={() => setShowPreview(true)}
                  >
                    <Search size={14} />
                    预览执行
                  </button>
                </div>
                {showPreview && (
                  <div className="execution-preview">
                    <h4>结算预览 · 不会立即执行</h4>
                    <div className="cost-equation">
                      {p.base} 原始命令 +{" "}
                      {p.conflicts.reduce((a, c) => a + c.commands, 0)} 冲突协调
                      + {p.resentmentCost} 积怨阻力 = <b>{p.commands} 命令</b>
                    </div>
                    <div className="preview-resources">
                      <span>
                        命令{" "}
                        <b>
                          {state.commands} → {p.final.commands}
                        </b>
                      </span>
                      <span>
                        财政{" "}
                        <b>
                          {state.treasury} → {p.final.treasury}
                        </b>
                      </span>
                      <span>
                        资本{" "}
                        <b>
                          {state.capital} → {p.final.capital}
                        </b>
                      </span>
                      <span>
                        当地物资{" "}
                        <b>
                          {
                            state.provinces.find(
                              (x) => x.id === p.card.province,
                            )!.stock
                          }{" "}
                          → {p.final.stock}
                        </b>
                      </span>
                    </div>
                    <p className="preview-caption">
                      以上为扣除成本并应用补偿与方案效果后的最终余额；压力、项目和政治后果如下。
                    </p>
                    <ul>
                      {[...p.conflicts.map((c) => c.future), ...p.effects].map(
                        (e, i) => (
                          <li key={i}>{e}</li>
                        ),
                      )}
                    </ul>
                    {p.errors.length > 0 && (
                      <div className="inline-warning">
                        <AlertTriangle size={15} />
                        {p.errors.join("；")}
                      </div>
                    )}
                  </div>
                )}
                <div className="modal-actions">
                  {p.card.category === "active" ? (
                    <button
                      onClick={() => {
                        if (run(() => abandon(state, p.task.uid)))
                          setModal(null);
                      }}
                    >
                      放弃机会（揭牌后果保留）
                    </button>
                  ) : (
                    <button onClick={() => setModal(null)}>暂缓处理</button>
                  )}
                  <button
                    className="button-primary"
                    disabled={!showPreview || p.errors.length > 0}
                    onClick={() => {
                      if (
                        run(
                          () => execute(state, p.task.uid, choice),
                          "事务已执行，全部政治后果已记录。",
                        )
                      )
                        setModal(null);
                    }}
                  >
                    确认执行 <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
            {modal === "people" && (
              <>
                <span className="eyebrow">STATE APPARATUS / 人事</span>
                <h2>每个位置，都改变一种可能。</h2>
                <p className="modal-intro">
                  任命或免职消耗1命令。人物只能占据一个职位；在任满2季度后免职会增加1积怨。
                </p>
                <label className="form-field">
                  目标职位
                  <select
                    value={officeId}
                    onChange={(e) => {
                      setOfficeId(e.target.value);
                      setPersonId("");
                    }}
                  >
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ·{" "}
                        {getPerson(state.appointments[o.id])?.name || "空缺"}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="person-roster">
                  {people.map((person) => {
                    const position = Object.entries(state.appointments).find(
                      ([, p]) => p === person.id,
                    )?.[0];
                    return (
                      <button
                        key={person.id}
                        className={
                          focusedPerson === person.id ? "selected" : ""
                        }
                        onClick={() => {
                          setFocusedPerson(person.id);
                          if (!position) setPersonId(person.id);
                        }}
                      >
                        <Avatar id={person.id} size={30} />
                        <span>
                          <b>{person.name}</b>
                          <small>
                            {position ? getOffice(position).short : "待任命"}
                          </small>
                        </span>
                        <span className="roster-grievance">
                          {state.grievances[person.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="person-detail">
                  <h3>
                    {selectedPerson.name} <small>{selectedPerson.title}</small>
                  </h3>
                  <p>
                    {factionNames[selectedPerson.faction]} · 积怨{" "}
                    {state.grievances[selectedPerson.id]} / 职务根基{" "}
                    {state.roots[selectedPerson.id]}
                  </p>
                  <div className="person-skills">
                    {domains.map((d) => (
                      <span key={d}>
                        {domainNames[d]} <b>{selectedPerson.skills[d]}</b>
                      </span>
                    ))}
                  </div>
                  <p>{selectedPerson.ability}</p>
                  <div className="stance-tags">
                    {(Object.keys(issueNames) as Issue[]).map((i) => (
                      <span key={i}>
                        {issueNames[i][selectedPerson.stance[i]]}
                      </span>
                    ))}
                  </div>
                  {state.grievances[selectedPerson.id] >= 2 && (
                    <p className="text-danger">
                      积怨≥2：主持额外消耗1命令。积怨≥3：拒绝协办。
                    </p>
                  )}
                  {state.grievances[selectedPerson.id] > 0 && (
                    <button
                      className="button-outline"
                      onClick={() =>
                        run(() => mediate(state, selectedPerson.id))
                      }
                    >
                      政治和解 · 1命令 + 1资本
                    </button>
                  )}
                </div>
                <label className="form-field">
                  任命选择
                  <select
                    value={personId}
                    onChange={(e) => setPersonId(e.target.value)}
                  >
                    <option value="">免职 / 保持职位空缺</option>
                    {people
                      .filter(
                        (p) =>
                          !Object.values(state.appointments).includes(p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <span>禁止一人多职；调任请先免职。</span>
                  <button
                    className="button-primary"
                    onClick={() =>
                      run(
                        () => appoint(state, officeId, personId || null),
                        "人事调整已生效。",
                      )
                    }
                  >
                    确认{personId ? "任命" : "免职"} · 1命令
                  </button>
                </div>
              </>
            )}
            {modal === "reform" && (
              <>
                <span className="eyebrow">AUTHORITY / 组织改革</span>
                <h2>将争议写成制度。</h2>
                <p className="modal-intro">
                  支付1命令和2政治资本，永久指定某省某领域的主责机构。安全集团影响≥4时，将异常权限授予地方额外支付1资本。
                </p>
                <label className="form-field">
                  管辖省份
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value as ProvinceId);
                      setReformOffice(`gov-${e.target.value}`);
                    }}
                  >
                    {state.provinces.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  事务领域
                  <select
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value as Domain);
                      setReformOffice(`gov-${selected}`);
                    }}
                  >
                    {domains.map((d) => (
                      <option key={d} value={d}>
                        {domainNames[d]}事务
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  主责机构
                  <select
                    value={reformOffice}
                    onChange={(e) => setReformOffice(e.target.value)}
                  >
                    {offices
                      .filter(
                        (o) =>
                          o.domains.includes(domain) &&
                          (!o.province || o.province === selected),
                      )
                      .map((o) => (
                        <option value={o.id} key={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="explanation-box">
                  <b>制度后果</b>
                  <p>
                    同省同类事务将不再触发事权冲突。主管机构负责人改变，能力与积怨阻力随之改变。地方获得主责时自治
                    +1。路线与利益冲突仍按实际事务判断。
                  </p>
                  <p>
                    当前主责：
                    {state.jurisdictions[`${selected}:${domain}`]
                      ? getOffice(state.jurisdictions[`${selected}:${domain}`])
                          .name
                      : "中央与地方重叠"}
                  </p>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>取消</button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      if (
                        run(
                          () => reform(state, selected, domain, reformOffice),
                          "主责改革已生效；下一次预览将使用新权限。",
                        )
                      )
                        setModal(null);
                    }}
                  >
                    确认改革
                  </button>
                </div>
              </>
            )}
            {modal === "policy" && (
              <>
                <span className="eyebrow">POLICY / 全国路线</span>
                <h2>一条路线，许多种代价。</h2>
                <p className="modal-intro">
                  政策消耗1命令与1政治资本。后续偏离该路线的事务额外消耗1命令，支持政策的在任人物为派系贡献影响力。
                </p>
                <label className="form-field">
                  政策议题
                  <select
                    value={issue}
                    onChange={(e) => setIssue(e.target.value as Issue)}
                  >
                    {(Object.keys(issueNames) as Issue[]).map((i) => (
                      <option key={i} value={i}>
                        {issueNames[i].join(" / ")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="option-grid">
                  {issueNames[issue].map((label, i) => (
                    <button
                      key={label}
                      className={`option-card ${side === i ? "selected" : ""}`}
                      onClick={() => setSide(i)}
                    >
                      <b>{label}</b>
                      <p>
                        支持：
                        {people
                          .filter(
                            (p) =>
                              Object.values(state.appointments).includes(
                                p.id,
                              ) && p.stance[issue] === i,
                          )
                          .map((p) => p.name)
                          .join("、")}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>取消</button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      if (run(() => policy(state, issue, side))) setModal(null);
                    }}
                  >
                    确认路线
                  </button>
                </div>
              </>
            )}
            {modal === "transfer" && (
              <>
                <span className="eyebrow">RESOURCES / 物资调拨</span>
                <h2>资源总是属于某个人。</h2>
                <p className="modal-intro">
                  调拨2物资，基础成本1命令。正常协商额外消耗1命令；强制征调免除协调成本，但调出省负责人积怨
                  +1。
                </p>
                <label className="form-field">
                  调出省份
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value as ProvinceId)}
                  >
                    {state.provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · 库存 {p.stock}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  调入省份
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value as ProvinceId)}
                  >
                    {state.provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · 库存 {p.stock}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={forceTransfer}
                    onChange={(e) => setForceTransfer(e.target.checked)}
                  />
                  强制征调：1命令，受损省长积怨 +1
                </label>
                <div className="explanation-box">
                  <b>执行预览</b>
                  <p>
                    命令 {state.commands} →{" "}
                    {state.commands - (forceTransfer ? 1 : 2)} ·{" "}
                    {state.provinces.find((p) => p.id === from)!.name}物资{" "}
                    {state.provinces.find((p) => p.id === from)!.stock} →{" "}
                    {state.provinces.find((p) => p.id === from)!.stock - 2} ·{" "}
                    {state.provinces.find((p) => p.id === to)!.name}物资{" "}
                    {state.provinces.find((p) => p.id === to)!.stock} →{" "}
                    {state.provinces.find((p) => p.id === to)!.stock + 2}
                  </p>
                  <p>
                    {from === to
                      ? "请选择不同省份"
                      : forceTransfer
                        ? `${getPerson(state.appointments[`gov-${from}`])?.name || "岗位空缺"}将承担征调积怨`
                        : "支付1命令，与实际受损的地方政府达成征调协议。"}
                  </p>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>取消</button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      if (run(() => transfer(state, from, to, forceTransfer)))
                        setModal(null);
                    }}
                  >
                    确认调拨
                  </button>
                </div>
              </>
            )}
            {modal === "new" && (
              <>
                <span className="eyebrow">NEW SESSION / 新的任期</span>
                <h2>诸界的未来，从这里开始。</h2>
                <p className="modal-intro">
                  新游戏会替换当前进度，不会覆盖已有存档。相同种子和相同操作会产生相同结果。
                </p>
                <label className="form-field">
                  随机种子
                  <input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    maxLength={64}
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={demo}
                    onChange={(e) => setDemo(e.target.checked)}
                  />
                  从「南岭灵脉电站事故」演示场景开始
                </label>
                <div className="modal-actions">
                  <button onClick={restart}>
                    <RotateCcw size={14} />
                    相同种子重开演示
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      setState(newGame(seed || "南岭-071", demo));
                      setUid(null);
                      setSelected("south");
                      setModal(null);
                      setNotice("新的8季度任期已开始。");
                    }}
                  >
                    开始新游戏
                  </button>
                </div>
              </>
            )}
            {modal === "end" && (
              <>
                <span className="eyebrow">QUARTERLY SETTLEMENT / 季度结算</span>
                <h2>
                  {state.turn === 8
                    ? "结束任期，提交最终报告。"
                    : "让国家机器继续运转。"}
                </h2>
                <p className="modal-intro">
                  结算后无法撤回。请留意未处理事务和下一季度压力。
                </p>
                <div className="settlement-list">
                  <p>
                    <Boxes size={17} />
                    三省基础产出各 +3物资；项目按产出结算。
                  </p>
                  <p>
                    <Coins size={17} />
                    先支付最低行政支出4财政，再获得税收5财政；政治资本 +1。
                  </p>
                  <p>
                    <ScrollText size={17} />
                    剩余 {state.commands} 命令作废，下季重置为
                    {state.paralysis >= 2 ? 4 : 5}。
                  </p>
                  <p>
                    <AlertTriangle size={17} />
                    未处理危机{" "}
                    {
                      state.tasks.filter(
                        (t) => getCard(t.cardId).category !== "active",
                      ).length
                    }{" "}
                    项，各按卡牌后果恶化。
                  </p>
                  {state.tasks
                    .filter((t) => getCard(t.cardId).category !== "active")
                    .map((t) => (
                      <small key={t.uid}>
                        「{getCard(t.cardId).title}」：危机 +1，地区压力 +1
                        {t.age >= 2 ? "，超过时限额外危机 +1" : ""}
                      </small>
                    ))}
                  <p>
                    <Radio size={17} />
                    压力 ≥2 生成连锁；先接纳待办，每季最多3张新增事件。
                  </p>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>继续本季度</button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      if (run(() => endTurn(state))) setModal(null);
                    }}
                  >
                    确认结算 <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <span className="eyebrow">FIELD MANUAL / 治理手册</span>
                <h2>不是找到完美的人，而是安排合适的权力。</h2>
                <div className="help-content">
                  <h3>你的目标</h3>
                  <p>
                    度过8个季度。危机达到12、连续两次财政违约，或行政阻塞连续两季达到4，即告失败。每季5命令，不结转；行政阻塞≥2时下季4命令。
                  </p>
                  <h3>三个冲突，一次真实决策</h3>
                  <p>
                    事权：中央与省政府权限重叠。路线：参与者反对所选方案。利益：地方被征调物资而没有协议。每类最多1枚，通常各消耗1命令。强制免去协调成本，但明确的反对者每项积怨
                    +1。
                  </p>
                  <h3>南岭演示的三条路径</h3>
                  <p>
                    正常协调：公开处置，消耗4命令、1财政、2物资，无新增积怨。强制执行：全部强制，仅1命令，但省长承担事权和征调两项积怨，异常局长承担路线积怨。组织改革：先支付1命令、2资本授予异常局主责，再协调公开处置，事务只需3命令；今后南岭异常事务不再争夺事权。
                  </p>
                  <h3>人物与派系</h3>
                  <p>
                    积怨2：主持额外1命令。积怨3：拒绝协办，并一次性触发危机
                    +1政治事件。用1命令+1资本调解可降低积怨。任职每季根基
                    +1；根基≥2时免职新增积怨。关键职位每个贡献2影响，支持的政策和方案提供影响。影响≥4时派系擅长领域能力
                    +1；不满≥4时本派主持能力 -1。
                  </p>
                  <h3>连锁与长期项目</h3>
                  <p>
                    压力在季度末结算后检测，达到2则在下季生成一张同省同类连锁并消耗2压力。新揭牌增加的压力留到以后检测。重大危机额外揭3张，额外牌不会再次触发抽牌。未处理危机每季恶化，延期3季失效并额外危机
                    +1。主动机会保留2季，揭牌压力不可撤销。
                  </p>
                  <h3>资源与制度</h3>
                  <p>
                    三省六区每季产出各3物资；先支付行政支出4，再收到税收5；无力支付计一次违约。全国政策变更1命令+1资本，偏离该政策的事务额外1命令。临时协调只解决本次冲突；改革永久改变当地该领域主责。详细规则、安装方式与测试见仓库
                    RULES.md 和 README.md。
                  </p>
                  <h3>完整决策记录 · {state.logs.length} 条</h3>
                  <div className="full-log">
                    {state.logs.map((l, i) => (
                      <div key={i} className={`log-line ${l.kind}`}>
                        <span>Q{l.turn}</span>
                        <p>{l.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
