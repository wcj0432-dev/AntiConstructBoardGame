import { workSpecs } from "../v2/administration";
import { PanelFrame } from "./PanelFrame";
import { finance, duration } from "../v2/engine";
import type { V2Game, V2Preview } from "../v2/model";
export function TurnReview({
  game,
  preview,
  onClose,
  onConfirm,
}: {
  game: V2Game;
  preview: V2Preview;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const s = game.core,
    m = game.machine,
    f = finance(game);
  const crises = m.matters.filter((x) =>
    ["accident", "oldgod", "supply", "distrust"].includes(x.kind),
  );
  return (
    <PanelFrame
      title="回合结算 · 推进时间"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>返回指挥席</button>
          <button
            className="v2-primary advance-confirm"
            disabled={preview.errors.length > 0}
            onClick={onConfirm}
          >
            确认推进
          </button>
        </>
      }
    >
      <h2>
        第{s.turn}回合 →{" "}
        {s.turn < duration(game) ? `第${s.turn + 1}回合` : "任期结束"}
      </h2>
      <p>剩余 {s.commands} 条行政命令会正常作废，无须全部使用。</p>
      <div className="turn-review">
        <section>
          <h3>财政与施工承诺</h3>
          <p>
            先支付 {f.total}：固定 {f.fixed} / 维护 {f.maintenance} / 施工{" "}
            {f.projectCosts}；再收入 {f.income}。
          </p>
          <p>
            财政 {s.treasury} → {f.next}。
            {f.default
              ? "无法履行本期承诺，连续两次违约会失败。"
              : "本期承诺可履行。"}
          </p>
        </section>
        <section>
          <h3>重要危机</h3>
          {crises.map((x) => (
            <p key={x.id}>
              {x.title} ·{" "}
              {x.isolated
                ? "持续隔离，本地停产"
                : x.containment > 0
                  ? "本次结算受控，之后需重新处理"
                  : "本次结算将恶化"}
            </p>
          ))}
          {crises.length === 0 && <p>暂无持续危机。</p>}
        </section>
        <section>
          <h3>项目与权限到期</h3>
          {m.works
            .filter((w) => !w.completed && !w.cancelled)
            .map((w) => (
              <p key={w.id}>
                {s.provinces.find((p) => p.id === w.province)!.name} ·{" "}
                {workSpecs[w.type].name} {w.progress}/{w.duration} ·{" "}
                {w.paused ? "暂停" : "按人员资格与财政承诺结算"}
              </p>
            ))}
          <p>
            {Object.keys(m.authorization).length}{" "}
            项临时事务授权在本次结算后失效。
          </p>
        </section>
        <section>
          <h3>下一阶段预警</h3>
          <p>
            {s.turn === 1
              ? "国家规划会议开放；南岭事故风险进入处置阶段。"
              : s.turn === 3
                ? "北境旧神危机进入处置阶段。"
                : m.mode === "experimental" && s.turn === 9
                  ? "进入终局准备，第10～11回合可组织全国演练。"
                  : s.turn === duration(game) - 1
                    ? "进入最后回合，检查并实际执行国家目标终局。"
                    : "工程继续结算、改革按期生效，待办按接纳名额进入事务队列。"}
          </p>
          {preview.errors.map((x) => (
            <p className="danger" key={x}>
              {x}
            </p>
          ))}
        </section>
      </div>
    </PanelFrame>
  );
}
