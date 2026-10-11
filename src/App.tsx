import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flag,
  Globe2,
  Landmark,
  Layers,
  Save,
  Sparkles,
  Users,
  X,
  Zap,
  AlertTriangle,
  ScrollText,
  MapPin,
  Download,
  Menu,
  Factory,
  Target,
  Bell,
  History as HistoryIcon,
  Settings,
  Play,
  ChevronRight,
} from "lucide-react";
import {
  coreAbilities,
  goals,
  strategyDetails,
  plansFor,
  regimes,
  capNames,
} from "./v2/data";
import {
  capability,
  deserializeV2,
  duration,
  executeCommand,
  startCampaign,
  matterProgress,
  resultNames,
  finance,
  milestones,
  newV2,
  participants,
  previewAction,
  report,
  SAVE_V2,
  serializeV2,
} from "./v2/engine";
import {
  domainNames,
  factionNames,
  getOffice,
  getPerson,
  issueNames,
  offices,
  people,
} from "./data";
import type {
  Action,
  ActionResult,
  Difficulty,
  Goal,
  Mode,
  V2Game,
} from "./v2/model";
import type { Issue, ProvinceId } from "./types";
import { PanelFrame } from "./ui/PanelFrame";
import { TurnReview } from "./ui/TurnReview";
import { AdministrativeConsole } from "./ui/AdministrativeConsole";
import {
  OrganizationDiagram,
  ReformImpact,
  LastingReforms,
} from "./ui/ReformAuthority";
import { workSpecs, hasDepartment } from "./v2/administration";
import { GameMap } from "./ui/GameMap";
import { Tooltip } from "./ui/Tooltip";
import { PersonBadge, EventArt } from "./ui/Visuals";
import "./ui/command.css";
type Panel =
  | "briefing"
  | "staff"
  | "reform"
  | "policy"
  | "help"
  | "central"
  | "economy"
  | "goals"
  | "matters"
  | "local"
  | "history"
  | "settings"
  | "pause";
