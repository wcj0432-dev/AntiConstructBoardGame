import { facilityStatus, facilityStateNames } from "../v2/operations";
import { useState } from "react";
import { getPerson } from "../data";
import type { ProvinceId } from "../types";
import type { Action, FiscalAccount, TaxSystem, V2Game } from "../v2/model";
import { workSpecs } from "../v2/administration";
import {
  fundingLabels,
  nationalForecast,
  taxSystems,
  workFunding,
} from "../v2/fiscal";
import { ActionButton } from "./AdministrativeConsole";
import { EntityLink, SemanticText } from "./SemanticText";

/** The national ledger reads the same settlement forecast as the turn review. */
export function StateFinance({
  game,
  onChoose,
  onSelect,
}: {
  game: V2Game;
  onChoose: (action: Action) => void;
  onSelect: (province: ProvinceId) => void;
}) {
  const [selected, setSelected] = useState<ProvinceId>("south");
  const [amount, setAmount] = useState(2);
  const fiscal = game.machine.fiscal;
  if (!fiscal)
    return (
      <section className="document-card">
        <h3>旧战役财政规则</h3>
        <p>此存档沿用中央单账户结算；新战役提供中央与地方分账及联合出资。</p>
      </section>
    );

  const forecast = nationalForecast(game);
  const local = forecast.locals.find((row) => row.province === selected)!;
  const province = game.core.provinces.find((p) => p.id === selected)!;
  const system = taxSystems[fiscal.taxSystem];
  const selectProvince = (id: ProvinceId) => {
    setSelected(id);
    onSelect(id);
  };
  const accountName = (
    account: FiscalAccount | "joint" | "economy" | "public",
  ) =>
    account === "central"
      ? "中央财政"
      : account === "cult"
        ? "南岭宗门财库"
        : account === "joint"
          ? "中央—地方联合管理"
          : account === "economy"
            ? "地区经济税源"
            : account === "public"
              ? "行政与公共支出"
              : game.core.provinces.find((p) => p.id === account)?.name ||
                account;
  const selectedTransfers = fiscal.ledger.filter(
    (entry) =>
      entry.category === "transfer" &&
      (entry.from === selected || entry.to === selected),
  );
  const plannedLocalTransfers = forecast.entries
    .filter((entry) => entry.category === "transfer" && entry.to === selected)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="state-finance" data-testid="state-finance">
      <section className="document-card">
        <h3>国家财政 · 中央可支配资金</h3>
        <div className="finance-summary">
          <strong>中央余额 {forecast.current}</strong>
          <strong>预计收入 +{forecast.income}</strong>
          <strong>本期承诺 −{forecast.total}</strong>
          <strong>结算后 {forecast.next}</strong>
        </div>
        <p>
          <SemanticText
            tokens={[
              "财政与实物库存分账。",
              {
                type: "condition",
                text: "中央支出承诺",
                met: !forecast.default,
                reason: forecast.default
                  ? "现有中央余额不足以履行全部承诺；需调整融资或支出。"
                  : "现有中央余额可支付本期承诺。",
              },
            ]}
          />
        </p>
        <div
          className="v5-table-region"
          tabIndex={0}
          role="region"
          aria-label="中央收入与支出明细"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">来源或用途</th>
                <th scope="col">预计金额</th>
              </tr>
            </thead>
            <tbody>
              {forecast.sources.map((row, index) => (
                <tr key={`income-${index}`}>
                  <td>{row.label}</td>
                  <td>收入 +{row.amount}</td>
                </tr>
              ))}
              <tr>
                <td>中央机关日常运作</td>
                <td>支出 −{forecast.fixed}</td>
              </tr>
              {forecast.maintenanceSources.map((row, index) => (
                <tr key={`maintenance-${index}`}>
                  <td>{row.label}</td>
                  <td>支出 −{row.amount}</td>
                </tr>
              ))}
              <tr>
                <td>本期中央承担的工程施工</td>
                <td>支出 −{forecast.projectCosts}</td>
              </tr>
              <tr>
                <td>实际可支付总额</td>
                <td>
                  {forecast.paid} / {forecast.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="document-card">
        <h3>税收分配与省级账户</h3>
        <p>
          本期全国税源 {forecast.totalTax}；当前制度：
          <strong>{system.name}</strong>。
        </p>
        <p>{system.description}</p>
        <div
          className="v5-table-region"
          tabIndex={0}
          role="region"
          aria-label="各省财政收支预测"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">省份</th>
                <th scope="col">地方余额</th>
                <th scope="col">税源 → 中央 / 地方</th>
                <th scope="col">地方本期支出</th>
                <th scope="col">地方结算后</th>
              </tr>
            </thead>
            <tbody>
              {forecast.locals.map((row) => {
                const p = game.core.provinces.find(
                  (p) => p.id === row.province,
                )!;
                return (
                  <tr
                    key={row.province}
                    aria-selected={selected === row.province}
                  >
                    <td>
                      <EntityLink
                        entity={{ kind: "province", id: p.id, label: p.name }}
                        onEntityClick={() => selectProvince(p.id)}
                      />
                    </td>
                    <td>{row.current}</td>
                    <td>
                      {row.taxGross} = {row.centralShare} + {row.localShare}
                    </td>
                    <td>
                      {row.total}
                      {row.autoInvestment ? " + 自主投资3" : ""}
                      {row.default
                        ? " · 运作/维护欠付"
                        : row.paid < row.total
                          ? " · 工程付款不足"
                          : " · 可支付"}
                    </td>
                    <td>
                      {row.next}
                      {row.autoInvestment ? " · 自主建设" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="form-grid">
          {(Object.keys(taxSystems) as TaxSystem[]).map((id) => (
            <section key={id}>
              <h4>
                {taxSystems[id].name}
                {fiscal.taxSystem === id ? " · 现行制度" : ""}
              </h4>
              <p>{taxSystems[id].description}</p>
              <p>
                <SemanticText
                  tokens={[
                    {
                      type: "effect",
                      text: taxSystems[id].gain,
                      tone: "benefit",
                    },
                  ]}
                />
              </p>
              <p>
                <SemanticText
                  tokens={[
                    { type: "effect", text: taxSystems[id].loss, tone: "cost" },
                  ]}
                />
              </p>
              <ActionButton
                game={game}
                action={{ type: "fiscalReform", system: id }}
                label={`预览${taxSystems[id].name}`}
                onChoose={onChoose}
              />
            </section>
          ))}
        </div>
      </section>

      <section className="document-card" aria-label="选中省份财政">
        <h3>{province.name} · 财政与中央往来</h3>
        <p>
          地方财政 {local.current}；本期收入 {local.income}；实物库存{" "}
          {province.stock}。 本省税源 {local.taxGross} 分配中央{" "}
          {local.centralShare}、地方 {local.localShare}。
        </p>
        <p>
          地方日常运作 {local.operating} + 设施维护 {local.maintenance} +
          工程承诺 {local.projectCosts}； 总承诺 {local.total}，可支付{" "}
          {local.paid}，结算后余额 {local.next}。
        </p>
        <p>
          本期承诺外的资金往来：中央合作转移 +{plannedLocalTransfers}
          ；地方自主投资 −{local.autoInvestment ? 3 : 0}
          {local.autoInvestment ? "，另消耗1实物" : ""}
          。预期收入未到账前不能支付缺失的运作或施工款。
        </p>
        <p>
          <SemanticText
            tokens={[
              {
                type: "condition",
                text: "联合出资协议",
                met: fiscal.agreements.includes(selected),
              },
              "；地方自主建设：",
              fiscal.autonomous[selected] ? "已允许" : "未允许",
              "。",
            ]}
          />
        </p>
        <div className="form-grid">
          <label className="v2-field">
            财政转移金额
            <input
              type="number"
              min={1}
              max={5}
              step={1}
              aria-label="财政转移金额"
              value={amount}
              onChange={(event) =>
                setAmount(
                  Math.max(
                    1,
                    Math.min(5, Math.floor(Number(event.target.value) || 1)),
                  ),
                )
              }
            />
          </label>
        </div>
        <div className="quick-grid">
          <ActionButton
            game={game}
            action={{
              type: "fiscalTransfer",
              province: selected,
              direction: "grant",
              amount,
            }}
            label="预览中央专项拨款"
            onChoose={onChoose}
          />
          <ActionButton
            game={game}
            action={{
              type: "fiscalTransfer",
              province: selected,
              direction: "levy",
              amount,
            }}
            label="预览地方财政征调"
            onChoose={onChoose}
          />
          <ActionButton
            game={game}
            action={{ type: "fiscalAgreement", province: selected }}
            label="预览联合出资协议"
            onChoose={onChoose}
          />
          <ActionButton
            game={game}
            action={{
              type: "localAutonomy",
              province: selected,
              enabled: !fiscal.autonomous[selected],
            }}
            label={
              fiscal.autonomous[selected]
                ? "预览暂停地方自主建设"
                : "预览允许地方自主建设"
            }
            onChoose={onChoose}
          />
        </div>
        <p>
          已记录资金往来：中央拨入{" "}
          {selectedTransfers
            .filter(
              (entry) => entry.from === "central" && entry.to === selected,
            )
            .reduce((sum, entry) => sum + entry.amount, 0)}
          ； 本省上缴{" "}
          {selectedTransfers
            .filter(
              (entry) => entry.from === selected && entry.to === "central",
            )
            .reduce((sum, entry) => sum + entry.amount, 0)}
          。 转移只改变两个账户的余额，具体权限与政治条件在预览中核对。
        </p>
      </section>

      <section className="document-card">
        <h3>工程出资与管理权</h3>
        <p>
          工程投资、施工和设施维护依约支付；专业资格与各出资方余额共同决定能否推进。
        </p>
        {game.machine.works.length === 0 ? (
          <p>尚未立项工程。</p>
        ) : (
          <div
            className="v5-table-region"
            tabIndex={0}
            role="region"
            aria-label="工程出资与产权明细"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">项目 / 状态</th>
                  <th scope="col">投资安排</th>
                  <th scope="col">出资方与权重</th>
                  <th scope="col">管理与受益地区</th>
                  <th scope="col">负责人 / 持续支出</th>
                </tr>
              </thead>
              <tbody>
                {game.machine.works.map((work) => {
                  const contract = workFunding(game, work);
                  const spec = workSpecs[work.type];
                  const p = game.core.provinces.find(
                    (p) => p.id === work.province,
                  )!;
                  const recipient =
                    contract.beneficiary &&
                    game.core.provinces.find(
                      (p) => p.id === contract.beneficiary,
                    );
                  return (
                    <tr key={work.id}>
                      <td>
                        <EntityLink
                          entity={{ kind: "province", id: p.id, label: p.name }}
                          onEntityClick={() => selectProvince(p.id)}
                        />
                        <p>{spec.name}</p>
                        <p>
                          {work.cancelled
                            ? "已取消"
                            : work.completed
                              ? facilityStateNames[
                                  facilityStatus(game, work).state
                                ]
                              : work.paused
                                ? "暂停施工"
                                : `${work.progress}/${work.duration} 施工中`}
                        </p>
                        {work.network && (
                          <p>
                            {facilityStatus(game, work).state !== "operating"
                              ? facilityStatus(game, work).reason
                              : work.network.active
                                ? "能源联系运行"
                                : "能源联系关闭"}
                          </p>
                        )}
                      </td>
                      <td>{fundingLabels[contract.mode]}</td>
                      <td>
                        {contract.shares.map((share) => (
                          <p key={share.account}>
                            {accountName(share.account)}：{share.weight}
                          </p>
                        ))}
                      </td>
                      <td>
                        <p>{accountName(contract.owner)}</p>
                        {recipient && (
                          <EntityLink
                            entity={{
                              kind: "province",
                              id: recipient.id,
                              label: `供能受益：${recipient.name}`,
                            }}
                            onEntityClick={() => selectProvince(recipient.id)}
                          />
                        )}
                      </td>
                      <td>
                        <p>{getPerson(work.worker)?.name || "机构统筹"}</p>
                        <p>常规施工每期 1；竣工维护每期 {spec.maintenance}。</p>
                        {!work.completed && !work.cancelled && (
                          <p>
                            {forecast.constructionFunded.includes(work.id)
                              ? "本期资格与各方资金已满足"
                              : "本期未满足施工条件，请查看工程预览"}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p>
          宗门可支配财库 {fiscal.cultTreasury}
          ；融资协议保留真实产权，中央命令须遵守管理权限。
        </p>
      </section>

      <details className="document-card">
        <summary>
          调阅统一账本 · 最近 40 笔 / 共 {fiscal.ledger.length} 笔
        </summary>
        <div
          className="v5-table-region"
          tabIndex={0}
          role="region"
          aria-label="国家财政统一账本"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">回合</th>
                <th scope="col">来源 → 去向</th>
                <th scope="col">金额</th>
                <th scope="col">原因</th>
              </tr>
            </thead>
            <tbody>
              {fiscal.ledger.slice(0, 40).map((entry) => {
                const cause = game.machine.history.find(
                  (item) => item.id === entry.source,
                );
                return (
                  <tr key={entry.id}>
                    <td>{entry.turn}</td>
                    <td>
                      {accountName(entry.from)} → {accountName(entry.to)}
                    </td>
                    <td>{entry.amount}</td>
                    <td>
                      {entry.reason}
                      {cause && (
                        <p>
                          依据：第{cause.turn}回合 · {cause.title}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {fiscal.ledger.length === 0 && (
                <tr>
                  <td colSpan={4}>尚无已执行收支；预测会在实际结算后入账。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
