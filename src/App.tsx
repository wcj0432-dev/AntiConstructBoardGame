import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  Flag,
  Globe2,
  Landmark,
  Layers,
  Save,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
  AlertTriangle,
  ScrollText,
  MapPin,
  Download,
} from "lucide-react";
import { coreAbilities, goals, plansFor, regimes, capNames } from "./v2/data";
import {
  capability,
  deserializeV2,
  duration,
  executeAction,
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
import type { Action, Goal, Mode, Regime, V2Game } from "./v2/model";
import type { Issue, ProvinceId } from "./types";
import "./v2/style.css";
const lessons = [
  {
    title: "01 · 人物不是数值工具",
    body: "打开人事，任命星野澪为南岭省负责人。比较普通预防检修与「群众参与巡检」：后者只有人物、公开路线与组织资格都满足才可发动。",
  },
  {
    title: "02 · 先确定谁能参与",
    body: "本次事故要求明确临时指挥关系。点击授权，让南岭省政府主持并邀请中央协办。公开救援与秘密封印会因实际负责人和参与资格出现不同的受阻原因。",
  },
  {
    title: "03 · 看清财政承诺",
    body: "财政先支出4，再获得收入5。工程、制度维护与部门预算增加持续支出；点击「核对财政预测」，然后查看由实际事故处置生成的后续局势。",
  },
  {
    title: "04 · 你的决定改变下一场危机",
    body: "处理能源配给或地方说明诉求。详情中的因果来源会链接到你刚刚的处置；授权、政策、人物变更可以继续改变行动资格。",
  },
  {
    title: "教学完成",
    body: "你已实际体验人物资格、指挥关系、财政和后续局势。可以继续完成4回合，也可以新开8回合国家目标模式。",
  },
];
export default function App() {
  const [g, setG] = useState<V2Game>(() => newV2("tutorial"));
  const [selected, setSelected] = useState<ProvinceId>("south");
  const [action, setAction] = useState<Action | null>(null);
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [modal, setModal] = useState<
    "new" | "staff" | "reform" | "policy" | "help" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>("campaign");
  const [goal, setGoal] = useState<Goal>("night");
  const [seed, setSeed] = useState("南岭—北境-020");
  const [office, setOffice] = useState("gov-south");
  const [person, setPerson] = useState("xing");
  const [issue, setIssue] = useState<Issue>("disclosure");
  const [tab, setTab] = useState<"matters" | "history">("matters");
  const [authorizationMatter, setAuthorizationMatter] = useState("");
  const [lead, setLead] = useState("gov-south");
  const [joint, setJoint] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const s = g.core,
    m = g.machine,
    f = finance(g),
    playing = s.status === "playing";
  const v = action ? previewAction(g, action) : null;
  const local = s.provinces.find((p) => p.id === selected)!;
  const target = milestones(g);
  function choose(a: Action) {
    setAction(a);
    setConfirmedPreview(false);
    setModal(null);
  }
  function perform() {
    if (!action) return;
    try {
      setG(executeAction(g, action));
      setAction(null);
      setNotice("决策已执行，实际条件与后果已写入因果历史。");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function store() {
    try {
      localStorage.setItem(SAVE_V2, serializeV2(g));
      setNotice("v0.2完整存档已保存，包括制度过渡、工程与因果关系。");
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
      setG(deserializeV2(raw));
      setAction(null);
      setNotice("完整组织状态已恢复。");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function historySource(id: string | undefined) {
    if (id) {
      setTab("history");
      setNotice(`查看因果节点：${id}`);
      setAction(null);
      setTimeout(
        () =>
          document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50,
      );
    }
  }
  return (
    <div className="v2-app">
      <header className="v2-header">
        <div className="v2-brand">
          <Globe2 size={35} />
          <div>
            <h1>
              诸界联邦 <span>国家机器重构 · v0.2</span>
            </h1>
            <p>FEDERATION OF WORLDS / 一套可以被改变的国家</p>
          </div>
        </div>
        <nav>
          <button onClick={() => setModal("help")}>
            <BookOpen size={18} />
            帮助
          </button>
          <button onClick={store}>
            <Save size={18} />
            存档
          </button>
          <button onClick={load}>
            <Download size={18} />
            读档
          </button>
          <button onClick={() => setModal("new")}>
            <Flag size={18} />
            新任期
          </button>
        </nav>
      </header>
      <div className="v2-resources">
        <div>
          <span>当前回合</span>
          <strong>
            {s.turn}
            <small> / {duration(g)}</small>
          </strong>
        </div>
        <div>
          <span>
            <Coins size={17} />
            财政
          </span>
          <strong>{s.treasury}</strong>
        </div>
        <div>
          <span>
            <ScrollText size={17} />
            行政命令
          </span>
          <strong>
            {s.commands}
            <small>本回合可用</small>
          </strong>
        </div>
        <div>
          <span>
            <Landmark size={17} />
            政治资本
          </span>
          <strong>{s.capital}</strong>
        </div>
        <div className={s.crisis >= 8 ? "danger" : ""}>
          <span>
            <Activity size={17} />
            全国危机
          </span>
          <strong>
            {s.crisis}
            <small> / 12</small>
          </strong>
        </div>
      </div>
      <div className="v2-content">
        <section className="v2-main">
          <div className="v2-title-row">
            <div>
              <span className="v2-eyebrow">
                任期档案 /{" "}
                {m.mode === "national" ? "国家目标模式" : "南岭—北境紧急状态"}
              </span>
              <h2>
                {m.mode === "national"
                  ? goals[m.goal].name
                  : "四回合组织验证战役"}
              </h2>
            </div>
            <span className="v2-regime-label">{regimes[m.regime].name}</span>
          </div>
          {m.mode === "tutorial" && (
            <section className="v2-tutorial">
              <div className="v2-title-row">
                <h3>{lessons[m.tutorial].title}</h3>
                <button onClick={() => choose({ type: "skip" })}>
                  跳过教学
                </button>
              </div>
              <p>{lessons[m.tutorial].body}</p>
              <div className="v2-steps">
                {lessons.slice(0, 4).map((_, i) => (
                  <span
                    className={
                      i === m.tutorial
                        ? "current"
                        : i < m.tutorial
                          ? "done"
                          : ""
                    }
                    key={i}
                  >
                    {i < m.tutorial ? <Check size={15} /> : i + 1}
                  </span>
                ))}
              </div>
              {m.tutorial === 0 && (
                <button
                  className="v2-primary"
                  onClick={() => setModal("staff")}
                >
                  前往人事任命 <ArrowRight size={16} />
                </button>
              )}
              {m.tutorial === 2 && (
                <button
                  className="v2-primary"
                  onClick={() => choose({ type: "forecast" })}
                >
                  核对财政预测
                </button>
              )}
            </section>
          )}
          {m.mode === "national" && (
            <section className="v2-goal">
              <p>{goals[m.goal].description}</p>
              <div className="v2-milestones">
                {target.map((c) => (
                  <div key={c.label} className={c.met ? "met" : ""}>
                    <span>
                      {c.met ? <Check size={17} /> : <Flag size={17} />}
                    </span>
                    <div>
                      <b>{c.label}</b>
                      <p>{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="v2-goal-deadline">
                第8回合解锁「{goals[m.goal].finale}」。还剩{" "}
                {Math.max(0, 8 - s.turn)}{" "}
                个建设回合；终局会重新检查负责人和合作资格。
              </p>
            </section>
          )}
          <section className="v2-finance">
            <div className="v2-title-row">
              <h3>
                <Coins size={19} />
                财政预测 · 先支出，后收入
              </h3>
              <strong className={f.default ? "danger" : ""}>
                {f.current} → {f.next}
              </strong>
            </div>
            <div className="v2-finance-grid">
              <span>
                收入<b>+{f.income}</b>
              </span>
              <span>
                固定支出<b>−{f.fixed}</b>
              </span>
              <span>
                制度与预算<b>−{f.maintenance}</b>
              </span>
              <span>
                可暂停施工<b>−{f.projectCosts}</b>
              </span>
            </div>
            <p>
              税收5 +已完工能源设施{f.income - 5}；维护：委员会
              {m.regime === "joint" ? 1 : 0} /兼容标准{m.standards ? 1 : 0}{" "}
              /预算{m.budgets.length}。
            </p>
            <p>
              {f.default
                ? `现有财政不足以支付${f.total}承诺，本次将违约。连续两回合违约即失败。`
                : `本次可支付${f.total}财政承诺，结算后预计${f.next}财政。`}
            </p>
            {m.works
              .filter((w) => !w.completed)
              .map((w) => (
                <div className="v2-work" key={w.id}>
                  <span>
                    {s.provinces.find((p) => p.id === w.province)!.name} ·{" "}
                    {w.type === "energy" ? "灵脉能源工程" : "预警站"} ·{" "}
                    {w.progress}/{w.duration}
                    {w.paused ? "（暂停）" : ""}
                  </span>
                  <button onClick={() => choose({ type: "pause", work: w.id })}>
                    {w.paused ? "恢复施工" : "暂停承诺"}
                  </button>
                </div>
              ))}
            {m.budgets.map((pid) => (
              <div className="v2-work" key={pid}>
                <span>
                  {s.provinces.find((p) => p.id === pid)!.name}
                  预算承诺：每回合1财政
                </span>
                <button
                  onClick={() =>
                    choose({ type: "pause", work: `budget:${pid}` })
                  }
                >
                  撤销预算（信任下降）
                </button>
              </div>
            ))}
          </section>
          {s.paralysis > 0 && (
            <div className="v2-alert">
              <AlertTriangle size={20} />
              <div>
                <b>中央审批阻塞 {s.paralysis}/4</b>
                <p>
                  ≥2会封闭垂直体制地方审批，并减少下一回合命令；连续两回合≥4失败。
                </p>
              </div>
              <button onClick={() => choose({ type: "unblock" })}>
                预览疏通
              </button>
            </div>
          )}
          <div className="v2-tab-row">
            <button
              className={tab === "matters" ? "active" : ""}
              onClick={() => setTab("matters")}
            >
              当前局势 <b>{m.matters.length}</b>
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              因果历史 <b>{m.history.length}</b>
            </button>
            <span>新增接纳 {m.admitted}/3</span>
          </div>
          {tab === "matters" ? (
            <>
              <div className="v2-matters">
                {m.matters.map((item) => {
                  const part = participants(g, item);
                  return (
                    <article
                      className={`v2-matter ${item.kind}`}
                      key={item.id}
                      data-matter-id={item.id}
                    >
                      <div className="v2-matter-meta">
                        <span>
                          <MapPin size={16} />
                          {
                            s.provinces.find((p) => p.id === item.province)!
                              .name
                          }
                        </span>
                        <span>
                          {["accident", "oldgod"].includes(item.kind)
                            ? `持续危机 · 阶段${item.stage}/4 · ${["", "异常出现", "生产交通受阻", "人口行政危机", "全国紧急状态"][item.stage]}`
                            : "决策事务"}
                        </span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      {item.containment > 0 && (
                        <div className="v2-managed">
                          <Shield size={16} />
                          已遏制 {item.containment} 回合
                          {item.evacuated ? " · 人口已撤离" : ""}
                          {item.isolated ? " · 区域隔离、产出停止" : ""}
                        </div>
                      )}
                      <div className="v2-actor-line">
                        <span>主管：{getOffice(part.lead).name}</span>
                        <span>
                          负责人：
                          {part.actors
                            .map((id) => getPerson(id)!.name)
                            .join("、") || "空缺"}
                        </span>
                      </div>
                      {item.source && (
                        <button
                          className="v2-source"
                          onClick={() => historySource(item.source)}
                        >
                          这一局势来自哪次决定？ <ArrowRight size={14} />
                        </button>
                      )}
                      <div className="v2-plan-list">
                        {plansFor(item, m.goal).map((plan) => {
                          const a: Action = {
                            type: "resolve",
                            matter: item.id,
                            option: plan.id,
                          };
                          const view = previewAction(g, a);
                          return (
                            <button
                              key={plan.id}
                              className={
                                view.errors.length ? "blocked" : "available"
                              }
                              disabled={!playing}
                              onClick={() => choose(a)}
                            >
                              <span className="v2-plan-icon">
                                {view.errors.length ? (
                                  <AlertTriangle size={18} />
                                ) : (
                                  <Sparkles size={18} />
                                )}
                              </span>
                              <div>
                                <b>{plan.title}</b>
                                <p>
                                  {view.errors.length
                                    ? view.errors[0]
                                    : plan.description}
                                </p>
                              </div>
                              <span className="v2-availability">
                                {view.errors.length ? "查看原因" : "可执行"}
                                <ArrowRight size={15} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="v2-authorize-link"
                        disabled={!playing}
                        onClick={() => {
                          setAuthorizationMatter(item.id);
                          setLead(`gov-${item.province}`);
                          setModal("reform");
                        }}
                      >
                        调整本事务指挥关系 / 临时授权
                      </button>
                    </article>
                  );
                })}
              </div>
              {m.backlog.length > 0 && (
                <details className="v2-panel">
                  <summary>
                    公开待办 · {m.backlog.length}项（下回合按名额接纳）
                  </summary>
                  {m.backlog.map((x) => (
                    <p key={x.id}>
                      {x.title} · 来源 {x.source || "主动局势"}
                    </p>
                  ))}
                </details>
              )}
              {m.matters.length === 0 && (
                <div className="v2-empty">
                  <Check size={28} />
                  <h3>当前事务已处理</h3>
                  <p>可以继续建设国家能力，或结束回合。</p>
                </div>
              )}
            </>
          ) : (
            <div className="v2-history">
              {m.history.map((h) => (
                <article key={h.id} id={h.id}>
                  <span className="v2-eyebrow">
                    第{h.turn}回合 / {h.id}
                  </span>
                  <h3>{h.title}</h3>
                  <p>
                    参与：
                    {h.actors
                      .map((id) => getPerson(id)?.name || id)
                      .join("、") || "制度/自动结算"}{" "}
                    ·{" "}
                    {h.institutions
                      .map((id) => getOffice(id)?.name || id)
                      .join("、")}
                  </p>
                  <details>
                    <summary>当时的判定条件</summary>
                    {h.conditions.map((c, i) => (
                      <p key={i}>{c}</p>
                    ))}
                  </details>
                  <ul>
                    {h.effects.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {h.parents.map((id) => (
                    <button
                      className="v2-source"
                      key={id}
                      onClick={() => historySource(id)}
                    >
                      ← 因果前序：{m.history.find((x) => x.id === id)?.title}
                    </button>
                  ))}
                </article>
              ))}
            </div>
          )}
          <section className="v2-actions">
            <h3>主动建设国家能力</h3>
            <p>每个行动都先展示条件和后果。资源不能购买缺失的正式资格。</p>
            <div>
              <button onClick={() => setModal("staff")} disabled={!playing}>
                <Users size={18} />
                人事与特殊能力
              </button>
              <button onClick={() => setModal("reform")} disabled={!playing}>
                <Landmark size={18} />
                三层权力改革
              </button>
              <button onClick={() => setModal("policy")} disabled={!playing}>
                <Flag size={18} />
                政策与批准路线
              </button>
              <button
                onClick={() => choose({ type: "investigate", deck: "ley" })}
                disabled={!playing}
              >
                <Zap size={18} />
                灵脉勘探
              </button>
              <button
                onClick={() => choose({ type: "investigate", deck: "archive" })}
                disabled={!playing}
              >
                <BookOpen size={18} />
                密封档案调查
              </button>
              <button
                onClick={() =>
                  choose({ type: "investigate", deck: "standards" })
                }
                disabled={!playing}
              >
                <Layers size={18} />
                标准化试点
              </button>
              <button
                onClick={() => choose({ type: "investigate", deck: "civic" })}
                disabled={!playing}
              >
                <Globe2 size={18} />
                跨文明公报
              </button>
            </div>
          </section>
        </section>
        <aside className="v2-sidebar">
          <section className="v2-panel v2-structure">
            <h3>
              <Landmark size={21} />
              当前国家结构
            </h3>
            <h4>{regimes[m.regime].name}</h4>
            <p className="v2-gain">解锁：{regimes[m.regime].gain}</p>
            <p className="v2-loss">限制：{regimes[m.regime].loss}</p>
            {m.pending && (
              <div className="v2-transition">
                改革过渡中 → {regimes[m.pending.regime].name}
                <br />第{m.pending.due}回合生效，当前审批仍按旧体制。
              </div>
            )}
            <p>
              全国部门改革：
              {m.department === "none"
                ? "尚无"
                : m.department === "anomaly"
                  ? "异常垂直主责"
                  : m.department === "transport"
                    ? "中央运输体系"
                    : "疏散权下放"}
            </p>
            {m.departmentPending && (
              <p>部门改革将在第{m.departmentPending.due}回合生效。</p>
            )}
            <button onClick={() => setModal("reform")} disabled={!playing}>
              查看制度与失去的能力 <ArrowRight size={16} />
            </button>
          </section>
          <section className="v2-panel">
            <h3>
              <MapPin size={21} />
              三省六区
            </h3>
            <div className="v2-province-buttons">
              {s.provinces.map((p) => (
                <button
                  className={p.id === selected ? "active" : ""}
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                >
                  {p.name.slice(0, 2)}
                  <b>{p.stock}</b>
                </button>
              ))}
            </div>
            <h4>{local.name}</h4>
            <p>
              {local.districts
                .map((d) => `${d.name}（产出${d.output}）`)
                .join(" / ")}
            </p>
            <div className="v2-local-stats">
              <span>
                地方信任<b>{m.trust[selected]}/3</b>
              </span>
              <span>
                自治特权<b>{local.autonomy}</b>
              </span>
              <span>
                群众疲劳<b>{m.fatigue[selected]}</b>
              </span>
            </div>
            <p>
              {m.suppressed[selected]
                ? "群众组织已压制：不能公开动员"
                : "群众组织尚可公开动员"}{" "}
              · 收益权{m.rights[selected] ? "已保留" : "未签订"}
            </p>
            <p>
              {(["production", "social", "anomaly"] as const)
                .map((d) => `${domainNames[d]}压力 ${local.pressure[d]}`)
                .join(" / ")}
            </p>
            <div className="v2-local-actions">
              <button
                onClick={() =>
                  choose({
                    type: "project",
                    project: "warning",
                    province: selected,
                  })
                }
                disabled={!playing}
              >
                预警站建设
              </button>
              <button
                onClick={() =>
                  choose({
                    type: "project",
                    project: "energy",
                    province: selected,
                  })
                }
                disabled={!playing}
              >
                宗门能源工程
              </button>
              <button
                onClick={() =>
                  choose({ type: "reconcile", province: selected })
                }
                disabled={!playing}
              >
                恢复地方协约
              </button>
            </div>
          </section>
          <details className="v2-panel">
            <summary>
              <Users size={19} />
              机构、人物与派系
            </summary>
            {offices.map((o) => {
              const id = s.appointments[o.id];
              return (
                <div className="v2-office" key={o.id}>
                  <b>{o.name}</b>
                  <p>
                    {getPerson(id)?.name || "职位空缺"} · 积怨{" "}
                    {id ? s.grievances[id] : "—"}
                  </p>
                  {id && coreAbilities[id] && <p>{coreAbilities[id].name}</p>}
                  <button
                    onClick={() => {
                      setOffice(o.id);
                      setPerson(id || "xing");
                      setModal("staff");
                    }}
                  >
                    调整 / 查看
                  </button>
                </div>
              );
            })}
            {Object.keys(s.factions).map((id) => (
              <p key={id}>
                {factionNames[id as keyof typeof factionNames]}：影响{" "}
                {s.factions[id as keyof typeof s.factions].influence} / 不满{" "}
                {s.factions[id as keyof typeof s.factions].discontent}
              </p>
            ))}
          </details>
          <details className="v2-panel">
            <summary>
              <Sparkles size={19} />
              当前行动能力资格
            </summary>
            {Object.keys(capNames).map((id) => {
              const matter = m.matters.find((x) => x.province === selected) || {
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
              const conditions = capability(
                g,
                id as keyof typeof capNames,
                matter,
                id === "seal" ? 0 : 1,
              );
              return (
                <div className="v2-capability" key={id}>
                  <b>
                    {capNames[id as keyof typeof capNames]} ·{" "}
                    {conditions.every((c) => c.met) ? "当前可用" : "当前受阻"}
                  </b>
                  {conditions
                    .filter((c) => !c.met)
                    .map((c) => (
                      <p key={c.label}>{c.reason}</p>
                    ))}
                </div>
              );
            })}
          </details>
        </aside>
      </div>
      <footer className="v2-bottom">
        <span>
          {regimes[m.regime].name} ·{" "}
          {m.mode === "national" ? goals[m.goal].name : "南岭—北境"} · 种子{" "}
          {s.seed}
        </span>
        <button
          className="v2-primary"
          disabled={!playing}
          onClick={() => choose({ type: "end" })}
        >
          预览回合结算 <ArrowRight size={20} />
        </button>
      </footer>
      {notice && (
        <div className="v2-notice" role="status">
          <p>{notice}</p>
          <button onClick={() => setNotice("")} aria-label="关闭提示">
            <X size={20} />
          </button>
        </div>
      )}
      {s.status !== "playing" && !modal && !action && (
        <div className="v2-overlay">
          <section
            className="v2-dialog v2-report"
            role="dialog"
            aria-modal="true"
            aria-label="执政报告"
          >
            <span className="v2-eyebrow">FEDERATION / ACTUAL DECISIONS</span>
            <h2>
              {s.status === "won"
                ? "国家机器发挥了作用。"
                : "任期结束，仍有未竟之事。"}
            </h2>
            <pre>{report(g)}</pre>
            <p>
              财政 {s.treasury} · 危机 {s.crisis}/12 · 完成事务 {s.resolved}
            </p>
            {s.provinces.map((p) => (
              <p key={p.id}>
                {p.name}物资 {p.stock} / 信任 {m.trust[p.id]} / 自治{" "}
                {p.autonomy}
              </p>
            ))}
            <button className="v2-primary" onClick={() => setModal("new")}>
              开始新任期
            </button>
            <button
              onClick={() => {
                setTab("history");
                setModal("help");
              }}
            >
              查阅完整决策历史
            </button>
          </section>
        </div>
      )}
      {action && v && (
        <div className="v2-overlay">
          <section
            className="v2-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="行动预览"
          >
            <button
              className="v2-close"
              onClick={() => setAction(null)}
              aria-label="关闭"
            >
              <X />
            </button>
            <span className="v2-eyebrow">选择 → 判定 → 解释 → 预览 → 确认</span>
            <h2>{v.title}</h2>
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
                  {c.met ? <Check size={19} /> : <AlertTriangle size={19} />}
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
                          | "ownership"
                          | "budget"
                          | "central",
                      })
                    }
                  >
                    <option value="ownership">保留地方收益权与1物资</option>
                    <option value="budget">承诺以后每回合1财政部门预算</option>
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
                  命令 {s.commands} → {v.after.commands} / 财政 {s.treasury} →{" "}
                  {v.after.treasury} / 资本 {s.capital} → {v.after.capital}
                </p>
                {v.errors.length > 0 && (
                  <p className="danger">当前不可执行：{v.errors.join("；")}</p>
                )}
              </div>
            )}
            <div className="v2-dialog-actions">
              <button onClick={() => setConfirmedPreview(true)}>
                预览后果
              </button>
              <button
                className="v2-primary"
                disabled={!confirmedPreview || v.errors.length > 0}
                onClick={perform}
              >
                确认执行 <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div className="v2-overlay">
          <section
            className="v2-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="国家设置"
          >
            <button
              className="v2-close"
              onClick={() => setModal(null)}
              aria-label="关闭"
            >
              <X />
            </button>
            {modal === "new" && (
              <>
                <h2>你要建立怎样的国家？</h2>
                <p>
                  新任期替换当前进度，不覆盖已保存的存档。v0.1存档会保留，不作静默转换。
                </p>
                <label className="v2-field">
                  游玩模式
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                  >
                    <option value="tutorial">四阶段操作教学（4回合）</option>
                    <option value="campaign">南岭—北境紧急状态（4回合）</option>
                    <option value="national">国家目标正式模式（8回合）</option>
                  </select>
                </label>
                <div className="v2-goal-choices">
                  {Object.keys(goals).map((id) => (
                    <button
                      className={goal === id ? "selected" : ""}
                      key={id}
                      onClick={() => setGoal(id as Goal)}
                    >
                      <b>{goals[id as Goal].name}</b>
                      <p>{goals[id as Goal].description}</p>
                    </button>
                  ))}
                </div>
                <label className="v2-field">
                  固定随机种子
                  <input
                    value={seed}
                    maxLength={64}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <button
                  className="v2-primary"
                  onClick={() => {
                    setG(newV2(mode, goal, seed || "南岭—北境-020"));
                    setModal(null);
                    setAction(null);
                    setTab("matters");
                  }}
                >
                  开始任期
                </button>
              </>
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
                    <button
                      className={person === p.id ? "selected" : ""}
                      key={p.id}
                      onClick={() => setPerson(p.id)}
                    >
                      <b>{p.name}</b>
                      <span>{personOfficeLabel(s.appointments, p.id)}</span>
                    </button>
                  ))}
                </div>
                <section className="v2-person-details">
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
                <div className="v2-dialog-actions">
                  <button
                    onClick={() =>
                      choose({ type: "appoint", office, person: null })
                    }
                  >
                    预览免职
                  </button>
                  {s.grievances[person] > 0 && (
                    <button onClick={() => choose({ type: "mediate", person })}>
                      预览政治和解
                    </button>
                  )}
                  <button
                    className="v2-primary"
                    onClick={() => choose({ type: "appoint", office, person })}
                  >
                    预览任命
                  </button>
                </div>
              </>
            )}
            {modal === "reform" && (
              <>
                <h2>改变行动权限，而不是购买通行费。</h2>
                <h3>第一层 · 当前事务临时授权</h3>
                <label className="v2-field">
                  具体事务
                  <select
                    value={authorizationMatter || m.matters[0]?.id || ""}
                    onChange={(e) => {
                      setAuthorizationMatter(e.target.value);
                      const it = m.matters.find((x) => x.id === e.target.value);
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
                <button
                  onClick={() =>
                    choose({
                      type: "authorize",
                      matter: authorizationMatter || m.matters[0]?.id || "",
                      lead,
                      joint,
                      emergency,
                    })
                  }
                  className="v2-primary"
                >
                  预览临时授权
                </button>
                <h3>第二层 · 全国部门改革</h3>
                <div className="v2-reform-buttons">
                  <button
                    onClick={() =>
                      choose({ type: "department", department: "anomaly" })
                    }
                  >
                    全国异常垂直主责
                  </button>
                  <button
                    onClick={() =>
                      choose({ type: "department", department: "evacuation" })
                    }
                  >
                    各省独立灾害疏散权
                  </button>
                  <button
                    onClick={() =>
                      choose({ type: "department", department: "transport" })
                    }
                  >
                    中央跨省运输体系
                  </button>
                </div>
                <h3>第三层 · 国家基础制度</h3>
                {Object.keys(regimes).map((id) => (
                  <button
                    key={id}
                    className="v2-regime-choice"
                    onClick={() =>
                      choose({ type: "regime", regime: id as Regime })
                    }
                  >
                    <b>{regimes[id as Regime].name}</b>
                    <p>获得：{regimes[id as Regime].gain}</p>
                    <p>限制：{regimes[id as Regime].loss}</p>
                    <span>1命令 +1财政 +2资本 / 下一回合生效</span>
                  </button>
                ))}
                <details>
                  <summary>小范围异常主责修补</summary>
                  <p>
                    针对当前选中的{local.name}；不自动给予跨省或联合行动权限。
                  </p>
                  {offices
                    .filter(
                      (o) =>
                        o.domains.includes("anomaly") &&
                        (!o.province || o.province === selected),
                    )
                    .map((o) => (
                      <button
                        key={o.id}
                        onClick={() =>
                          choose({
                            type: "local",
                            province: selected,
                            lead: o.id,
                          })
                        }
                      >
                        {o.name}
                      </button>
                    ))}
                </details>
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
                    <button
                      key={name}
                      onClick={() => choose({ type: "policy", issue, side })}
                    >
                      {name}
                      <ArrowRight size={16} />
                    </button>
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
                <p>
                  先看目标与危机，点击方案查看人物、事权、路线和利益条件。受阻不等于资源不够：你可能需要换职位、改制度、提供正式授权，或采用不同能力。
                </p>
                <h3>财政与失败</h3>
                <p>
                  每回合基本收入5（完工能源设施另增税收1），先支付固定4、制度维护与可暂停项目。连续两次无法履行承诺会失败；全国危机≥12或中央阻塞连续两回合≥4也会失败。全国模式还要完成目标终局，存活本身不是正式胜利。
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
                  星火：勘探→墨玄在南岭任职→标准委员会→中央运输改革→工程竣工→保留收益权。协约：联合体制或疏散权下放→真实合作协议→处理事故→保留负责人信任。长夜：三个预警站→合法高级封印/联合行动→跨省应急→管理北境。每个目标还须在第8回合执行终局方案。
                </p>
                <h3>能力与危机的真实限制</h3>
                <p>
                  积怨达到3会拒绝协办；工程师离岗或被抽调会中断工程。临时授权本回合到期，改革下回合生效。公开救援不会自动消灭异常源；持续危机仍需要遏制、撤离、隔离或封印。每回合最多接纳3项新增事务，压力只检测一次。
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
          </section>
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
