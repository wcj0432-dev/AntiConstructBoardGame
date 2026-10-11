import type { Action, FiscalAccount, V2Game } from "../v2/model";
import { facilityStateNames, facilityStatus } from "../v2/operations";
import { nationalForecast, accountLabel } from "../v2/fiscal";
import { workSpecs } from "../v2/administration";
import { ActionButton } from "./AdministrativeConsole";
export function FacilityOperations({
  game,
  onChoose,
  province,
}: {
  game: V2Game;
  onChoose: (a: Action) => void;
  province?: string;
}) {
  const forecast = nationalForecast(game);
  return (
    <section aria-label="逐设施维护与运营" className="facility-operations">
      <h3>逐设施维护与运营</h3>
      <p>
        先履行维护，再经营收税；欠款按责任账户结转。补缴不追溯补发收益，接管维护不改变产权。
      </p>
      {game.machine.works
        .filter((w) => !province || w.province === province)
        .map((w) => {
          const state = facilityStatus(game, w),
            current = w.maintenance,
            next = forecast.facilities.find(
              (x) => x.work === w.id,
            )?.maintenance;
          return (
            <article
              key={w.id}
              className={`document-card facility-${state.state}`}
              data-facility-id={w.id}
            >
              <h4>
                {workSpecs[w.type].name} · {accountLabel(game, w.province)}
                {w.to && ` → ${accountLabel(game, w.to)}`}
              </h4>
              <strong className={state.state === "operating" ? "met" : "unmet"}>
                {facilityStateNames[state.state]}
              </strong>
              <p>{state.reason}</p>
              <p>
                上次成功履约：
                {current?.lastPaidTurn !== undefined
                  ? `第${current.lastPaidTurn}回合`
                  : "尚无完整付款记录"}
              </p>
              <p>
                基本维护 {workSpecs[w.type].maintenance}/期 · 已核对第
                {current && current.turn >= 0 ? current.turn : "未结算"}期：应付
                {current?.due ?? 0}、实付{current?.paid ?? 0}、欠付
                {current?.arrears ?? 0}
              </p>
              {current?.payments.map((p, i) => (
                <p key={i}>
                  责任方：{accountLabel(game, p.account)} · 应付{p.due} / 实付
                  {p.paid} / 欠付{p.arrears}
                </p>
              ))}
              {next?.payments.map((p, i) => (
                <p key={`next-${i}`}>
                  下期责任：{accountLabel(game, p.account)}应付{p.due}
                  （含本方往期欠款）
                </p>
              ))}
              {next && (
                <p className={next.arrears ? "unmet" : "met"}>
                  下期预警：应付{next.due}，预计实付{next.paid}，预计欠付
                  {next.arrears}
                  {next.arrears > 0 && "；将停止营业、生产、网络或教学能力"}
                </p>
              )}
              {w.completed && workSpecs[w.type].maintenance > 0 && (
                <>
                  <ActionButton
                    game={game}
                    action={{ type: "maintain", work: w.id }}
                    onChoose={onChoose}
                    label="预览补足维护"
                  />
                  <details>
                    <summary>协商维护接管（保留原产权）</summary>
                    <div className="quick-grid">
                      {(["central", w.province, "cult"] as FiscalAccount[]).map(
                        (account) => (
                          <ActionButton
                            key={account}
                            game={game}
                            action={{
                              type: "maintenanceSponsor",
                              work: w.id,
                              account,
                            }}
                            onChoose={onChoose}
                            label={`${accountLabel(game, account)}承担维护`}
                          />
                        ),
                      )}
                    </div>
                  </details>
                </>
              )}
            </article>
          );
        })}
      {!game.machine.works.length && (
        <p>尚无工程；每项竣工设施将分别核对责任账户与维护付款。</p>
      )}
    </section>
  );
}
