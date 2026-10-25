import {
  agendaTitles,
  agendaDescription,
  agendaStanding,
} from "../v2/factionAgendas";
import type { Action, V2Game } from "../v2/model";
import { getPerson, getOffice } from "../data";
import { previewAction } from "../v2/engine";
import { ActionButton } from "./AdministrativeConsole";
import { PersonStateMarks } from "./StateMarks";
import type { BoardTarget } from "../v2/governance";
export function FactionAgendaDetails({
  game,
  id,
  onChoose,
  onTarget,
}: {
  game: V2Game;
  id: string;
  onChoose: (a: Action) => void;
  onTarget: (t: BoardTarget) => void;
}) {
  const a = game.machine.agendas?.items.find((a) => a.id === id);
  if (!a)
    return (
      <section aria-label="派系议程档案">
        <h2>派系公开议程与结案记录</h2>
        {game.machine.agendas?.items.length ? (
          game.machine.agendas.items.map((item) => (
            <article key={item.id} className="board-card faction-agenda-card">
              <h3>{agendaTitles[item.kind]}</h3>
              <p>{agendaDescription(game, item)}</p>
              <p>
                {item.state === "active" ? "仍待审议" : "已结案，保留实际来源"}
              </p>
              <button
                onClick={() =>
                  onTarget({
                    kind: "agenda",
                    id: item.id,
                    province: item.province,
                  })
                }
              >
                调阅这项议程
              </button>
            </article>
          ))
        ) : (
          <p>目前没有由真实工程或维护变更触发的议程。</p>
        )}
      </section>
    );
  return (
    <section className="faction-agenda-details" aria-label="派系议程详情">
      <h2>{agendaTitles[a.kind]}</h2>
      <p>{agendaDescription(game, a)}</p>
      <p>{agendaStanding(game, a).reason}</p>
      <PersonStateMarks game={game} person={agendaStanding(game, a).holder} />
      <p>
        真实来源：{a.source}，触发操作{a.trigger}。当前状态：
        {
          {
            active: "待审议",
            accepted: "已接受",
            negotiated: "已协商",
            rejected: "已拒绝",
            expired: "已到期",
            superseded: "实际安排已取代",
          }[a.state]
        }
        。
      </p>
      <p className="unmet">
        到期未处理：{getPerson(a.issuer)?.name}
        积怨+1，仅一次。免职不会清除积怨或历史利益；当前正式谈判资格仍由实际职位决定。
      </p>
      <div className="quick-grid">
        <button onClick={() => onTarget({ kind: "office", id: a.office })}>
          定位{getOffice(a.office).name}
        </button>
        <button
          onClick={() =>
            onTarget({ kind: "work", id: a.work, province: a.province })
          }
        >
          查看相关工程与合同
        </button>
      </div>
      {a.state === "active" &&
        (["accept", "negotiate", "delay", "reject"] as const).map((choice) => {
          const action: Action = { type: "agendaDecision", agenda: id, choice },
            p = previewAction(game, action);
          return (
            <article className="board-card faction-agenda-card" key={choice}>
              <h3>
                {
                  {
                    accept: "接受",
                    negotiate: "谈判",
                    delay: "拖延一次",
                    reject: "拒绝",
                  }[choice]
                }
              </h3>
              {p.effects.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
              <p className={p.errors.length ? "unmet" : "met"}>
                {p.errors.join("；") || "当前条件具备，点击预览后确认"}
              </p>
              <ActionButton
                game={game}
                action={action}
                label={`预览${{ accept: "接受议程", negotiate: "谈判议程", delay: "延期议程", reject: "拒绝议程" }[choice]}`}
                onChoose={onChoose}
              />
            </article>
          );
        })}
    </section>
  );
}