const difficultyNames = {
  standard: "标准",
  relaxed: "宽裕",
  challenging: "紧缩",
};
const titles: Record<Panel, string> = {
  briefing: "初始国情报告",
  staff: "人事管理",
  reform: "政策改革",
  policy: "全国政策",
  help: "规则与操作帮助",
  central: "中央政府",
  economy: "经济建设",
  goals: "国家目标",
  matters: "国家事务",
  local: "地方档案",
  history: "因果历史",
  settings: "设置",
  pause: "暂停菜单",
};
const departmentNames: Record<V2Game["machine"]["department"], string> = {
  none: "暂无全国部门改革",
  anomaly: "全国异常垂直主责",
  evacuation: "各省独立疏散权",
  transport: "中央跨省运输体系",
};
const lessons = [
  {
    title: "01 · 人物不是数值工具",
    body: "任命星野澪为南岭负责人，再执行群众参与预防巡检。",
    panel: "staff" as Panel,
  },
  {
    title: "02 · 先确定谁能参与",
    body: "为事故授权：南岭主持、中央协办，再公开救援。",
    panel: "reform" as Panel,
  },
  {
    title: "03 · 看清财政承诺",
    body: "核对收入、固定支出和施工承诺，再确认财政预测。",
    panel: "economy" as Panel,
  },
  {
    title: "04 · 你的决定改变下一场危机",
    body: "处理真实救援路径产生的能源配给争议，查看来源。",
    panel: "matters" as Panel,
  },
  {
    title: "教学完成",
    body: "可以继续四回合战役，也可以返回主菜单选择国家目标。",
    panel: "goals" as Panel,
  },
];
function savedGame() {
  try {
    const raw = localStorage.getItem(SAVE_V2);
    return raw ? deserializeV2(raw) : null;
  } catch {
    return null;
  }
}
function hasGuideChoice() {
  try {
    return !!localStorage.getItem("federation-guide-choice");
  } catch {
    return false;
  }
}
function readSettings() {
  try {
    const p = JSON.parse(localStorage.getItem("federation-ui") || "{}");
    return {
      scale: [100, 110, 125, 150].includes(p.scale) ? p.scale : 100,
      hints: p.hints !== false,
    };
  } catch {
    return { scale: 100, hints: true };
  }
}
function ResourceTip({
  label,
  value,
  children,
  onClick,
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="resource-tip">
      <Tooltip title={label} content={children}>
        <button onClick={onClick}>
          <span>{label}</span>
          <strong>{value}</strong>
        </button>
      </Tooltip>
    </div>
  );
}
export default function App() {
  const [g, setG] = useState<V2Game>(() => newV2("campaign"));
  const [screen, setScreen] = useState<"menu" | "setup" | "game">("menu");
  const [saved, setSaved] = useState<V2Game | null>(savedGame);
  const [ui, setUi] = useState(readSettings);
  const [selected, setSelected] = useState<ProvinceId>("south");
  const [district, setDistrict] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [modal, setModal] = useState<Panel | null>(null);
  const [backPanel, setBackPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("national");
  const [politics, setPolitics] = useState<"random" | "classic">("random");
  const [seed, setSeed] = useState("联邦-v04-验收");
  const [seedMode, setSeedMode] = useState("random");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [reformCategory, setReformCategory] = useState<
    "temporary" | "department" | "constitution"
  >("temporary");
  const [organizationView, setOrganizationView] = useState(true);
  const [result, setResult] = useState<ActionResult | null>(null);
  const stateRef = useRef(g),
    commandRef = useRef<{ id: string; revision: number } | null>(null),
    settledAtRef = useRef(0),
    serialRef = useRef(0);
  stateRef.current = g;
  const [office, setOffice] = useState("gov-south");
  const [person, setPerson] = useState("xing");
  const [issue, setIssue] = useState<Issue>("disclosure");
  const [authorizationMatter, setAuthorizationMatter] = useState("");
  const [lead, setLead] = useState("gov-south");
  const [joint, setJoint] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [focusedMatter, setFocusedMatter] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [guideChoice, setGuideChoice] = useState(false);
  const s = g.core,
    m = g.machine,
    f = finance(g),
    playing = s.status === "playing",
    v = action ? previewAction(g, action) : null,
    local = s.provinces.find((p) => p.id === selected)!,
    target = milestones(g);
  function open(p: Panel) {
    setAction(null);
    commandRef.current = null;
    setConfirmedPreview(false);
    setModal(p);
    if (p === "matters") setFocusedMatter(null);
    if (
      p === "reform" &&
      !m.matters.some((x) => x.id === authorizationMatter)
    ) {
      const first = m.matters[0];
      setAuthorizationMatter(first?.id || "");
      setLead(first ? `gov-${first.province}` : "gov-south");
      setEmergency(false);
    }
  }
  function choose(a: Action) {
    if (!action) setBackPanel(modal);
    setAction(a);
    setResult(null);
    commandRef.current = {
      id: `ui-${g.machine.revision}-${serialRef.current++}`,
      revision: g.machine.revision,
    };
    setConfirmedPreview(false);
    setModal(null);
  }
  function closeAction() {
    setAction(null);
    commandRef.current = null;
    setConfirmedPreview(false);
    setModal(backPanel);
  }
  function perform() {
    if (!action || !commandRef.current) return;
    const request = commandRef.current;
    commandRef.current = null; // Synchronous lock: the second click cannot replay this command.
    const outcome = executeCommand(stateRef.current, action, request);
    stateRef.current = outcome.game;
    setG(outcome.game);
    setResult(outcome.result);
    if (outcome.result.status !== "failed") {
      settledAtRef.current = Date.now();
      setAction(null);
      setConfirmedPreview(false);
      if (
        focusedMatter &&
        !outcome.game.machine.matters.some((x) => x.id === focusedMatter)
      )
        setFocusedMatter(null);
      if (
        !outcome.game.machine.matters.some((x) => x.id === authorizationMatter)
      )
        setAuthorizationMatter("");
      setModal(action.type === "end" ? null : backPanel);
    }
    setNotice(
      `${resultNames[outcome.result.status]}：${outcome.result.effects[0] || outcome.result.errors[0]}`,
    );
  }
  function actionExplanation(a: Action) {
    const view = previewAction(g, a);
    return (
      <>
        <p>
          <b>作用：</b>
          {view.title}
        </p>
        {view.effects.map((x, i) => (
          <p key={i}>{x}</p>
        ))}
        <p>
          <b>代价：</b>
          {view.costs.commands}命令 / {view.costs.treasury}财政 /{" "}
          {view.costs.capital}资本 / {view.costs.stock}物资
        </p>
        {view.conditions.map((c, i) => (
          <p key={i} className={c.met ? "met" : "unmet"}>
            {c.met ? "✓ 已满足" : "✕ 未满足"} · {c.label}：{c.reason}
          </p>
        ))}
        {view.errors.map((x, i) => (
          <p className="unmet" key={i}>
            {x}
          </p>
        ))}
        {view.errors.length > 0 && (
          <p>
            <b>解决建议：</b>
            检查对应人事、政策与指挥权；授权只改变参与关系，不会创造人才或技术。调整后重新预览。
          </p>
        )}
      </>
    );
  }
  const executionFeedback = result && (
    <section role="status" className={`execution-result ${result.status}`}>
      <h3>
        {result.status === "failed" ? <AlertTriangle /> : <Check />}
        {resultNames[result.status]} · {result.title}
      </h3>
      {result.errors.map((x) => (
        <p key={x}>{x}</p>
      ))}
      {result.effects.slice(0, 4).map((x, i) => (
        <p key={i}>{x}</p>
      ))}
      {result.effects.length > 4 && (
        <details>
          <summary>全部实际变化 · {result.effects.length}项</summary>
          {result.effects.slice(4).map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </details>
      )}
      {result.completed.length > 0 && (
        <p>
          <b>已完成：</b>
          {result.completed.join("；")}
        </p>
      )}
      {result.remaining.length > 0 && (
        <p className="result-next">
          <b>接下来：</b>
          {result.remaining.join("；")}
        </p>
      )}
      <div className="result-actions">
        <button onClick={() => setResult(null)}>收起结果</button>
        <button
          onClick={() => {
            open("history");
          }}
        >
          查看执行诊断
        </button>
      </div>
    </section>
  );
  function store() {
    try {
      localStorage.setItem(SAVE_V2, serializeV2(g));
      setSaved(g);
      setNotice("完整存档已保存。");
    } catch {
      setNotice("浏览器拒绝写入存档，请检查存储权限。");
    }
  }
  function load() {
    try {
      const raw =
        localStorage.getItem(SAVE_V2) ||
        localStorage.getItem("federation-worlds-v1");
      if (!raw) throw new Error("没有本地存档");
      const n = deserializeV2(raw);
      setG(n);
      stateRef.current = n;
      setResult(null);
      resetView(n);
      setSaved(n);
      setReportOpen(true);
      setAction(null);
      setModal(null);
      setScreen("game");
      setGuideChoice(false);
      setNotice(
        n.machine.migrationNotes?.length
          ? `存档已兼容读取：${n.machine.migrationNotes.join("；")}`
          : "完整组织状态已恢复。",
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function resetView(n: V2Game) {
    commandRef.current = null;
    const pid = n.machine.matters[0]?.province || "south";
    setSelected(pid);
    setDistrict(0);
    setFocusedMatter(null);
    setOffice(`gov-${pid}`);
    setPerson(n.core.appointments[`gov-${pid}`] || "xing");
    setAuthorizationMatter("");
    setLead(`gov-${pid}`);
    setJoint(true);
    setEmergency(false);
    setBackPanel(null);
    setConfirmedPreview(false);
  }
  function begin(t: Mode = mode) {
    const initialSeed =
      t === "tutorial"
        ? "教学-v03"
        : seedMode === "random"
          ? `联邦-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`
          : seed.trim();
    if (!initialSeed) {
      setNotice("请输入数字或字符串种子");
      return;
    }
    const n = startCampaign({
      mode: t,
      seed: initialSeed,
      difficulty: t === "tutorial" ? "standard" : difficulty,
      politics,
    });
    stateRef.current = n;
    setResult(null);
    setG(n);
    resetView(n);
    setScreen("game");
    setModal(
      n.machine.opening && (t === "tutorial" || hasGuideChoice())
        ? "briefing"
        : null,
    );
    setAction(null);
    setReportOpen(true);
    setSelected("south");
    setDistrict(0);
    setFocusedMatter(null);
    setOffice("gov-south");
    setPerson("xing");
    setGuideChoice(t !== "tutorial" && !hasGuideChoice());
  }
  function chooseGuide(hints: boolean) {
    updateUi({ ...ui, hints });
    try {
      localStorage.setItem("federation-guide-choice", "1");
    } catch {
      setNotice("辅助选项在当前会话生效。");
    }
    setGuideChoice(false);
    if (m.opening) setModal("briefing");
  }
  function historySource(id: string | undefined) {
    if (id) {
      setAction(null);
      setModal("history");
      setNotice(`查看因果节点：${id}`);
      setTimeout(
        () => document.getElementById(id)?.scrollIntoView({ block: "center" }),
        50,
      );
    }
  }
  function locate(id: string) {
    const it = m.matters.find((x) => x.id === id);
    if (it) {
      setSelected(it.province);
      setDistrict(0);
      setFocusedMatter(id);
      setModal("matters");
      setAction(null);
      setAlertsOpen(false);
    }
  }
  function authorize(id: string) {
    const it = m.matters.find((x) => x.id === id);
    if (it) {
      setReformCategory("temporary");
      setAuthorizationMatter(id);
      setLead(`gov-${it.province}`);
      setJoint(true);
      setEmergency(false);
      setAction(null);
      setModal("reform");
    }
  }
  function updateUi(next: typeof ui) {
    setUi(next);
    try {
      localStorage.setItem("federation-ui", JSON.stringify(next));
    } catch {
      setNotice("设置仅在当前会话生效。");
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (action) {
        closeAction();
        return;
      }
      if (guideChoice) {
        chooseGuide(ui.hints);
        return;
      }
      if (modal) {
        setModal(null);
        return;
      }
      if (screen === "setup") {
        setScreen("menu");
        return;
      }
      if (screen === "game") {
        if (!playing && reportOpen) {
          setReportOpen(false);
          return;
        }
        setModal("pause");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const settings = (
    <>
      <p>
        调整界面文字和控件比例。浏览器缩放也可使用；较小窗口会自动折叠提醒栏。
      </p>
      <label className="v2-field">
        UI缩放
        <select
          value={ui.scale}
          onChange={(e) => updateUi({ ...ui, scale: Number(e.target.value) })}
        >
          {[100, 110, 125, 150].map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </label>
      <label className="v2-checkbox">
        <input
          type="checkbox"
          checked={ui.hints}
          onChange={(e) => updateUi({ ...ui, hints: e.target.checked })}
        />
        正式游戏开启辅助提示
      </label>
      <p>
        Esc关闭当前面板，地图界面再按Esc打开暂停菜单。点击地图查看地区；拖动地图平移、滚轮缩放。提示可关闭，规则帮助随时可查。
      </p>
    </>
  );
  const matterCards = (
    focusedMatter ? m.matters.filter((x) => x.id === focusedMatter) : m.matters
  ).map((item) => {
    const part = participants(g, item);
    const progress = matterProgress(item);
    return (
      <article
        className={`v2-matter ${item.kind}`}
        key={item.id}
        data-matter-id={item.id}
      >
        <div className="matter-meta">
          <MapPin size={18} />
          {s.provinces.find((p) => p.id === item.province)!.name} · 阶段{" "}
          {item.stage}/4
          {item.isolated
            ? " · 持续隔离 / 本省停产"
            : item.containment > 0
              ? ` · 遏制${item.containment}回合`
              : ""}
        </div>
        <div className="matter-heading">
          <h3>{item.title}</h3>
          <span className={`matter-status ${item.lifecycle || "revealed"}`}>
            {
              {
                revealed: "已揭示",
                processing: "正在管控",
                partial: "部分完成",
                deteriorated: "已恶化",
                resolved: "已解决",
                unrevealed: "待触发",
              }[item.lifecycle || "revealed"]
            }
          </span>
        </div>
        <EventArt kind={item.kind} />
        <p>{item.description.split("。")[0]}。</p>
        <details>
          <summary>事件背景与组织关系</summary>
          <p>{item.description}</p>
          <p>
            主管：{getOffice(part.lead).name} / 正式参与：
            {part.actors.map((id) => getPerson(id)!.name).join("、") ||
              "岗位空缺"}
          </p>
        </details>
        <div className="matter-progress">
          {progress.completed.length > 0 && (
            <p>
              <Check size={17} /> {progress.completed.join("；")}
            </p>
          )}
          <p>
            <b>待完成：</b>
            {progress.remaining[0]}
          </p>
          {progress.remaining[1] && <p>{progress.remaining[1]}</p>}
        </div>
        {item.source && (
          <button
            className="text-button"
            onClick={() => historySource(item.source)}
          >
            查看真实因果来源 <ChevronRight size={18} />
          </button>
        )}
        <div className="v2-plan-list">
          {plansFor(item, m.goal).map((plan) => {
            const a: Action = {
                type: "resolve",
                matter: item.id,
                option: plan.id,
              },
              view = previewAction(g, a);
            return (
              <Tooltip
                key={plan.id}
                title={plan.title}
                content={actionExplanation(a)}
              >
                <button
                  className={view.errors.length ? "blocked" : "available"}
                  disabled={!playing}
                  onClick={() => choose(a)}
                >
                  <div>
                    <b>
                      {view.errors.length ? (
                        <AlertTriangle size={19} />
                      ) : (
                        <Check size={19} />
                      )}{" "}
                      {plan.title}
                    </b>
                    <p>{view.errors[0] || plan.description}</p>
                    <span>
                      命令{view.costs.commands} / 财政{view.costs.treasury} /
                      物资
                      {view.costs.stock}
                    </span>
                  </div>
                  <span>
                    {view.errors.length ? "查看限制" : "审议方案"}
                    <ChevronRight size={18} />
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
        <button
          className="v2-authorize-link"
          disabled={!playing}
          onClick={() => authorize(item.id)}
        >
          调整本事务指挥关系 / 临时授权
        </button>
      </article>
    );
  });
  const planningAlert = m.goalPending && (
    <button
      className={`alert-item planning-alert ${s.turn >= 3 ? "urgent urgent-pulse" : "normal"}`}
      onClick={() => open("goals")}
    >
      <Target />
      <div>
        <b>国家发展规划会议</b>
        <small>
          {s.turn < 2
            ? "第2回合开放立项，可先预览路线"
            : `已开放 · 第3回合结束前立项（当前${s.turn}）`}
        </small>
      </div>
    </button>
  );
  const alerts = m.matters
    .filter((x) => x.kind !== "opportunity")
    .map((x) => (
      <button
        key={x.id}
        className={`alert-item ${x.stage >= 2 && ["accident", "oldgod", "distrust", "supply"].includes(x.kind) ? "urgent" : "normal"}`}
        onClick={() => locate(x.id)}
      >
        <span>
          {x.stage >= 2 ? <AlertTriangle size={18} /> : <Bell size={18} />}
        </span>
        <div>
          <b>{x.title}</b>
          <small>
            {s.provinces.find((p) => p.id === x.province)!.name} ·{" "}
            {["oldgod", "accident", "distrust", "supply"].includes(x.kind)
              ? x.isolated
                ? "持续隔离 · 本省停产"
                : x.containment
                  ? "当前受控"
                  : `阶段${x.stage} · 结算时将恶化`
              : "机构诉求 / 可审议"}
          </small>
        </div>
        <ChevronRight size={17} />
      </button>
    ));
  const minorAlerts = (
    <>
      {s.paralysis > 0 && (
        <button className="alert-item urgent" onClick={() => open("central")}>
          <AlertTriangle size={18} />
          <div>
            <b>中央审批阻塞 {s.paralysis}/4</b>
            <small>调阅政府与审批状态</small>
          </div>
        </button>
      )}
      {people
        .filter((p) => s.grievances[p.id] >= 2)
        .map((p) => (
          <button
            className="alert-item normal"
            key={p.id}
            onClick={() => {
              setPerson(p.id);
              setOffice(
                Object.entries(s.appointments).find(
                  ([, id]) => id === p.id,
                )?.[0] || "gov-south",
              );
              open("staff");
            }}
          >
            <Users size={18} />
            <div>
              <b>
                {p.name} · 积怨{s.grievances[p.id]}
              </b>
              <small>政治阻力，达到3拒绝协办</small>
            </div>
          </button>
        ))}
      {m.history
        .filter((h) => /工程竣工|国家目标里程碑/.test(h.title))
        .slice(0, 5)
        .map((h) => (
          <button
            className="alert-item info"
            key={h.id}
            onClick={() => {
              const work = m.works.find((w) => h.parents.includes(w.source));
              if (work) {
                setSelected(work.province);
                setDistrict(0);
                open("local");
              } else open("goals");
            }}
          >
            <Check size={18} />
            <div>
              <b>{h.title}</b>
              <small>第{h.turn}回合 · 查看实际记录</small>
            </div>
          </button>
        ))}
    </>
  );
  return (
    <div
      className="command-app"
      onClickCapture={(event) => {
        if (event.detail > 1 && Date.now() - settledAtRef.current < 600) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      style={{ "--ui-scale": ui.scale / 100 } as React.CSSProperties}
    >
      {screen !== "game" ? (
        <main className="main-menu">
          <div className="menu-art" aria-hidden="true">
            <div className="propaganda-sun" />
            <div className="industrial-silhouette">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="menu-seal">
              <Globe2 size={150} />
              <span>UNION OF WORLDS</span>
            </div>
            <div className="propaganda-copy">
              以制度连接诸界
              <br />
              <strong>让国家机器发挥作用。</strong>
            </div>
          </div>
          <section className="menu-content">
            <span className="eyebrow">最高领导层 / 联邦指挥席</span>
            <h1>诸界联邦</h1>
            <p className="menu-subtitle">FEDERATION OF WORLDS</p>
            <div className="menu-rule" />
            <p>
              钢铁与灵脉。秘密与群众。
              <br />
              一个国家，许多世界。
            </p>
            {screen === "menu" ? (
              <nav aria-label="主菜单">
                <button disabled={!saved} onClick={load}>
                  <Play />
                  继续游戏
                </button>
                <button onClick={() => setScreen("setup")}>
                  <Flag />
                  开始新游戏
                </button>
                <button onClick={() => begin("tutorial")}>
                  <BookOpen />
                  教学战役
                </button>
                <button onClick={load}>
                  <Download />
                  读取存档
                </button>
                <button onClick={() => setModal("settings")}>
                  <Settings />
                  设置
                </button>
              </nav>
            ) : (
              <>
                <h2>新任期设置</h2>
                <label className="v2-field">
                  剧本
                  <select
                    aria-label="剧本"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as Mode);
                      setPolitics(
                        e.target.value === "campaign" ? "classic" : "random",
                      );
                    }}
                  >
                    <option value="campaign">南岭—北境紧急状态 · 4回合</option>
                    <option value="national">国家治理 · 8回合</option>
                    <option value="experimental">
                      标准战役 · 12回合（实验）
                    </option>
                  </select>
                </label>
                <label className="v2-field">
                  政治开局
                  <select
                    aria-label="政治开局"
                    value={politics}
                    onChange={(e) =>
                      setPolitics(e.target.value as "random" | "classic")
                    }
                  >
                    <option value="random">受约束随机政治结构</option>
                    <option value="classic">经典地方分权 · 回归剧本</option>
                  </select>
                </label>
                <label className="v2-field">
                  难度
                  <select
                    aria-label="难度"
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as Difficulty)
                    }
                  >
                    <option value="relaxed">宽裕 · 初始财政+4</option>
                    <option value="standard">标准</option>
                    <option value="challenging">
                      紧缩 · 初始财政-3、政治资本-1
                    </option>
                  </select>
                </label>
                <label className="v2-field">
                  种子模式
                  <select
                    aria-label="种子模式"
                    value={seedMode}
                    onChange={(e) => setSeedMode(e.target.value)}
                  >
                    <option value="random">随机生成（默认）</option>
                    <option value="specified">指定种子 · 可复现</option>
                  </select>
                </label>
                {seedMode === "specified" && (
                  <label className="v2-field">
                    数字或字符串种子
                    <input
                      value={seed}
                      maxLength={64}
                      onChange={(e) => setSeed(e.target.value)}
                    />
                  </label>
                )}
                <p>
                  正式国家治理先了解国情，第2回合召开发展规划会议，最迟第3回合结束前立项主要战略。前期建设全部保留。
                </p>
                <div className="setup-actions">
                  <button onClick={() => setScreen("menu")}>返回主菜单</button>
                  <button className="v2-primary" onClick={() => begin()}>
                    开始任期 <ArrowRight />
                  </button>
                </div>
              </>
            )}
            <small className="menu-version">
              v0.4.0 · 离线单人治理原型 / 原创联邦地图
            </small>
          </section>
          {modal === "settings" && (
            <PanelFrame title="设置" onClose={() => setModal(null)} modal>
              {settings}
            </PanelFrame>
          )}
        </main>
      ) : (
        <main className="command-shell">
          <header className="status-bar">
            <button className="federal-brand" onClick={() => open("central")}>
              <Globe2 />
              <div>
                <b>诸界联邦</b>
                <span>{regimes[m.regime].name}</span>
              </div>
            </button>
            <div className="status-resources">
              <ResourceTip
                label={`${1950 + s.turn}年 · 回合`}
                value={`${s.turn} / ${duration(g)}`}
                onClick={() => open("history")}
              >
                <p>联邦历 {1950 + s.turn} 年 · 一个回合代表一个治理年度。</p>
                <p>
                  {m.mode === "tutorial"
                    ? "教学战役"
                    : m.mode === "national" || m.mode === "experimental"
                      ? m.goalPending
                        ? "国家规划"
                        : goals[m.goal].name
                      : "南岭—北境紧急状态"}
                </p>
              </ResourceTip>
              <ResourceTip
                label="财政 / 下回合"
                value={
                  <>
                    {s.treasury}
                    <em> → {f.next}</em>
                  </>
                }
                onClick={() => open("economy")}
              >
                <h3>先支出，后收入</h3>
                <p>
                  {f.sources.map((row) => (
                    <span className="income-source" key={row.label}>
                      {row.label} +{row.amount}；
                    </span>
                  ))}
                  总收入{f.income}
                </p>
                <p>
                  固定预算{f.fixed} +组织/设施维护{f.maintenance} +可施工项目
                  {f.projectCosts} =支出{f.total}
                </p>
                {f.maintenanceSources.map((row) => (
                  <p key={row.label}>
                    {row.label}：{row.amount}财政
                  </p>
                ))}
                {m.works
                  .filter((w) => !w.completed && !w.paused)
                  .map((w) => (
                    <p key={w.id}>
                      {workSpecs[w.type].name} ·{" "}
                      {s.provinces.find((p) => p.id === w.province)!.name}
                    </p>
                  ))}
                {m.budgets.map((id) => (
                  <p key={id}>
                    {s.provinces.find((p) => p.id === id)!.name}长期预算1
                  </p>
                ))}
                <p>
                  {f.default ? "余额不足，本次将违约" : "本次能履行承诺"}
                  ；预计余额{f.next}。
                </p>
              </ResourceTip>
              <ResourceTip
                label="行政命令"
                value={s.commands}
                onClick={() => open("central")}
              >
                <p>
                  任免、授权与多数处置消耗命令。通常每回合5；中央阻塞≥2时下一回合4。
                </p>
              </ResourceTip>
              <ResourceTip
                label="政治资本"
                value={s.capital}
                onClick={() => open("reform")}
              >
                <p>
                  用于真实授权、制度改革与政治和解，不能直接兑换缺失的特殊能力。
                </p>
              </ResourceTip>
              <ResourceTip
                label="国家危机"
                value={
                  <span className={s.crisis >= 8 ? "danger" : ""}>
                    {s.crisis} / 12
                  </span>
                }
                onClick={() => open("matters")}
              >
                <p>
                  危机达到12失败。当前审批阻塞{s.paralysis}，连续财政违约
                  {s.insolvency}/2。
                </p>
              </ResourceTip>
              <ResourceTip
                label={
                  m.mode === "national" || m.mode === "experimental"
                    ? m.goalPending
                      ? "国家规划"
                      : goals[m.goal].name
                    : "战役目标"
                }
                value={
                  m.mode === "national" || m.mode === "experimental"
                    ? m.goalPending
                      ? "待立项"
                      : `${target.filter((c) => c.met).length} / ${target.length}`
                    : `${Number(m.milestones.includes("accident-managed")) + Number(m.milestones.includes("north-managed"))} / 2`
                }
                onClick={() => open("goals")}
              >
                <p>
                  {m.mode === "national" || m.mode === "experimental"
                    ? m.goalPending
                      ? "第2回合开放发展规划会议，最迟第3回合结束前立项；可先查看三条战略与当前国情。"
                      : `第${duration(g)}回合还须执行终局，存活本身不足以胜利。`
                    : "实际管理南岭事故和北境危机，并生存至第4回合。"}
                </p>
              </ResourceTip>
            </div>
            <button
              className="pause-trigger"
              aria-label="暂停菜单"
              onClick={() => open("pause")}
            >
              <Menu />
            </button>
          </header>
          <nav className="function-rail" aria-label="主要管理功能">
            {(
              [
                { id: "central", name: "中央政府", icon: Landmark },
                { id: "staff", name: "人事管理", icon: Users },
                { id: "reform", name: "政策改革", icon: Flag },
                { id: "economy", name: "经济建设", icon: Factory },
                { id: "goals", name: "国家目标", icon: Target },
                { id: "matters", name: "国家事务", icon: ScrollText },
              ] as const
            ).map(({ id, name, icon: Icon }) => (
              <button
                className={`${modal === id ? "active" : ""} ${m.mode === "tutorial" && m.tutorial < 4 && lessons[m.tutorial].panel === id ? "tutorial-highlight" : ""}`}
                key={id}
                title={name}
                aria-label={name}
                onClick={() => (modal === id ? setModal(null) : open(id))}
              >
                <Icon size={26} />
                <span>{name}</span>
              </button>
            ))}
            <div className="rail-spacer" />
            <button
              title="因果历史"
              aria-label="因果历史"
              onClick={() => open("history")}
            >
              <HistoryIcon />
              <span>执政历史</span>
            </button>
            <button
              title="规则帮助"
              aria-label="规则帮助"
              onClick={() => open("help")}
            >
              <BookOpen />
              <span>规则帮助</span>
            </button>
          </nav>
          <section className="map-workspace">
            <GameMap
              g={g}
              selected={selected}
              district={district}
              onSelect={(p, d) => {
                setSelected(p);
                setDistrict(d);
                open("local");
              }}
            />
            {m.mode === "tutorial" && (
              <aside className="tutorial-strip">
                <div>
                  <span className="eyebrow">
                    独立教学战役 · {Math.min(4, m.tutorial + 1)}/4
                  </span>
                  <h3>{lessons[m.tutorial].title}</h3>
                  <p>{lessons[m.tutorial].body}</p>
                </div>
                <button
                  className="v2-primary"
                  onClick={() => {
                    if (m.tutorial === 0) {
                      setOffice("gov-south");
                      setPerson("xing");
                      open("staff");
                    } else if (m.tutorial === 1) {
                      const it = m.matters.find((x) => x.kind === "accident");
                      if (it) authorize(it.id);
                    } else if (m.tutorial === 2) open("economy");
                    else open("matters");
                  }}
                >
                  {" "}
                  {m.tutorial === 0 ? "前往人事任命" : "查看本阶段操作"}{" "}
                  <ArrowRight size={18} />
                </button>
                <Tooltip
                  title={previewAction(g, { type: "skip" }).title}
                  content={actionExplanation({ type: "skip" })}
                >
                  <button
                    className="hint-close"
                    aria-label="跳过教学提示"
                    onClick={() => choose({ type: "skip" })}
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              </aside>
            )}
            {m.mode !== "tutorial" && ui.hints && !modal && !action && (
              <aside className="beginner-hint">
                <BookOpen size={20} />
                <p>
                  地图查看地区，左栏调阅国家管理。右侧提醒可直接定位事务；结束回合前先看财政预测。
                </p>
                <button
                  aria-label="关闭辅助提示"
                  onClick={() => updateUi({ ...ui, hints: false })}
                >
                  <X size={18} />
                </button>
              </aside>
            )}

            {guideChoice && (
              <PanelFrame
                title="开启辅助引导？"
                modal
                onClose={() => chooseGuide(ui.hints)}
                footer={
                  <>
                    <button
                      onClick={() => {
                        chooseGuide(false);
                      }}
                    >
                      独立治理
                    </button>
                    <button
                      className="v2-primary"
                      onClick={() => {
                        chooseGuide(true);
                      }}
                    >
                      开启辅助提示
                    </button>
                  </>
                }
              >
                <p>
                  正式任期使用同一指挥台，不强制进行教程。辅助提示可随时在设置关闭；主菜单的教学战役会用真实操作带你认识系统。
                </p>
              </PanelFrame>
            )}
            {!playing && reportOpen && !modal && !action && (
              <PanelFrame
                title={
                  s.status === "won"
                    ? "国家机器发挥了作用。"
                    : "任期结束，仍有未竟之事。"
                }
                onClose={() => setReportOpen(false)}
                footer={
                  <>
                    <button
                      onClick={() => {
                        setReportOpen(false);
                        open("history");
                      }}
                    >
                      查阅完整决策历史
                    </button>
                    <button
                      className="v2-primary"
                      onClick={() => {
                        setScreen("menu");
                        setModal(null);
                      }}
                    >
                      返回主菜单
                    </button>
                  </>
                }
              >
                {s.status === "won" && (
                  <section className="victory-summary">
                    <Target size={42} />
                    <div>
                      <h3>
                        {m.finalDone
                          ? `${goals[m.goal].name}正式完成`
                          : "南岭—北境紧急状态得到治理"}
                      </h3>
                      <p>
                        {duration(g)}
                        个治理年度，真实设施、人物与组织权限共同通过检验。
                      </p>
                    </div>
                  </section>
                )}
                <pre className="actual-report">{report(g)}</pre>
                <p>
                  财政{s.treasury} /危机{s.crisis}/12 /完成事务{s.resolved}
                </p>
              </PanelFrame>
            )}
            {action?.type === "end" && v && (
              <TurnReview
                game={g}
                preview={v}
                onClose={closeAction}
                onConfirm={perform}
              />
            )}
            {action && action.type !== "end" && v && (
              <PanelFrame
                title={v.title}
                onClose={closeAction}
                footer={
                  <>
                    <button
                      onClick={() => {
                        commandRef.current = {
                          id: `ui-${stateRef.current.machine.revision}-${serialRef.current++}`,
                          revision: stateRef.current.machine.revision,
                        };
                        setConfirmedPreview(true);
                      }}
                    >
                      预览后果
                    </button>
                    <button
                      className="v2-primary"
                      disabled={!confirmedPreview || v.errors.length > 0}
                      onClick={perform}
                    >
                      确认执行 <ArrowRight size={18} />
                    </button>
                  </>
                }
              >
                {result?.status === "failed" && executionFeedback}
                <ReformImpact game={g} action={action} />
                <p className="v2-participants">
                  参与人物：
                  {v.actors.map((id) => getPerson(id)?.name || id).join("、") ||
                    "国家制度行动"}
                  <br />
                  参与机构：
                  {v.institutions
                    .map((id) => getOffice(id)?.name || id)
                    .join("、") || "全国组织"}
                </p>
                <div className="v2-conditions">
                  {v.conditions.map((c, i) => (
                    <div className={c.met ? "met" : "unmet"} key={i}>
                      {c.met ? (
                        <Check size={19} />
                      ) : (
                        <AlertTriangle size={19} />
                      )}
                      <div>
                        <b>{c.label}</b>
                        <p>{c.reason}</p>
                        {c.source && (
                          <button onClick={() => historySource(c.source)}>
                            查看限制来源
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {action.type === "resolve" && (
                  <>
                    <label className="v2-checkbox">
                      <input
                        type="checkbox"
                        checked={!!action.force}
                        onChange={(e) =>
                          choose({ ...action, force: e.target.checked })
                        }
                      />
                      申请紧急强制（必须已有正式紧急授权；不能绕过能力条件）
                    </label>
                    <label className="v2-field">
                      地方资源的实际交换条件
                      <select
                        value={action.exchange || "ownership"}
                        onChange={(e) =>
                          choose({
                            ...action,
                            exchange: e.target.value as
                              "ownership" | "budget" | "central",
                          })
                        }
                      >
                        <option value="ownership">保留地方收益权与1物资</option>
                        <option value="budget">
                          承诺以后每回合1财政部门预算
                        </option>
                        <option value="central">
                          改用中央工业省物资（须有供应能力）
                        </option>
                      </select>
                    </label>
                  </>
                )}
                <div className="v2-costs">
                  <span>
                    命令<b>−{v.costs.commands}</b>
                  </span>
                  <span>
                    财政<b>−{v.costs.treasury}</b>
                  </span>
                  <span>
                    资本<b>−{v.costs.capital}</b>
                  </span>
                  <span>
                    物资<b>−{v.costs.stock}</b>
                  </span>
                </div>
                <h3>改变的不只是余额</h3>
                <ul>
                  {v.effects.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {confirmedPreview && (
                  <div className="v2-result">
                    <h3>执行后资源</h3>
                    <p>
                      命令 {s.commands} → {v.after.commands} / 财政 {s.treasury}{" "}
                      → {v.after.treasury} / 资本 {s.capital} →{" "}
                      {v.after.capital}
                    </p>
                    {v.errors.length > 0 && (
                      <p className="danger">
                        当前不可执行：{v.errors.join("；")}
                      </p>
                    )}
                  </div>
                )}

                {v.errors.length > 0 && (
                  <div className="remedy-links">
                    <h3>可以从哪里修复？</h3>
                    <p>
                      以下入口用于检查对应条件，并不保证一次操作就能解锁。特殊能力仍需要正式岗位与真实权限。
                    </p>
                    <button
                      onClick={() => {
                        setAction(null);
                        open("staff");
                      }}
                    >
                      检查人事与才能
                    </button>
                    <button
                      onClick={() => {
                        setAction(null);
                        if (action.type === "resolve") authorize(action.matter);
                        else open("reform");
                      }}
                    >
                      检查指挥权限
                    </button>
                    <button
                      onClick={() => {
                        setAction(null);
                        open("policy");
                      }}
                    >
                      检查政策路线
                    </button>
                  </div>
                )}
              </PanelFrame>
            )}
            {modal && (
              <PanelFrame
                key={modal}
                title={titles[modal]}
                modal={modal === "pause" || modal === "settings"}
                onClose={() => setModal(null)}
                footer={
                  modal === "staff" ? (
                    <>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "appoint",
                            office,
                            person: null,
                          }).title
                        }
                        content={actionExplanation({
                          type: "appoint",
                          office,
                          person: null,
                        })}
                      >
                        <button
                          onClick={() =>
                            choose({ type: "appoint", office, person: null })
                          }
                        >
                          预览免职
                        </button>
                      </Tooltip>
                      {s.grievances[person] > 0 && (
                        <Tooltip
                          title={
                            previewAction(g, { type: "mediate", person }).title
                          }
                          content={actionExplanation({
                            type: "mediate",
                            person,
                          })}
                        >
                          <button
                            onClick={() => choose({ type: "mediate", person })}
                          >
                            预览政治和解
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip
                        title={
                          previewAction(g, { type: "appoint", office, person })
                            .title
                        }
                        content={actionExplanation({
                          type: "appoint",
                          office,
                          person,
                        })}
                      >
                        <button
                          className="v2-primary"
                          onClick={() =>
                            choose({ type: "appoint", office, person })
                          }
                        >
                          预览任命
                        </button>
                      </Tooltip>
                    </>
                  ) : modal === "reform" && reformCategory === "temporary" ? (
                    <Tooltip
                      title={
                        previewAction(g, {
                          type: "authorize",
                          matter: authorizationMatter || m.matters[0]?.id || "",
                          lead,
                          joint,
                          emergency,
                        }).title
                      }
                      content={actionExplanation({
                        type: "authorize",
                        matter: authorizationMatter || m.matters[0]?.id || "",
                        lead,
                        joint,
                        emergency,
                      })}
                    >
                      <button
                        className="v2-primary"
                        onClick={() =>
                          choose({
                            type: "authorize",
                            matter:
                              authorizationMatter || m.matters[0]?.id || "",
                            lead,
                            joint,
                            emergency,
                          })
                        }
                      >
                        预览临时授权
                      </button>
                    </Tooltip>
                  ) : undefined
                }
              >
                {(modal === "reform" || modal === "policy") && (
                  <div className="panel-tabs">
                    <button
                      aria-pressed={modal === "policy"}
                      onClick={() => open("policy")}
                    >
                      全国政策
                    </button>
                    <button
                      aria-pressed={modal === "reform"}
                      onClick={() => open("reform")}
                    >
                      三类权力调整
                    </button>
                  </div>
                )}
                {modal === "staff" && (
                  <>
                    <h2>人物的才能需要合适的位置。</h2>
                    <p>
                      任命/免职1命令，一人一职。合法参与资格与当前制度共同决定特殊能力。
                    </p>
                    <label className="v2-field">
                      职位
                      <select
                        aria-label="职位"
                        value={office}
                        onChange={(e) => setOffice(e.target.value)}
                      >
                        {offices.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ·{" "}
                            {getPerson(s.appointments[o.id])?.name || "空缺"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="v2-roster">
                      {people.map((p) => (
                        <Tooltip
                          key={p.id}
                          title={`${p.name} · ${coreAbilities[p.id]?.name || p.title}`}
                          content={
                            <>
                              <p>
                                当前职位：
                                {personOfficeLabel(s.appointments, p.id)}
                              </p>
                              <p>
                                积怨{s.grievances[p.id]}/3 ·{" "}
                                {s.grievances[p.id] >= 3
                                  ? "拒绝协办，请政治和解"
                                  : "可参与正式事务"}
                              </p>
                              <p>
                                {coreAbilities[p.id]?.condition || p.ability}
                              </p>
                              <p>
                                {coreAbilities[p.id]?.limit ||
                                  "基础专业仍受正式参与资格约束"}
                              </p>
                              {m.matters
                                .filter((x) => x.province === selected)
                                .slice(0, 1)
                                .map((it) => (
                                  <div key={it.id}>
                                    {p.id === "lu" &&
                                      ["accident", "oldgod"].includes(
                                        it.kind,
                                      ) &&
                                      actionExplanation({
                                        type: "resolve",
                                        matter: it.id,
                                        option: "isolate",
                                      })}
                                    {Object.entries(capNames)
                                      .filter(
                                        ([cap]) =>
                                          ({
                                            xing: "mobilize",
                                            sergei: "seal",
                                            mo: "leywork",
                                            lin: "industry",
                                            ye: "transport",
                                          })[p.id] === cap,
                                      )
                                      .map(([cap, label]) => (
                                        <div key={cap}>
                                          <b>
                                            {label} / {it.title}
                                          </b>
                                          {capability(
                                            g,
                                            cap as keyof typeof capNames,
                                            it,
                                            cap === "mobilize" ||
                                              cap === "joint"
                                              ? 1
                                              : cap === "seal"
                                                ? 0
                                                : undefined,
                                          ).map((c, i) => (
                                            <p
                                              key={i}
                                              className={
                                                c.met ? "met" : "unmet"
                                              }
                                            >
                                              {c.met ? "✓" : "✕"} {c.reason}
                                            </p>
                                          ))}
                                        </div>
                                      ))}
                                  </div>
                                ))}
                            </>
                          }
                        >
                          <button
                            className={person === p.id ? "selected" : ""}
                            onClick={() => setPerson(p.id)}
                          >
                            <PersonBadge id={p.id} />
                            <span>
                              {personOfficeLabel(s.appointments, p.id)}
                            </span>
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                    <section className="v2-person-details">
                      <PersonBadge id={person} />
                      <h3>{getPerson(person)?.name || "保持职位空缺"}</h3>
                      {getPerson(person) && (
                        <>
                          <p>
                            {getPerson(person)!.title} ·{" "}
                            {factionNames[getPerson(person)!.faction]}
                          </p>
                          <p>
                            {Object.keys(issueNames)
                              .map(
                                (i) =>
                                  issueNames[i as Issue][
                                    getPerson(person)!.stance[i as Issue]
                                  ],
                              )
                              .join(" / ")}
                          </p>
                          {coreAbilities[person] ? (
                            <>
                              <h4>
                                <Sparkles size={18} />
                                {coreAbilities[person].name}
                              </h4>
                              <p>启用：{coreAbilities[person].condition}</p>
                              <p>限制：{coreAbilities[person].limit}</p>
                            </>
                          ) : (
                            <p>
                              保留基础专业与立场；本版尚未为该人物扩展独特特殊行动。
                            </p>
                          )}
                          <p>
                            积怨 {s.grievances[person]} · 根基 {s.roots[person]}
                          </p>
                        </>
                      )}
                    </section>
                  </>
                )}
                {modal === "reform" && (
                  <>
                    <h2>国家组织结构与三种权力调整</h2>
                    <div className="panel-tabs">
                      <button
                        aria-pressed={organizationView}
                        onClick={() => setOrganizationView(true)}
                      >
                        组织结构图
                      </button>
                      <button
                        aria-pressed={!organizationView}
                        onClick={() => setOrganizationView(false)}
                      >
                        地图与地区
                      </button>
                    </div>
                    {organizationView ? (
                      <OrganizationDiagram game={g} />
                    ) : (
                      <div className="reform-map">
                        <GameMap
                          g={g}
                          selected={selected}
                          district={district}
                          onSelect={(p, d) => {
                            setSelected(p);
                            setDistrict(d);
                          }}
                        />
                      </div>
                    )}
                    <div
                      className="reform-categories"
                      role="group"
                      aria-label="改革类别"
                    >
                      {(
                        ["temporary", "department", "constitution"] as const
                      ).map((c) => (
                        <button
                          key={c}
                          aria-pressed={reformCategory === c}
                          onClick={() => setReformCategory(c)}
                        >
                          {
                            {
                              temporary: "针对当前事件授权",
                              department: "调整某类事务的长期归属",
                              constitution: "改变国家基本管理体制",
                            }[c]
                          }
                        </button>
                      ))}
                    </div>
                    {reformCategory === "temporary" && (
                      <>
                        <p>
                          即时、具体、当回合到期。临时授权不会自动获得人才、技术或永久改变体制。
                        </p>
                        <h3>当前事务临时行政授权</h3>
                        <label className="v2-field">
                          具体事务
                          <select
                            aria-label="具体事务"
                            value={
                              authorizationMatter || m.matters[0]?.id || ""
                            }
                            onChange={(e) => {
                              setAuthorizationMatter(e.target.value);
                              const it = m.matters.find(
                                (x) => x.id === e.target.value,
                              );
                              if (it) setLead(`gov-${it.province}`);
                            }}
                          >
                            {m.matters.map((x) => (
                              <option value={x.id} key={x.id}>
                                {x.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="v2-field">
                          临时主管
                          <select
                            aria-label="临时主管"
                            value={lead}
                            onChange={(e) => setLead(e.target.value)}
                          >
                            {offices.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="v2-checkbox">
                          <input
                            type="checkbox"
                            checked={joint}
                            onChange={(e) => setJoint(e.target.checked)}
                          />
                          正式邀请中央—地方联合参与
                        </label>
                        <label className="v2-checkbox">
                          <input
                            type="checkbox"
                            checked={emergency}
                            onChange={(e) => setEmergency(e.target.checked)}
                          />
                          阶段≥2时取得紧急强制权
                        </label>
                      </>
                    )}
                    {reformCategory !== "temporary" && (
                      <LastingReforms
                        game={g}
                        province={selected}
                        category={reformCategory}
                        onChoose={choose}
                      />
                    )}
                  </>
                )}
                {modal === "policy" && (
                  <>
                    <h2>路线是一种真实的许可。</h2>
                    <label className="v2-field">
                      政策议题
                      <select
                        value={issue}
                        onChange={(e) => setIssue(e.target.value as Issue)}
                      >
                        {Object.keys(issueNames).map((i) => (
                          <option key={i} value={i}>
                            {issueNames[i as Issue].join(" / ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      当前：
                      {s.policies[issue] === null
                        ? "未定路线"
                        : issueNames[issue][s.policies[issue]!]}
                    </p>
                    <div className="v2-policy-buttons">
                      {issueNames[issue].map((name, side) => (
                        <Tooltip
                          key={name}
                          title={
                            previewAction(g, { type: "policy", issue, side })
                              .title
                          }
                          content={actionExplanation({
                            type: "policy",
                            issue,
                            side,
                          })}
                        >
                          <button
                            key={name}
                            onClick={() =>
                              choose({ type: "policy", issue, side })
                            }
                          >
                            {name}
                            <ArrowRight size={16} />
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                    <p>
                      群众公开救援无法在保密政策下发动。秘密高级封印无法在公开政策下发动。委员会合作需要协商路线和有限技术公开协议。
                    </p>
                  </>
                )}
                {modal === "help" && (
                  <>
                    <h2>治理手册 · 国家机器 v0.2</h2>
                    <h3>指挥席操作</h3>
                    <p>
                      点击地图调阅地方，左栏切换管理功能，右侧提醒定位事务。地图支持拖动与滚轮缩放，四种地图模式展示政治、行政、资源和危机。Esc关闭最上层面板，再按Esc进入暂停菜单；保存与读取都在暂停菜单。正文只在面板内部滚动，底部回合按钮持续可见。
                    </p>
                    <p>
                      先看目标与危机，点击方案查看人物、事权、路线和利益条件。受阻不等于资源不够：你可能需要换职位、改制度、提供正式授权，或采用不同能力。
                    </p>
                    <h3>财政与失败</h3>
                    <p>
                      每回合基础税收5，设施与有限稽核可增加收入；先支付基本预算、组织/设施维护和可施工项目。紧缩预算降低职能，专项预算加速建设但增加支出。连续两次无法履行承诺会失败；全国危机≥12或中央阻塞连续两回合≥4也会失败。全国模式还要完成目标终局，存活本身不是正式胜利。
                    </p>
                    <h3>三种体制如何不同</h3>
                    {Object.values(regimes).map((r) => (
                      <section key={r.name}>
                        <h4>{r.name}</h4>
                        <p>
                          {r.gain} {r.loss}
                        </p>
                      </section>
                    ))}
                    <h3>建议的短战役路线</h3>
                    <p>
                      地方路线可以公开救援、撤离并遏制北境危机。垂直路线可提前改革，再以谢尔盖与档案启动全国秘密封印。委员会路线需要公开有限技术资料与协商政策，还要将群众救援人物放到当前省份的合法职位。三条路径不能互相用资源替代。
                    </p>
                    <h3>国家目标建设提示</h3>
                    <p>
                      星火：勘探→墨玄顾问兼任或专职派遣→标准委员会→中央运输改革→工程竣工→保留收益权；终局还须墨玄任计划委或南岭正式职位。协约：联合体制或疏散权下放→真实合作协议→处理事故→保留负责人信任。长夜：三个预警站→合法高级封印/联合行动→跨省应急→管理北境。正式8回合与实验12回合各在最后一回合执行终局；实验战役还须在第10～11回合完成协作演练。
                    </p>
                    <h3>能力与危机的真实限制</h3>
                    <p>
                      积怨达到3会拒绝协办；顾问工程师调离合格岗位或被抽调会中断施工；专职派遣保留名义职位并暂停行政能力，岗位变化不取消派遣。临时授权本回合到期，改革下回合生效。公开救援不会自动消灭异常源；持续危机仍需要遏制、撤离、隔离或封印。每回合最多接纳3项新增事务，压力只检测一次。
                    </p>
                    <h3>实际历史</h3>
                    {m.history.slice(0, 12).map((h) => (
                      <p key={h.id}>
                        第{h.turn}回合 · {h.title}：{h.effects[0]}
                      </p>
                    ))}
                    <p>
                      详细规则与已知简化见仓库
                      RULES.md、CHANGELOG.md。旧存档保留；v0.2使用独立存档键。
                    </p>
                  </>
                )}
                {modal === "settings" && settings}
                {modal === "pause" && (
                  <div className="pause-options">
                    <p className="seed-info">
                      初始种子：<b>{s.seed}</b>
                      <br />
                      随机序列状态：{s.rng} · 规则{m.rulesVersion} ·{" "}
                      {m.politics === "random" ? "随机政治开局" : "经典开局"}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(s.seed);
                          setNotice("种子已复制");
                        } catch {
                          setNotice(`复制受限，请手动复制：${s.seed}`);
                        }
                      }}
                    >
                      复制种子
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "重玩将丢弃未保存的进度，使用相同剧本、难度、政治模式和种子重新开始。",
                          )
                        ) {
                          const n = startCampaign({
                            mode: m.mode,
                            seed: s.seed,
                            difficulty: m.difficulty,
                            politics: m.politics,
                          });
                          setG(n);
                          stateRef.current = n;
                          resetView(n);
                          setResult(null);
                          setModal(n.machine.opening ? "briefing" : null);
                        }
                      }}
                    >
                      重玩同一种子
                    </button>
                    <button onClick={() => setModal(null)}>
                      <Play />
                      继续游戏
                    </button>
                    <button onClick={store}>
                      <Save />
                      保存游戏
                    </button>
                    <button onClick={load}>
                      <Download />
                      读取存档
                    </button>
                    <button onClick={() => open("settings")}>
                      <Settings />
                      设置
                    </button>
                    <button onClick={() => open("help")}>
                      <BookOpen />
                      帮助
                    </button>
                    <p>
                      返回主菜单不会自动存档。继续游戏会读取最近手动保存的进度，请先保存。
                    </p>
                    <button
                      onClick={() => {
                        setScreen("menu");
                        setModal(null);
                        setSaved(savedGame());
                      }}
                    >
                      返回主菜单
                    </button>
                  </div>
                )}
                {modal === "briefing" && (
                  <>
                    <section className="opening-report">
                      <h3>{regimes[m.regime].name}</h3>
                      {m.opening?.summary.map((x, i) => (
                        <p key={i}>{x}</p>
                      ))}
                      <p className="seed-info">
                        种子：{s.seed} · 难度{difficultyNames[m.difficulty]} ·{" "}
                        {duration(g)}回合
                      </p>
                    </section>
                    <div className="quick-grid">
                      <button onClick={() => open("central")}>
                        调阅中央政府
                      </button>
                      <button onClick={() => open("goals")}>
                        预览国家战略
                      </button>
                      <button onClick={() => setModal(null)}>
                        返回国家地图
                      </button>
                    </div>
                  </>
                )}
                {modal === "central" && (
                  <>
                    {m.opening && (
                      <details>
                        <summary>初始国情报告（任期开始时）</summary>
                        {m.opening.summary.map((x, i) => (
                          <p key={i}>{x}</p>
                        ))}
                      </details>
                    )}
                    <p>
                      现行制度：<strong>{regimes[m.regime].name}</strong>
                    </p>
                    <p>
                      获得：{regimes[m.regime].gain}
                      <br />
                      限制：{regimes[m.regime].loss}
                    </p>
                    {m.pending && (
                      <p className="action-warning">
                        改革过渡：第{m.pending.due}回合生效为
                        {regimes[m.pending.regime].name}，当前仍按旧体制。
                      </p>
                    )}
                    <p>
                      部门改革：{departmentNames[m.department]}{" "}
                      {m.departmentPending
                        ? ` / 第${m.departmentPending.due}回合生效`
                        : ""}
                    </p>
                    <p>
                      审批阻塞{s.paralysis}
                      /4。达到2限制中央审批，连续两次结算≥4失败。
                    </p>
                    {s.paralysis > 0 && (
                      <Tooltip
                        title={previewAction(g, { type: "unblock" }).title}
                        content={actionExplanation({ type: "unblock" })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() => choose({ type: "unblock" })}
                        >
                          预览疏通审批
                        </button>
                      </Tooltip>
                    )}
                    <p>
                      有效领域：异常
                      {hasDepartment(g, "anomaly")
                        ? "全国"
                        : m.departments.anomaly.length + "省"}{" "}
                      / 疏散
                      {hasDepartment(g, "evacuation")
                        ? "全国"
                        : m.departments.evacuation.length + "省"}{" "}
                      / 运输
                      {hasDepartment(g, "transport")
                        ? "全国"
                        : m.departments.transport.length + "省"}
                      。
                    </p>
                    <button onClick={() => open("reform")}>调阅三类改革</button>
                    {offices.map((o) => {
                      const id = s.appointments[o.id];
                      return (
                        <Tooltip
                          key={o.id}
                          title={o.name}
                          content={
                            <>
                              <p>
                                法定领域：
                                {o.domains
                                  .map((d) => domainNames[d])
                                  .join(" / ")}
                              </p>
                              <p>
                                当前负责人：{getPerson(id)?.name || "岗位空缺"}
                                ，
                                {id && s.grievances[id] >= 3
                                  ? "已拒绝协办，需政治和解"
                                  : "仍可实际履职"}
                              </p>
                              <p>
                                {o.province
                                  ? "省内能力受基础制度、具体授权与部门试点共同约束。"
                                  : "中央专家只有正式参与才提供能力；跨省行动仍需合法指挥体系。"}
                              </p>
                            </>
                          }
                        >
                          <article tabIndex={0} className="document-card">
                            <h3>{o.name}</h3>
                            <p>
                              {getPerson(id)?.name || "岗位空缺"} · 积怨
                              {id ? s.grievances[id] : "—"} · 权限：
                              {o.domains.map((d) => domainNames[d]).join(" / ")}
                            </p>
                            <button
                              disabled={!playing}
                              onClick={() => {
                                setOffice(o.id);
                                setPerson(id || "xing");
                                open("staff");
                              }}
                            >
                              调整 / 查看负责人
                            </button>
                          </article>
                        </Tooltip>
                      );
                    })}
                    {Object.entries(s.factions).map(([id, fac]) => (
                      <Tooltip
                        key={id}
                        title={factionNames[id as keyof typeof factionNames]}
                        content={
                          <>
                            <p>
                              影响由当前实际任职人数×2与已获得政治支持构成；当前
                              {fac.influence}。
                            </p>
                            <p>
                              不满{fac.discontent}
                              ，由派系人物积怨汇总。任命影响机构控制，强制与改革可能增加积怨；人物到3会关闭协办资格。
                            </p>
                          </>
                        }
                      >
                        <p tabIndex={0}>
                          {factionNames[id as keyof typeof factionNames]}：影响
                          {fac.influence} / 不满{fac.discontent}
                        </p>
                      </Tooltip>
                    ))}
                  </>
                )}
                {modal === "economy" && (
                  <>
                    <h3>财政预测 · 先支出，后收入</h3>
                    <div className="finance-summary">
                      <strong>
                        {f.current} → {f.next}
                      </strong>
                      <span>
                        收入 +{f.income} /支出 −{f.total}
                      </span>
                    </div>
                    <p>
                      收入：
                      {f.sources.map((row) => (
                        <span key={row.label}>
                          {row.label} +{row.amount}；
                        </span>
                      ))}
                      <br />
                      支出：固定预算{f.fixed} +组织/设施维护{f.maintenance}{" "}
                      +可施工项目{f.projectCosts}。
                    </p>
                    <div className="maintenance-sources">
                      {f.maintenanceSources.map((row) => (
                        <p key={row.label}>
                          {row.label}：每期{row.amount}财政
                        </p>
                      ))}
                    </div>
                    <p className={f.default ? "danger" : ""}>
                      {f.default
                        ? "当前余额不足以履行承诺，本次违约；连续两次违约失败。"
                        : "本次能履行全部承诺。"}
                    </p>
                    {m.mode === "tutorial" && m.tutorial === 2 && (
                      <Tooltip
                        title={previewAction(g, { type: "forecast" }).title}
                        content={actionExplanation({ type: "forecast" })}
                      >
                        <button
                          className="v2-primary tutorial-highlight"
                          onClick={() => choose({ type: "forecast" })}
                        >
                          核对财政预测
                        </button>
                      </Tooltip>
                    )}
                    <AdministrativeConsole
                      game={g}
                      province={selected}
                      onChoose={choose}
                    />
                    <h3>既有地方预算承诺</h3>
                    {m.budgets.map((pid) => (
                      <article className="document-card" key={pid}>
                        <p>
                          {s.provinces.find((p) => p.id === pid)!.name}
                          预算承诺：每回合1财政
                        </p>
                        <Tooltip
                          title={
                            previewAction(g, {
                              type: "pause",
                              work: `budget:${pid}`,
                            }).title
                          }
                          content={actionExplanation({
                            type: "pause",
                            work: `budget:${pid}`,
                          })}
                        >
                          <button
                            disabled={!playing}
                            onClick={() =>
                              choose({ type: "pause", work: `budget:${pid}` })
                            }
                          >
                            撤销预算（信任下降）
                          </button>
                        </Tooltip>
                      </article>
                    ))}
                    <h3>当前地区：{local.name}</h3>
                    <div className="quick-grid">
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "project",
                            project: "warning",
                            province: selected,
                          }).title
                        }
                        content={actionExplanation({
                          type: "project",
                          project: "warning",
                          province: selected,
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({
                              type: "project",
                              project: "warning",
                              province: selected,
                            })
                          }
                        >
                          预警站建设
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "project",
                            project: "energy",
                            province: selected,
                          }).title
                        }
                        content={actionExplanation({
                          type: "project",
                          project: "energy",
                          province: selected,
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({
                              type: "project",
                              project: "energy",
                              province: selected,
                            })
                          }
                        >
                          宗门能源工程
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, { type: "investigate", deck: "ley" })
                            .title
                        }
                        content={actionExplanation({
                          type: "investigate",
                          deck: "ley",
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({ type: "investigate", deck: "ley" })
                          }
                        >
                          <Zap size={18} />
                          灵脉勘探
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "investigate",
                            deck: "standards",
                          }).title
                        }
                        content={actionExplanation({
                          type: "investigate",
                          deck: "standards",
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({ type: "investigate", deck: "standards" })
                          }
                        >
                          <Layers size={18} />
                          标准化试点
                        </button>
                      </Tooltip>
                    </div>
                  </>
                )}
                {modal === "goals" && (
                  <>
                    {m.mode === "national" || m.mode === "experimental" ? (
                      <>
                        {m.goalPending ? (
                          <>
                            <h3>国家发展规划会议</h3>
                            <p>
                              {s.turn === 1
                                ? "第1回合：先了解国情，可预览三条战略。第2回合开放正式立项。"
                                : "会议已开放：最迟第3回合结束前确立主要战略。"}
                            </p>
                            <div className="goal-strategies">
                              {Object.entries(goals).map(([id, x]) => {
                                const goal = id as Goal,
                                  d = strategyDetails[goal];
                                return (
                                  <article className="strategy-card" key={goal}>
                                    <h3>
                                      <Target /> {x.name}
                                    </h3>
                                    <p>{x.description}</p>
                                    <p>
                                      <b>建设方向：</b>
                                      {d.direction}
                                    </p>
                                    <p>
                                      <b>组织能力：</b>
                                      {d.needs}
                                    </p>
                                    <p>
                                      <b>受益者：</b>
                                      {d.beneficiaries}
                                    </p>
                                    <p>
                                      <b>政治阻力：</b>
                                      {d.resistance}
                                    </p>
                                    <details>
                                      <summary>当前国情适配与里程碑</summary>
                                      {milestones(g, goal).map((c) => (
                                        <p
                                          key={c.label}
                                          className={c.met ? "met" : "unmet"}
                                        >
                                          {c.met ? "✓" : "○"} {c.label}：
                                          {c.reason}
                                        </p>
                                      ))}
                                    </details>
                                    <Tooltip
                                      title={`立项${x.name}`}
                                      content={actionExplanation({
                                        type: "selectGoal",
                                        goal,
                                      })}
                                    >
                                      <button
                                        disabled={!playing}
                                        onClick={() =>
                                          choose({ type: "selectGoal", goal })
                                        }
                                      >
                                        {s.turn < 2 ? "预览" : "提交"}
                                        {x.name}立项
                                      </button>
                                    </Tooltip>
                                  </article>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <>
                            <h3>{goals[m.goal].name}</h3>
                            <p>{goals[m.goal].description}</p>
                            <p>
                              第{duration(g)}回合需执行「{goals[m.goal].finale}
                              」，建设条件终局重新判定。
                            </p>
                            {m.mode === "experimental" && (
                              <div className="document-card">
                                <b>第10～12回合 · 终局检验</b>
                                <p>
                                  {m.terminalInspected
                                    ? "✓ 全国协作演练已通过；终局仍复核当前组织资格"
                                    : "第10～11回合须完成全国工程与协作演练；先完成下方全部建设条件。"}
                                </p>
                                <Tooltip
                                  title="全国工程与协作演练"
                                  content={actionExplanation({
                                    type: "inspect",
                                  })}
                                >
                                  <button
                                    disabled={!playing}
                                    onClick={() => choose({ type: "inspect" })}
                                  >
                                    预览全国协作演练
                                  </button>
                                </Tooltip>
                              </div>
                            )}
                            {target.map((c) => (
                              <Tooltip
                                key={c.label}
                                title={c.label}
                                content={
                                  <>
                                    <p>{c.reason}</p>
                                    <p>
                                      当前{c.met ? "已满足" : "尚未满足"}
                                      ，终局将重新检查人员、制度和设施。
                                    </p>
                                  </>
                                }
                              >
                                <article
                                  tabIndex={0}
                                  className={`goal-condition ${c.met ? "met" : "unmet"}`}
                                  key={c.label}
                                >
                                  {c.met ? <Check /> : <Target />}
                                  <div>
                                    <b>{c.label}</b>
                                    <p>{c.reason}</p>
                                  </div>
                                </article>
                              </Tooltip>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <h3>南岭—北境紧急状态</h3>
                        <p>实际管理南岭事故及北境危机，并存活至第4回合。</p>
                        <p>
                          南岭：
                          {m.milestones.includes("accident-managed")
                            ? "已管理"
                            : "未完成"}{" "}
                          /北境：
                          {m.milestones.includes("north-managed")
                            ? "已管理"
                            : "未完成"}
                        </p>
                        <p>
                          流程：第1回合预警 → 第2回合事故 → 实际处置产生不同后续
                          → 第4回合北境旧神。
                        </p>
                      </>
                    )}
                    <button onClick={() => open("matters")}>
                      调阅国家事务
                    </button>
                  </>
                )}
                {modal === "matters" && (
                  <>
                    {focusedMatter && (
                      <button onClick={() => setFocusedMatter(null)}>
                        查看全部事务
                      </button>
                    )}
                    {matterCards.length ? (
                      matterCards
                    ) : (
                      <p>当前事务已处理。可以继续建设，或结束回合。</p>
                    )}
                    <details>
                      <summary>已解决事务归档 · {m.archive.length}项</summary>
                      {m.archive.map((x) => (
                        <article className="document-card" key={x.id}>
                          <b>
                            <Check size={17} /> {x.title}
                          </b>
                          <p>
                            已解决 ·{" "}
                            {s.provinces.find((p) => p.id === x.province)?.name}
                          </p>
                          <p>
                            {m.results.find(
                              (r) =>
                                r.action.type === "resolve" &&
                                r.action.matter === x.id &&
                                r.status === "resolved",
                            )?.title || "旧记录"}
                          </p>
                        </article>
                      ))}
                    </details>
                    <div className="quick-grid">
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "investigate",
                            deck: "archive",
                          }).title
                        }
                        content={actionExplanation({
                          type: "investigate",
                          deck: "archive",
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({ type: "investigate", deck: "archive" })
                          }
                        >
                          密封档案调查
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "investigate",
                            deck: "civic",
                          }).title
                        }
                        content={actionExplanation({
                          type: "investigate",
                          deck: "civic",
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({ type: "investigate", deck: "civic" })
                          }
                        >
                          跨文明公报
                        </button>
                      </Tooltip>
                    </div>
                    {m.backlog.length > 0 && (
                      <details>
                        <summary>公开待办 · {m.backlog.length}项</summary>
                        {m.backlog.map((x) => (
                          <p key={x.id}>{x.title} · 下回合接纳</p>
                        ))}
                      </details>
                    )}
                  </>
                )}
                {modal === "local" && (
                  <>
                    <h3>
                      {local.name} · {local.districts[district].name}
                    </h3>
                    <p>{local.subtitle}</p>
                    <p>
                      本区产出{local.districts[district].output} /全省库存
                      {local.stock} /信任{m.trust[selected]}/3 /自治
                      {local.autonomy} /群众疲劳{m.fatigue[selected]}
                    </p>
                    <p>
                      负责人：
                      {getPerson(s.appointments[`gov-${selected}`])?.name ||
                        "空缺"}
                      。收益权{m.rights[selected] ? "已保留" : "未签订"}
                      ；群众组织
                      {m.suppressed[selected] ? "已压制" : "仍可公开动员"}。
                    </p>
                    <p>
                      {(["production", "social", "anomaly"] as const)
                        .map((d) => `${domainNames[d]}压力${local.pressure[d]}`)
                        .join(" / ")}
                    </p>
                    <div className="quick-grid">
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "project",
                            project: "warning",
                            province: selected,
                          }).title
                        }
                        content={actionExplanation({
                          type: "project",
                          project: "warning",
                          province: selected,
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({
                              type: "project",
                              project: "warning",
                              province: selected,
                            })
                          }
                        >
                          预警站建设
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "project",
                            project: "energy",
                            province: selected,
                          }).title
                        }
                        content={actionExplanation({
                          type: "project",
                          project: "energy",
                          province: selected,
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({
                              type: "project",
                              project: "energy",
                              province: selected,
                            })
                          }
                        >
                          宗门能源工程
                        </button>
                      </Tooltip>
                      <Tooltip
                        title={
                          previewAction(g, {
                            type: "reconcile",
                            province: selected,
                          }).title
                        }
                        content={actionExplanation({
                          type: "reconcile",
                          province: selected,
                        })}
                      >
                        <button
                          disabled={!playing}
                          onClick={() =>
                            choose({ type: "reconcile", province: selected })
                          }
                        >
                          恢复地方协约
                        </button>
                      </Tooltip>
                      <button
                        onClick={() => {
                          setOffice(`gov-${selected}`);
                          setPerson(
                            s.appointments[`gov-${selected}`] || "xing",
                          );
                          open("staff");
                        }}
                      >
                        查看地方人事
                      </button>
                    </div>
                    <h3>地区设施与建设</h3>
                    {m.works
                      .filter((w) => w.province === selected)
                      .map((w) => (
                        <article className="document-card" key={w.id}>
                          <b>{workSpecs[w.type].name}</b>
                          <p>
                            {w.completed
                              ? "已竣工"
                              : `${w.progress}/${w.duration} · ${w.paused ? "暂停" : "施工中"}`}
                          </p>
                          <button onClick={() => open("economy")}>
                            调阅经济与承诺
                          </button>
                        </article>
                      ))}
                    {selected === "industry" && district === 0 && (
                      <button onClick={() => open("central")}>
                        调阅首都中央机构
                      </button>
                    )}
                    <h3>地区事务</h3>
                    {m.matters
                      .filter((x) => x.province === selected)
                      .map((x) => (
                        <button
                          className="local-matter"
                          key={x.id}
                          onClick={() => locate(x.id)}
                        >
                          {x.title}
                          <ChevronRight size={18} />
                        </button>
                      ))}
                    <details>
                      <summary>当前特殊能力资格</summary>
                      {Object.entries(capNames).map(([id, name]) => {
                        const it = m.matters.find(
                          (x) => x.province === selected,
                        ) || {
                          id: "inspect",
                          province: selected,
                          kind: "oldgod" as const,
                          title: "",
                          description: "",
                          stage: 1,
                          containment: 0,
                          evacuated: false,
                          isolated: false,
                          age: 0,
                        };
                        const cs = capability(
                          g,
                          id as keyof typeof capNames,
                          it,
                          id === "seal" ? 0 : 1,
                        );
                        return (
                          <article className="document-card" key={id}>
                            <b>
                              {name} ·{" "}
                              {cs.every((c) => c.met) ? "可用" : "受阻"}
                            </b>
                            {cs
                              .filter((c) => !c.met)
                              .map((c) => (
                                <p key={c.label}>{c.reason}</p>
                              ))}
                          </article>
                        );
                      })}
                    </details>
                  </>
                )}
                {modal === "history" && (
                  <div className="v2-history">
                    {executionFeedback}
                    <details>
                      <summary>
                        结构化执行诊断（实际效果、事务ID与随机状态）
                      </summary>
                      <pre className="actual-report">
                        {JSON.stringify(
                          {
                            seed: s.seed,
                            rng: s.rng,
                            rules: m.rulesVersion,
                            revision: m.revision,
                            results: m.results,
                          },
                          null,
                          2,
                        )}
                      </pre>
                      <button
                        onClick={async () => {
                          const text = JSON.stringify(
                            {
                              seed: s.seed,
                              rng: s.rng,
                              rules: m.rulesVersion,
                              revision: m.revision,
                              results: m.results,
                              lastFailure:
                                result?.status === "failed"
                                  ? result
                                  : undefined,
                            },
                            null,
                            2,
                          );
                          try {
                            await navigator.clipboard.writeText(text);
                            setNotice("执行诊断已复制");
                          } catch {
                            setNotice("复制受限，可选中诊断文本手动复制");
                          }
                        }}
                      >
                        复制执行诊断
                      </button>
                    </details>
                    {m.history.map((h) => (
                      <article id={h.id} key={h.id} className="document-card">
                        <span className="eyebrow">
                          第{h.turn}回合 /{h.id}
                        </span>
                        <h3>{h.title}</h3>
                        <p>
                          参与：
                          {h.actors
                            .map((id) => getPerson(id)?.name || id)
                            .join("、") || "自动结算/制度"}{" "}
                          ·{" "}
                          {h.institutions
                            .map((id) => getOffice(id)?.name || id)
                            .join("、")}
                        </p>
                        <details>
                          <summary>当时条件</summary>
                          {h.conditions.map((c, i) => (
                            <p key={i}>{c}</p>
                          ))}
                        </details>
                        <ul>
                          {h.effects.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                        {h.parents.map((id) => (
                          <button
                            className="text-button"
                            key={id}
                            onClick={() => historySource(id)}
                          >
                            因果前序：
                            {m.history.find((x) => x.id === id)?.title}
                          </button>
                        ))}
                      </article>
                    ))}
                  </div>
                )}
              </PanelFrame>
            )}
          </section>
          <aside
            className={`alerts-rail ${alertsOpen ? "expanded" : ""}`}
            aria-label="重要提醒"
          >
            <header>
              <h2>
                <Bell size={20} />
                重要提醒
              </h2>
              <button
                className="alerts-toggle"
                aria-label={alertsOpen ? "折叠提醒" : "展开提醒"}
                onClick={() => setAlertsOpen(!alertsOpen)}
              >
                <Bell size={22} />
                <b>{m.matters.length}</b>
              </button>
            </header>
            <div className="alerts-scroll">
              {result && (
                <button
                  className={`alert-item ${result.status === "failed" ? "urgent" : "info"}`}
                  onClick={() => open("history")}
                >
                  <Check />
                  <div>
                    <b>{resultNames[result.status]}</b>
                    <small>{result.title} · 查看实际效果与剩余要求</small>
                  </div>
                </button>
              )}
              {planningAlert}
              {(f.default || s.commands === 0) && (
                <button
                  className="alert-item urgent"
                  onClick={() => open("economy")}
                >
                  <AlertTriangle />
                  <div>
                    <b>{f.default ? "财政承诺无法履行" : "本回合命令已耗尽"}</b>
                    <small>
                      {f.default
                        ? "检查施工与预算承诺，连续两次违约失败"
                        : "查看局势后可结束回合"}
                    </small>
                  </div>
                </button>
              )}
              {alerts.length ? alerts : <p>当前没有需审议事务。</p>}
              <details className="secondary-alerts">
                <summary>政治阻力 / 建设与里程碑</summary>
                {minorAlerts}
              </details>
              {m.backlog.length > 0 && (
                <button
                  className="alert-item normal"
                  onClick={() => open("matters")}
                >
                  <ScrollText size={18} />
                  <div>
                    <b>公开待办 {m.backlog.length}项</b>
                    <small>下回合按名额接纳</small>
                  </div>
                </button>
              )}
            </div>
            <footer>
              <span className="eyebrow">指挥席 / 情报分级</span>
              <span>
                <i className="urgent-dot" />
                紧急 <i className="normal-dot" />
                普通 <i className="info-dot" />
                信息
              </span>
            </footer>
          </aside>
          <footer className="turn-bar">
            <button className="selected-object" onClick={() => open("local")}>
              <MapPin size={22} />
              <div>
                <b>
                  {local.name} · {local.districts[district].name}
                </b>
                <span>
                  库存 {local.stock} / 信任 {m.trust[selected]}/3
                </span>
              </div>
            </button>
            <div className="region-shortcuts">
              <Tooltip
                title={
                  previewAction(g, {
                    type: "project",
                    project: "warning",
                    province: selected,
                  }).title
                }
                content={actionExplanation({
                  type: "project",
                  project: "warning",
                  province: selected,
                })}
              >
                <button
                  disabled={!playing}
                  onClick={() =>
                    choose({
                      type: "project",
                      project: "warning",
                      province: selected,
                    })
                  }
                >
                  预警建设
                </button>
              </Tooltip>
              <button
                disabled={!playing}
                onClick={() => {
                  setOffice(`gov-${selected}`);
                  setPerson(s.appointments[`gov-${selected}`] || "xing");
                  open("staff");
                }}
              >
                地方人事
              </button>
            </div>
            <span className="turn-label">
              联邦历 {1950 + s.turn} · 第{s.turn}回合 · 剩余{s.commands}命令
            </span>
            {!playing ? (
              <button
                className="v2-primary end-turn"
                onClick={() => {
                  setReportOpen(true);
                  setModal(null);
                }}
              >
                执政报告
              </button>
            ) : (
              <Tooltip
                title={previewAction(g, { type: "end" }).title}
                content={actionExplanation({ type: "end" })}
              >
                <button
                  className="v2-primary end-turn"
                  aria-label="结束回合"
                  onClick={() => choose({ type: "end" })}
                >
                  结束回合 <ArrowRight size={20} />
                </button>
              </Tooltip>
            )}
          </footer>
        </main>
      )}
      {notice && (
        <div className="command-notice" role="status">
          <Check size={18} />
          <p>{notice}</p>
          <button aria-label="关闭通知" onClick={() => setNotice("")}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
function personOfficeLabel(
  appointments: Record<string, string | null>,
  id: string,
) {
  const office = Object.entries(appointments).find(([, p]) => p === id)?.[0];
  return office ? getOffice(office).short : "待任命";
}
