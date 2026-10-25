import { agendaTitles, agendaStanding } from "../v2/factionAgendas";
import { useMemo, useState } from "react";
import {
  Landmark,
  Flame,
  Factory,
  ScrollText,
  Stamp,
  Search,
  Users,
  Flag,
  Coins,
  Link2,
} from "lucide-react";
import { getPerson, getOffice, factionNames } from "../data";
import type { Action, V2Game } from "../v2/model";
import type { ProvinceId } from "../types";
import {
  actionMarks,
  currentAffairs,
  governanceTargets,
  organizationBoard,
  crisisCards,
  engineeringCard,
  protocolCards,
  type BoardTarget,
  actionBottlenecks,
  constructionComparison,
  workDependencies,
} from "../v2/governance";
import { previewAction } from "../v2/engine";
import { accountLabel, nationalForecast } from "../v2/fiscal";
import { advisorIssues, guideTopics } from "../v2/advisor";
import { goals } from "../v2/data";
import { StateMarks, PersonStateMarks } from "./StateMarks";
import { PersonBadge } from "./Visuals";
import { ActionButton } from "./AdministrativeConsole";

export type BoardCategory =
  | "people"
  | "finance"
  | "engineering"
  | "institutions"
  | "investigation"
  | "crisis";
export const boardCategories = [
  ["people", "人事任免", Users],
  ["finance", "财政经济", Coins],
  ["engineering", "工程建设", Factory],
  ["institutions", "制度改革", Landmark],
  ["investigation", "调查应急", Search],
  ["crisis", "处理危机", Flame],
] as const;
export function CrisisTrack({ game, id }: { game: V2Game; id: string }) {
  const c = crisisCards(game).find((c) => c.id === id);
  if (!c) return null;
  return (
    <div className="crisis-track" data-crisis-id={id}>
      {c.step.staged && (
        <ol aria-label="危机阶段轨">
          {[1, 2, 3, 4].map((stage) => (
            <li
              key={stage}
              className={
                stage === c.stage ? "current" : stage < c.stage ? "past" : ""
              }
              aria-current={stage === c.stage ? "step" : undefined}
            >
              阶段{stage}
            </li>
          ))}
        </ol>
      )}
      <p>
        <b>已知：</b>
        {c.step.label}
      </p>
      {c.step.escalating && (
        <p className="unmet">
          若当前防护不变：危机+{c.step.crisis}
          {c.step.stock > 0 ? ` / 本地实物最多-${c.step.stock}` : ""}
          {c.step.paralysis ? ` / 审批阻塞+${c.step.paralysis}` : ""}
        </p>
      )}
      {c.step.linkedWorks.length > 0 && (
        <p>
          关联设施：
          {c.step.linkedWorks
            .map((id) => game.machine.works.find((w) => w.id === id))
            .filter(Boolean)
            .map((w) => (w!.type === "grid" ? "实际连接电网" : "实际连接铁路"))
            .join("、")}
        </p>
      )}
      {c.step.propagation.length > 0 && (
        <p className="unmet">
          本次失控将沿真实铁路向
          {c.step.propagation.map((e) => accountLabel(game, e.to)).join("、")}
          传播异常压力。
        </p>
      )}
      <small>{c.step.certainty}</small>
    </div>
  );
}
export function GovernanceTable({
  game,
  province,
  onTarget,
  onChoose,
  onCategory,
  focus,
  animate,
  guideTopic,
  onReadGuide,
}: {
  game: V2Game;
  province: ProvinceId;
  onTarget: (t: BoardTarget) => void;
  onChoose: (a: Action) => void;
  onCategory: (c: BoardCategory) => void;
  focus: BoardTarget | null;
  animate: boolean;
  guideTopic?: string;
  onReadGuide?: (id: string) => void;
}) {
  const [category, setCategory] = useState<BoardCategory>("crisis");
  const [slotOffice, setSlotOffice] = useState("");
  const org = useMemo(
      () => organizationBoard(game, province),
      [game, province],
    ),
    crises = useMemo(() => crisisCards(game), [game]),
    protocols = useMemo(() => protocolCards(game), [game]);
  const finance = useMemo(() => nationalForecast(game), [game]);
  const works = game.machine.works
    .filter((w) => !w.cancelled)
    .map((w) => engineeringCard(game, w, finance))
    .sort(
      (a, b) =>
        (b.type === "grid" ? 25 : 0) +
        (b.nextArrears > 0 ? 100 : 0) +
        (b.arrears > 0 ? 100 : 0) +
        (b.state.state === "building"
          ? 30
          : b.state.state === "stopped"
            ? 80
            : 0) -
        (a.type === "grid" ? 25 : 0) -
        (a.nextArrears > 0 ? 100 : 0) -
        (a.arrears > 0 ? 100 : 0) -
        (a.state.state === "building"
          ? 30
          : a.state.state === "stopped"
            ? 80
            : 0),
    );
  const targets = governanceTargets(game),
    missing = targets.filter((c) => !c.met),
    recommendations = advisorIssues(game);
  const agendas =
    game.machine.agendas?.items.filter((a) => a.state === "active") ?? [];
  const issueTarget = (
    r: ReturnType<typeof advisorIssues>[number],
  ): BoardTarget =>
    r.agenda
      ? { kind: "agenda", id: r.agenda, province: r.province }
      : r.work
        ? { kind: "work", id: r.work, province: r.province }
        : r.matter
          ? { kind: "matter", id: r.matter, province: r.province }
          : r.person
            ? { kind: "person", id: r.person }
            : r.panel === "finance"
              ? { kind: "finance", province: r.province }
              : r.panel === "goals"
                ? { kind: "goal" }
                : { kind: "secretary" };
  const categories: Record<BoardCategory, Action["type"][]> = {
    people: ["appoint", "concurrent"],
    finance: ["fiscalTransfer", "fiscalAgreement", "budget"],
    engineering: ["project"],
    institutions: ["budget", "authorize"],
    investigation: ["investigate", "personSkill"],
    crisis: ["authorize", "resolve"],
  };
  const eligible = (o: (typeof org)[number]) =>
    o.actions.some(
      (a) =>
        categories[category].includes(a.action.type) &&
        !a.preview.errors.length,
    );
  const selectedOffice =
    org.find(
      (o) =>
        o.id === (slotOffice || (focus?.kind === "office" ? focus.id : "plan")),
    ) ?? org[0];
  return (
    <section
      className={`governance-table ${animate ? "board-animate" : ""}`}
      aria-label="国家治理桌面"
      data-revision={game.machine.revision}
    >
      <div className="governance-columns">
        <section
          className="board-zone organization-zone"
          aria-label="国家组织板"
        >
          <header>
            <Landmark />
            <h2>国家组织</h2>
            <span>六个真实职位</span>
          </header>
          <div className="board-zone-scroll">
            <div className="board-office-grid">
              {org.map((o) => (
                <button
                  key={o.id}
                  data-board-office={o.id}
                  className={`board-office ${eligible(o) ? "board-eligible" : ""} ${focus?.kind === "office" && focus.id === o.id ? "board-highlight" : ""} ${!o.marks.some((m) => m.id === "ready") ? "board-blocked" : ""}`}
                  onClick={() =>
                    onTarget({
                      kind: "office",
                      id: o.id,
                      province: game.core.provinces.find(
                        (p) => `gov-${p.id}` === o.id,
                      )?.id,
                    })
                  }
                >
                  <strong>{o.title}</strong>
                  {o.person ? (
                    <PersonBadge id={o.person} />
                  ) : (
                    <span className="empty-office">空缺 · 需要任命</span>
                  )}
                  <StateMarks embedded marks={o.marks} />
                  <span className="board-special">
                    {o.special ? `特长：${o.special}` : "等待配置人物能力"}
                  </span>
                </button>
              ))}
            </div>
            <details className="board-action-slots">
              <summary>部门行动资格 · {selectedOffice.title}</summary>
              <label className="v2-field">
                行动机构
                <select
                  aria-label="部门行动机构"
                  value={selectedOffice.id}
                  onChange={(e) => setSlotOffice(e.target.value)}
                >
                  {org.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedOffice.actions.map((a) => (
                <div className="board-slot" key={a.id}>
                  <StateMarks marks={actionMarks(a.preview)} />
                  <ActionButton
                    game={game}
                    action={a.action}
                    onChoose={onChoose}
                    label={a.label}
                  />
                  <p className={a.preview.errors.length ? "unmet" : "met"}>
                    {a.preview.errors[0] ?? "当前可执行；仍需确认实际费用"}
                  </p>
                </div>
              ))}
            </details>
          </div>
        </section>
        <section className="board-zone matters-zone" aria-label="当前事务板">
          <header>
            <Flame />
            <h2>当前事务</h2>
            {game.machine.agendas?.items.length ? (
              <button
                aria-label="派系议程档案"
                onClick={() => onTarget({ kind: "agenda" })}
              >
                议程{agendas.length}
              </button>
            ) : null}
            <button onClick={() => onTarget({ kind: "matter" })}>
              全部 {crises.length}
            </button>
          </header>
          <div className="board-zone-scroll">
            {guideTopic && guideTopics[guideTopic] && (
              <details className="board-embedded-guide" key={guideTopic}>
                <summary>沈岚 · {guideTopics[guideTopic].title}</summary>
                <p>{guideTopics[guideTopic].body}</p>
                <button onClick={() => onReadGuide?.(guideTopic)}>
                  已阅 / 跳过此主题
                </button>
              </details>
            )}
            {currentAffairs(game).map((card) => {
              if (card.kind === "agenda") {
                const a = card.payload;
                return (
                  <article
                    className="board-card faction-agenda-card"
                    key={a.id}
                  >
                    <button
                      className="card-title-button"
                      data-board-agenda={a.id}
                      onClick={() =>
                        onTarget({
                          kind: "agenda",
                          id: a.id,
                          province: a.province,
                        })
                      }
                    >
                      <Users />
                      <strong>{agendaTitles[a.kind]}</strong>
                    </button>
                    <p>
                      {getPerson(a.issuer)?.name} · {factionNames[a.faction]} ·
                      期限第{a.deadline}回合结束
                    </p>
                    <p>
                      {agendaStanding(game, a).formal
                        ? "正式组织议程"
                        : "社会利益仍在，正式主持资格已变化"}
                    </p>
                  </article>
                );
              }
              const c = card.payload;
              return (
                <article
                  className={`board-card crisis-card ${focus?.kind === "matter" && focus.id === c.id ? "board-highlight" : ""}`}
                  key={c.id}
                >
                  <button
                    className="card-title-button"
                    data-board-matter={c.id}
                    onClick={() =>
                      onTarget({
                        kind: "matter",
                        id: c.id,
                        province: c.province,
                      })
                    }
                  >
                    <Flame />
                    <strong>{c.title}</strong>
                  </button>
                  <p className="card-meta">
                    {accountLabel(game, c.province)} ·{" "}
                    {c.step.escalating
                      ? "本次结算将推进"
                      : c.step.staged
                        ? "持续事务"
                        : "预警 / 政务机会"}
                  </p>
                  <CrisisTrack game={game} id={c.id} />
                </article>
              );
            })}
            {!crises.length &&
              recommendations.slice(0, 2).map((r) => (
                <article className="board-card" key={r.id}>
                  <strong>{r.title}</strong>
                  <p>{r.why}</p>
                  <button onClick={() => onTarget(issueTarget(r))}>
                    定位与处理
                  </button>
                </article>
              ))}
            {!crises.length && !recommendations.length && (
              <p>目前没有现存事务。可调查公开机会，或继续建设与国家规划。</p>
            )}
            <article className="board-card strategy-card">
              <h3>
                <Flag />
                {game.machine.governanceTrial
                  ? "四次会议 · 组织验收"
                  : game.machine.mode === "campaign" ||
                      game.machine.mode === "tutorial"
                    ? "四回合紧急状态"
                    : game.machine.goalPending
                      ? "国家战略待立项"
                      : goals[game.machine.goal].name}
              </h3>
              <p>
                {game.machine.goalPending
                  ? "第2～3回合召开发展规划会议，已建工程保留。"
                  : missing.length
                    ? `近期缺项：${missing[0].label}`
                    : "当前里程碑齐备，终局仍需实际验收。"}
              </p>
              <button onClick={() => onTarget({ kind: "goal" })}>
                {game.machine.goalPending
                  ? "调阅发展规划（尚未立项）"
                  : `调阅当前目标 ${targets.filter((c) => c.met).length}/${targets.length}`}
              </button>
            </article>
          </div>
        </section>
        <section
          className="board-zone engineering-zone"
          aria-label="国家工程与制度板"
        >
          <header>
            <Factory />
            <h2>工程与制度</h2>
            <button onClick={() => onTarget({ kind: "finance", province })}>
              账本
            </button>
          </header>
          <div className="board-zone-scroll">
            {works.slice(0, 3).map((w) => (
              <article
                className={`board-card engineering-card ${focus?.kind === "work" && focus.id === w.id ? "board-highlight" : ""}`}
                key={w.id}
              >
                <button
                  className="card-title-button"
                  data-board-work={w.id}
                  onClick={() =>
                    onTarget({ kind: "work", id: w.id, province: w.province })
                  }
                >
                  <Factory />
                  <strong>{w.title}</strong>
                </button>
                <StateMarks marks={w.marks} />
                <p>
                  {accountLabel(game, w.province)} ·{" "}
                  {w.state.state === "building"
                    ? `施工${w.progress}`
                    : w.contract}
                </p>
                <p>
                  主管：{getOffice(w.management).short}；技术：
                  {getPerson(w.worker)?.name ?? "无指定人员"}
                </p>
                <p>
                  维护：
                  {w.maintenance.map((a) => accountLabel(game, a)).join("、")}
                </p>
                {(w.arrears > 0 || w.nextArrears > 0) && (
                  <p className="unmet">
                    当前欠付{w.arrears} / 下期预计欠付{w.nextArrears}
                  </p>
                )}
              </article>
            ))}
            {!works.length && (
              <article className="board-card engineering-card">
                <h3>国家工程尚待构筑</h3>
                <p>人事、事权、技术和合同配合后，设施才会改变地区能力。</p>
                <button onClick={() => onCategory("engineering")}>
                  查看工程建设
                </button>
              </article>
            )}
            {works.length > 3 && (
              <button onClick={() => onCategory("engineering")}>
                查看其余 {works.length - 3} 项工程
              </button>
            )}
            <details className="board-protocols">
              <summary>
                <ScrollText />
                生效制度与协议 · {protocols.length}
              </summary>
              {protocols.map((p) => (
                <article key={p.id} className="board-card protocol-card">
                  <button
                    className="card-title-button"
                    onClick={() => onTarget(p.target)}
                  >
                    {p.title}
                  </button>
                  <p>
                    {p.scope} · {p.term}
                  </p>
                  <p>{p.effect}</p>
                </article>
              ))}
            </details>
            <details className="board-recommendations">
              <summary>沈岚 · 当前建议 {recommendations.length}</summary>
              {recommendations.map((r) => (
                <article key={r.id}>
                  <strong>{r.title}</strong>
                  <p>{r.why}</p>
                  <button onClick={() => onTarget(issueTarget(r))}>
                    定位真实构件
                  </button>
                </article>
              ))}
            </details>
          </div>
        </section>
      </div>
      <section className="board-agenda" aria-label="行政议程板">
        <div
          className="command-chips"
          aria-label={`剩余${game.core.commands}条行政命令`}
        >
          <Stamp />
          <b>行政命令 {game.core.commands}</b>
          <span>
            {Array.from({ length: game.core.commands }, (_, i) => (
              <i key={`remaining-${game.core.turn}-${i}`} aria-hidden="true">
                令
              </i>
            ))}
          </span>
          <small>对应实际命令，不预分配、不限定每类次数</small>
          {game.machine.results.at(-1) && (
            <span className="board-last-action" role="status">
              最近：{game.machine.results.at(-1)!.title}
            </span>
          )}
        </div>
        <nav aria-label="行政行动类别">
          {boardCategories.map(([id, name, Icon]) => (
            <button
              key={id}
              aria-pressed={category === id}
              onClick={() => {
                setCategory(id);
                onCategory(id);
              }}
            >
              <Icon />
              <span>{name}</span>
            </button>
          ))}
          <button onClick={() => onTarget({ kind: "secretary" })}>
            询问沈岚
          </button>
        </nav>
      </section>
    </section>
  );
}
export function ConstructionDetails({
  game,
  id,
  onTarget,
  onChoose,
}: {
  game: V2Game;
  id: string;
  onTarget: (t: BoardTarget) => void;
  onChoose: (a: Action) => void;
}) {
  const w = game.machine.works.find((w) => w.id === id);
  if (!w) return <p>该工程不存在；请回到桌面重新选择。</p>;
  const c = engineeringCard(game, w),
    nodes = workDependencies(game, w);
  return (
    <section aria-label="工程构筑与局部因果链">
      <h2>
        {c.title} · {accountLabel(game, w.province)}
      </h2>
      <StateMarks marks={c.marks} />
      <div className="component-chain">
        <button onClick={() => onTarget({ kind: "office", id: c.management })}>
          <Landmark />
          <b>主管机构</b>
          {getOffice(c.management).name}
          <PersonStateMarks
            embedded
            game={game}
            person={
              game.core.appointments[c.management] ??
              game.machine.secondaryAppointments?.[c.management] ??
              null
            }
          />
        </button>
        <button onClick={() => onTarget({ kind: "person", id: w.worker })}>
          <Users />
          <b>技术人员</b>
          {getPerson(w.worker)?.name ?? "无指定人员"}
        </button>
        <button
          onClick={() => onTarget({ kind: "finance", province: w.province })}
        >
          <Coins />
          <b>{c.contract}</b>
          {c.shares
            .map((s) => `${accountLabel(game, s.account)} 权重${s.weight}`)
            .join("；")}
        </button>
        <div>
          <Stamp />
          <b>维护责任</b>
          {c.maintenance.map((a) => accountLabel(game, a)).join("、")}
          <p>
            当前欠付{c.arrears}，下期预计欠付{c.nextArrears}
          </p>
        </div>
        <div>
          <ScrollText />
          <b>产权与收益</b>
          {c.owner === "joint" ? "共同产权" : accountLabel(game, c.owner)}
          ；实际受益地{accountLabel(game, c.beneficiary)}
          <p>维护接管不改变产权或停机控制。</p>
        </div>
      </div>
      <h3>当前局部因果链</h3>
      <ol className="dependency-chain">
        {nodes.map((n) => (
          <li className={n.blocked ? "blocked" : "ready"} key={n.id}>
            <button onClick={() => onTarget(n.target)}>
              <Link2 />
              <b>{n.label}</b>
              <p>{n.fact}</p>
            </button>
          </li>
        ))}
      </ol>
      <div className="quick-grid">
        <ActionButton
          game={game}
          action={{ type: "maintain", work: w.id }}
          label="补足本设施维护"
          onChoose={onChoose}
        />
        {(["central", w.province, "cult"] as const).map((account) => (
          <ActionButton
            key={account}
            game={game}
            action={{ type: "maintenanceSponsor", work: w.id, account }}
            label={`${accountLabel(game, account)}承接本设施维护`}
            onChoose={onChoose}
          />
        ))}
        {!w.completed && (
          <ActionButton
            game={game}
            action={{ type: "pause", work: w.id }}
            label={w.paused ? "恢复工程安排" : "暂停工程释放人员"}
            onChoose={onChoose}
          />
        )}
      </div>
      {w.type === "grid" && (
        <p>
          停机、维修与应急授权请核对下方同一电网的正式权限；维护接管不授予维修权。
        </p>
      )}
    </section>
  );
}
export function ActionBoardComparison({
  game,
  action,
  onTarget,
}: {
  game: V2Game;
  action: Action;
  onTarget: (t: BoardTarget) => void;
}) {
  const p = previewAction(game, action),
    blocks = actionBottlenecks(game, action),
    comparison = constructionComparison(game, action);
  return (
    <section className="board-comparison" aria-label="组织瓶颈与构筑前后对照">
      {p.errors.length > 0 && (
        <>
          <h3>从限制定位组织</h3>
          <p>{p.errors[0]}</p>
          <div className="component-chain">
            {blocks.map((b) => (
              <article key={b.id}>
                <button onClick={() => onTarget({ kind: "office", id: b.id })}>
                  {getOffice(b.id).name} · {getPerson(b.person)?.name ?? "空缺"}
                </button>
                <StateMarks marks={b.marks} />
                {b.project && (
                  <button
                    onClick={() => onTarget({ kind: "work", id: b.project })}
                  >
                    查看占用工程与调整安排
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {comparison && (
        <>
          <h3>执行前 → 执行后</h3>
          <div className="component-chain">
            {comparison.changed.map((c) => (
              <article key={c.id} className="board-highlight">
                <b>{getOffice(c.id).short}</b>
                <p>
                  {getPerson(c.before.person)?.name ?? "空缺"} →{" "}
                  {getPerson(c.after.person)?.name ?? "空缺"}
                </p>
                <StateMarks marks={c.after.marks} />
                <p className="met">新增可执行：{c.added.join("、") || "无"}</p>
                <p className="unmet">失去可执行：{c.lost.join("、") || "无"}</p>
              </article>
            ))}
          </div>
          {comparison.works.length > 0 && (
            <p>
              真实工程变化：
              {comparison.works
                .map(
                  (id) =>
                    game.machine.works.find((w) => w.id === id)?.type ??
                    "新开工",
                )
                .join("、")}
            </p>
          )}
          {comparison.goals.map((c) => (
            <p key={c.label}>
              {c.label}：{c.before ? "满足" : "未满足"} →{" "}
              {c.after ? "满足" : "未满足"}
            </p>
          ))}
          {comparison.pending && (
            <p>
              制度尚待第{comparison.pending.due}回合生效；这里不会提前授予权限。
            </p>
          )}
          <p>
            按当前资源与统一预览计算。行动命令及即时占用也会影响其他可执行项；不是永久能力保证。
          </p>
        </>
      )}
    </section>
  );
}
export function RuleReference() {
  return (
    <article className="rule-reference" aria-label="规则速查卡">
      <h2>联邦执政 · 一页速查</h2>
      <ol>
        {[
          [
            "看局面",
            "先看危机阶段、职位占用和下期维护，再选择本回合要解决的问题。",
          ],
          [
            "行政命令",
            "筹码就是顶部现有命令。逐项预览、确认、执行；取消免费，不要求每类各一次，结束回合独立推进。",
          ],
          [
            "人物与职位",
            "职位提供事权，人物提供专业。专职派遣保留职位但暂停行政；正式兼职须遵守原有空缺及容量限制。",
          ],
          [
            "财政账户",
            "中央、三省和宗门分账。先支出运作、施工及维护，再收税；拨款/上缴是转移，不创造财富。",
          ],
          [
            "工程构筑",
            "技术、主管、出资合同、维护责任、产权和收益端点分别检查。接管维护不会取得产权或自动修复故障。",
          ],
          [
            "事权与政策",
            "授权决定谁能参与，专业与政策决定能做什么。临时授权当回合到期，长期改革按生效回合实施。",
          ],
          [
            "危机推进",
            "阶段轨是现有结算规则的公开表示。遏制延缓、隔离停当地生产；升级按当前防护计算，不泄露未知随机事件。",
          ],
          [
            "国家目标",
            "八路线十六方向不变。看近期缺项；十二回合需第10～11回合演练，最终仍须正式验收并存活结算。",
          ],
          [
            "派系议程",
            "实际组织和合同产生要求。处理、拖延或拒绝都有明确后果，免职可能结束正式程序但不会抹掉历史利益。",
          ],
          [
            "保存与视图",
            "地图和桌面共享同一局势。视图/缩放是界面偏好；保存保留真实人员、合同、债务、课程、议程和随机序列。",
          ],
        ].map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
