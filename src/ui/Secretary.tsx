import { politicalStories } from "../v2/politicalStories";
import { ContractStory } from "./ContractStory";
import { useEffect, useState, useRef } from "react";
import {
  advisorAction,
  advisorEpilogue,
  advisorIssues,
  advisorOpening,
  advisorTurnReport,
  guideTopics,
  secretary,
  type AdvisorPanel,
  type AdvisorMode,
} from "../v2/advisor";
import type { Action, V2Game } from "../v2/model";
import type { ProvinceId } from "../types";
import secretarySheet from "../assets/v7/secretary-expressions.png";
import { ActionButton } from "./AdministrativeConsole";
export type Expression = "report" | "warning" | "celebrate" | "explain" | "wry";
export function SecretaryPortrait({
  expression = "report",
  small = false,
}: {
  expression?: Expression;
  small?: boolean;
}) {
  const index =
    expression === "warning" ? 1 : expression === "celebrate" ? 2 : 0;
  return (
    <span
      role="img"
      aria-label={`沈岚 · ${expression}`}
      className={`secretary-portrait ${small ? "small" : ""}`}
      style={{
        backgroundImage: `url(${secretarySheet})`,
        backgroundPosition: `${index * 50}% ${small ? "18%" : "center"}`,
      }}
    />
  );
}
function Dialogue({ text, animate }: { text: string; animate: boolean }) {
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const typing = animate && !reduced;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [count, setCount] = useState(typing ? 0 : text.length);
  useEffect(() => {
    setCount(typing ? 0 : text.length);
    if (!typing) return;
    const timer = setInterval(
      () =>
        setCount((n) => {
          const next = Math.min(text.length, n + 4);
          if (next === text.length) clearInterval(timer);
          return next;
        }),
      25,
    );
    timerRef.current = timer;
    return () => {
      clearInterval(timer);
      timerRef.current = null;
    };
  }, [text, typing]);
  return (
    <div className="secretary-dialogue">
      <p>
        {text.slice(0, count)}
        {count < text.length && <span aria-hidden="true">▌</span>}
      </p>
      {count < text.length && (
        <button
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            setCount(text.length);
          }}
        >
          立即显示全文
        </button>
      )}
    </div>
  );
}
export function SecretaryCue({
  topic,
  onRead,
  onOpen,
  onNavigate,
  animate,
}: {
  topic: string;
  onRead: () => void;
  onOpen: () => void;
  onNavigate: (panel: AdvisorPanel) => void;
  animate: boolean;
}) {
  const t = guideTopics[topic];
  if (!t) return null;
  return (
    <aside className="secretary-cue" aria-label="秘书主动提示">
      <SecretaryPortrait
        small
        expression={topic === "maintenance" ? "warning" : "report"}
      />
      <div>
        <strong>沈岚 · {t.title}</strong>
        <Dialogue text={t.body} animate={animate} />
        <div className="secretary-cue-actions">
          <button
            onClick={() => {
              onRead();
              onNavigate(t.panel);
            }}
          >
            调阅相关事务
          </button>
          <button
            onClick={() => {
              onRead();
              onOpen();
            }}
          >
            与秘书交谈
          </button>
          <button onClick={onRead}>已阅 / 跳过</button>
        </div>
      </div>
      <button
        aria-label="关闭秘书提示"
        className="secretary-cue-close"
        onClick={onRead}
      >
        ×
      </button>
    </aside>
  );
}
export function SecretaryConsole({
  game,
  animate,
  onNavigate,
  onChoose,
  onRead,
  focusStories = false,
}: {
  game: V2Game;
  animate: boolean;
  onNavigate: (
    panel: AdvisorPanel,
    province?: ProvinceId,
    matter?: string,
    person?: string,
  ) => void;
  onChoose: (a: Action) => void;
  onRead: (topic: string) => void;
  focusStories?: boolean;
}) {
  const [tab, setTab] = useState(focusStories ? "stories" : "brief"),
    [topic, setTopic] = useState("welcome");
  useEffect(() => {
    if (focusStories) setTab("stories");
  }, [focusStories]);
  const issues = advisorIssues(game),
    r = advisorTurnReport(game);
  return (
    <div className="secretary-console">
      <div className="secretary-identity">
        <SecretaryPortrait
          expression={
            game.core.status === "won"
              ? "celebrate"
              : issues.some((x) => x.priority >= 95)
                ? "warning"
                : "report"
          }
        />
        <div>
          <span className="eyebrow">EXECUTIVE SECRETARIAT</span>
          <h2>{secretary.name}</h2>
          <strong>{secretary.title}</strong>
          <p>{secretary.background}</p>
          <p className="secretary-aside">
            人物感想：“国家不会自己运转。好在，它也还没学会自己签字。”
          </p>
        </div>
      </div>
      <nav className="sub-tabs" aria-label="秘书议题">
        {[
          ["brief", "目前有哪些重要问题"],
          ["opening", "本届国情"],
          ["guide", "规则与引导"],
          ["turn", "回合政务摘要"],
          ["stories", "政治故事"],
          ["final", "执政回顾"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "brief" && (
        <>
          <p>
            事实汇报 · 按真实规则排序，最多五项。处理后自动更新，您自行决定。
          </p>
          {!issues.length && (
            <p>
              当前未检出高优先级问题。请继续核对战略条件；这不表示未来不会发生危机。
            </p>
          )}
          {issues.map((x) => (
            <article
              className="advisor-issue"
              key={x.id}
              data-advisor-issue={x.id}
            >
              <h3>
                {x.priority >= 95 ? "! " : ""}
                {x.title}
              </h3>
              <p>
                <b>原因：</b>
                {x.why}
              </p>
              <p>
                <b>影响：</b>
                {x.consequence}
              </p>
              <p>
                <b>可考虑：</b>
                {x.directions.join("；")}
              </p>
              <button
                onClick={() =>
                  onNavigate(x.panel, x.province, x.matter, x.person)
                }
              >
                定位并调阅
              </button>
              {x.source && <small>因果来源 {x.source}</small>}
            </article>
          ))}
        </>
      )}
      {tab === "opening" && (
        <>
          {advisorOpening(game).map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </>
      )}
      {tab === "guide" && (
        <>
          <label className="v2-field">
            独立主题
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {Object.entries(guideTopics).map(([id, x]) => (
                <option key={id} value={id}>
                  {game.machine.advisor?.seen.includes(id) ? "✓ " : ""}
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <h3>{guideTopics[topic].title}</h3>
          <Dialogue text={guideTopics[topic].body} animate={animate} />
          <button onClick={() => onRead(topic)}>标记已读</button>
          <button onClick={() => onNavigate(guideTopics[topic].panel)}>
            调阅相关界面
          </button>
          <p>
            已读状态保存在当前存档中。跳过任一主题均不影响命令、目标和其他主题。
          </p>
        </>
      )}
      {tab === "turn" && (
        <>
          <h3>第{r.turn}回合实录</h3>
          {!r.factual && <p>尚无回合结算记录；以下仅列当前账户。</p>}
          <p>{r.accounts.join("；")}</p>
          {r.changes.map((x) => (
            <p key={x.source}>
              <b>{x.title}</b>：{x.effect}
            </p>
          ))}
          <details>
            <summary>展开实际流水 · {r.ledger.length}笔</summary>
            {r.ledger.map((e) => (
              <p key={e.id}>
                {e.from} → {e.to}：{e.amount}，{e.reason}（{e.source}）
              </p>
            ))}
          </details>
          <button onClick={() => onNavigate("finance")}>
            核对账目与下期预测
          </button>
          <button onClick={() => onNavigate("history")}>查看因果历史</button>
        </>
      )}
      {tab === "stories" && (
        <>
          <ContractStory game={game} onChoose={onChoose} />
          <p>章节随真实合同、教学和共同工作演变，不另行发放剧情奖励。</p>
          {politicalStories(game).length === 0 && (
            <p>尚无足够的合同或共同经历形成长期章节。</p>
          )}
          {politicalStories(game).map((x) => (
            <article className="advisor-issue" key={x.id}>
              <h3>{x.title}</h3>
              <b>{x.phase}</b>
              <p>{x.fact}</p>
              <p>来源：{x.origins.join("、") || "当前正式任命与制度"}</p>
              <button onClick={() => onNavigate(x.panel, x.province)}>
                调阅真实关系
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "final" && (
        <>
          {advisorEpilogue(game).map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </>
      )}
    </div>
  );
}
export function SecretaryAdvice({
  game,
  action,
  onChoose,
}: {
  game: V2Game;
  action: Action;
  onChoose: (a: Action) => void;
}) {
  const [open, setOpen] = useState(false),
    a = advisorAction(game, action);
  return (
    <section className="secretary-action-advice">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        秘书意见 · 当前事务
      </button>
      {open && (
        <>
          <h3>沈岚 · 事实与取舍</h3>
          {a.facts.map((x, i) => (
            <p className={a.preview.errors.length ? "unmet" : "met"} key={i}>
              {x}
            </p>
          ))}
          {a.tradeoffs.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
          {a.alternatives.map((x, i) => (
            <article className="document-card" key={i}>
              <b>{x.preview.title}</b>
              <p>{x.preview.effects.slice(0, 2).join("；")}</p>
              <p className={x.preview.errors.length ? "unmet" : "met"}>
                {x.preview.errors.join("；") || "当前具备条件，可另行预览后果"}
              </p>
              <ActionButton
                game={game}
                action={x.action}
                label="比较这个方向"
                onChoose={onChoose}
              />
            </article>
          ))}
          <p className="secretary-aside">
            人物感想：几种方向会留下不同的责任。我可以列出签字栏，不能替您签。
          </p>
        </>
      )}
    </section>
  );
}
export function SecretarySettings({
  mode,
  onMode,
  animate,
  onAnimate,
}: {
  mode: AdvisorMode;
  onMode: (v: AdvisorMode) => void;
  animate: boolean;
  onAnimate: (v: boolean) => void;
}) {
  return (
    <>
      <label className="v2-field">
        首席秘书主动提示
        <select
          aria-label="秘书提示模式"
          value={mode}
          onChange={(e) => onMode(e.target.value as AdvisorMode)}
        >
          <option value="full">完整新手引导</option>
          <option value="important">仅重要提示</option>
          <option value="manual">仅手动询问</option>
          <option value="off">关闭主动提示</option>
        </select>
      </label>
      <label className="v2-checkbox">
        <input
          type="checkbox"
          checked={animate}
          onChange={(e) => onAnimate(e.target.checked)}
        />
        对话打字机效果（可立即显示全文）
      </label>
      <p>
        关闭主动提示后仍可手动打开秘书。对话无配音，不影响独立音乐与音效设置。
      </p>
    </>
  );
}
