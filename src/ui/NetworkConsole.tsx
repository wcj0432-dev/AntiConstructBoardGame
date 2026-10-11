import type { Action, V2Game } from "../v2/model";
import { accountLabel, fundingLabels, workFunding } from "../v2/fiscal";
import { networkRelations } from "../v2/networks";
import { ActionButton } from "./AdministrativeConsole";
import {
  RelatedNetwork,
  SemanticText,
  type EntityClickHandler,
} from "./SemanticText";
export function NetworkConsole({
  game,
  workId,
  onChoose,
  onEntityClick,
  onHistory,
}: {
  game: V2Game;
  workId?: string;
  onChoose: (a: Action) => void;
  onEntityClick?: EntityClickHandler;
  onHistory?: (id: string) => void;
}) {
  const works = game.machine.works.filter(
    (w) => w.type === "grid" && !w.cancelled && (!workId || w.id === workId),
  );
  return (
    <section className="network-console" aria-label="能源依赖与管理合同">
      <h3>能源依赖与管理合同</h3>
      <details>
        <summary>交通—工业设备—北境防线</summary>
        <p>
          铁路与江湖调运需要工业设备、实际供能及在任组织；地方库存是应急备用，三条路径赋予不同管理权。
        </p>
        <div className="quick-grid">
          {(["rail", "jianghu", "local"] as const).map((route) => (
            <ActionButton
              key={route}
              game={game}
              action={{ type: "borderSupply", route }}
              onChoose={onChoose}
              label={
                {
                  rail: "铁路输送工业防线设备",
                  jianghu: "江湖联运北境设备",
                  local: "启用北境地方设备储备",
                }[route]
              }
            />
          ))}
        </div>
      </details>
      {!works.length && (
        <p>
          从南岭的经济投资中选择“跨省灵能电网”。先组织勘探、技术标准、合作及融资，工程完成后才产生实际供能关系。
        </p>
      )}
      {works.map((w) => {
        const relation = networkRelations(game, w),
          contract = workFunding(game, w);
        return (
          <article className="document-card" key={w.id} data-network-id={w.id}>
            <h4>
              南岭 → 中央工业省 ·{" "}
              {w.completed ? "已竣工" : `施工 ${w.progress}/${w.duration}`}
            </h4>
            <SemanticText
              tokens={[
                {
                  type: "condition",
                  text: "实际供能",
                  met: relation.operating,
                  reason: relation.operating
                    ? "工业省产出与常规税源+2"
                    : "施工、停机、故障或源头危机关闭额外产出与税源",
                },
                " ",
                {
                  type: "permission",
                  text: "中央应急管理权",
                  met: relation.currentAuthority,
                },
              ]}
            />
            <p>
              {fundingLabels[contract.mode]}；经营管理者：
              {contract.owner === "joint"
                ? "中央与地方共同管理"
                : accountLabel(game, contract.owner)}
              。经营收入只有1，由合同轮转分配，不能让每个出资方重复领取。
            </p>
            <p>
              负责人：{relation.workerName}；正式职位：
              {relation.workerOffice || "当前无正式职位"}
              。建设专职任务不等于竣工后拥有行政维修权。
            </p>
            <RelatedNetwork
              title="真实供能与组织关系"
              nodes={[
                { kind: "province", id: "south", label: "南岭修仙省" },
                { kind: "province", id: "industry", label: "中央工业省" },
                { kind: "office", id: "plan", label: "中央计划委员会" },
                ...(w.worker
                  ? [
                      {
                        kind: "person" as const,
                        id: w.worker,
                        label: relation.workerName,
                      },
                    ]
                  : []),
              ]}
              relations={[
                {
                  from: "south",
                  to: "industry",
                  label: "供能：工业产出与税源+2",
                  status: relation.operating ? "active" : "blocked",
                  reason: relation.operating
                    ? "地区常规税源再按税制分配"
                    : "故障、停机或源头失控时收益停止",
                },
                {
                  from: "plan",
                  to: "south",
                  label: "融资及应急管理",
                  status: relation.currentAuthority ? "active" : "blocked",
                  reason: relation.currentAuthority
                    ? "实际合同和人员满足审批"
                    : "地方/宗门管理者须先同意；中央资金不自动取得产权",
                },
              ]}
              onEntityClick={onEntityClick}
            />
            {w.completed && (
              <div className="quick-grid">
                {(["consent", "close", "repair", "reopen"] as const).map(
                  (operation) => (
                    <ActionButton
                      key={operation}
                      game={game}
                      action={{ type: "network", work: w.id, operation }}
                      onChoose={onChoose}
                      label={
                        {
                          consent: "协商运营者应急授权",
                          close: "中央停机决定",
                          repair: "组织实际电网维修",
                          reopen: "恢复跨省供能",
                        }[operation]
                      }
                    />
                  ),
                )}
              </div>
            )}
            {onHistory && (
              <button
                className="text-button"
                onClick={() => onHistory(w.source)}
              >
                查看实际投资与产权来源
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
