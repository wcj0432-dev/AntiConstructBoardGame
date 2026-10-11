import type { ReactNode } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Coins,
  Command,
  Factory,
  Landmark,
  LockKeyhole,
  MapPin,
  Package,
  Sparkles,
  Timer,
  TriangleAlert,
  UnlockKeyhole,
  UserRound,
  XCircle,
} from "lucide-react";

export type EntityKind =
  "person" | "office" | "province" | "matter" | "project";
export interface EntityReference {
  kind: EntityKind;
  id: string;
  label: string;
}
export type EntityClickHandler = (entity: EntityReference) => void;
export type ResourceKind = "command" | "treasury" | "capital" | "stock";
export interface SemanticCost {
  resource: ResourceKind;
  amount: number;
  available?: number;
  label?: string;
}
export type SemanticToken =
  | { type: "text"; text: string }
  | { type: "entity"; entity: EntityReference; detail?: string }
  | ({ type: "cost" } & SemanticCost)
  | { type: "capability" | "permission"; text: string; met?: boolean }
  | { type: "condition"; text: string; met: boolean; reason?: string }
  | {
      type: "effect";
      text: string;
      tone?: "benefit" | "cost" | "neutral";
      unlock?: boolean;
    }
  | { type: "deadline"; text: string; urgent?: boolean };
export interface SemanticCondition {
  id?: string;
  label: string;
  met: boolean;
  reason?: string;
  remedy?: readonly (string | SemanticToken)[];
}

const resources = {
  command: { name: "行政命令", Icon: Command },
  treasury: { name: "财政", Icon: Coins },
  capital: { name: "政治资本", Icon: Landmark },
  stock: { name: "物资", Icon: Package },
} as const;
const entities = {
  person: UserRound,
  office: Landmark,
  province: MapPin,
  matter: CircleHelp,
  project: Factory,
} as const;

/** Data tokens only: no HTML parsing and no independent copy of game state. */
export function EntityLink({
  entity,
  onEntityClick,
  detail,
}: {
  entity: EntityReference;
  onEntityClick?: EntityClickHandler;
  detail?: string;
}) {
  const Icon = entities[entity.kind];
  const content = (
    <>
      <Icon aria-hidden="true" />
      <span>{entity.label}</span>
    </>
  );
  return onEntityClick ? (
    <button
      type="button"
      className={`semantic-entity semantic-${entity.kind}`}
      onClick={() => onEntityClick(entity)}
      title={detail || `调阅${entity.label}`}
      aria-label={`调阅${entity.label}`}
      data-entity-kind={entity.kind}
      data-entity-id={entity.id}
    >
      {content}
    </button>
  ) : (
    <span className={`semantic-entity semantic-${entity.kind}`} title={detail}>
      {content}
    </span>
  );
}

function CostToken({ cost }: { cost: SemanticCost }) {
  const { name, Icon } = resources[cost.resource];
  const shortage = cost.available !== undefined && cost.available < cost.amount;
  return (
    <span className={`semantic-cost ${shortage ? "is-short" : ""}`}>
      <Icon aria-hidden="true" />
      <span>
        <b>{cost.amount}</b> {cost.label || name}
        {shortage && <strong className="semantic-shortage"> · 不足</strong>}
      </span>
    </span>
  );
}

function Token({
  token,
  onEntityClick,
}: {
  token: SemanticToken;
  onEntityClick?: EntityClickHandler;
}): ReactNode {
  if (token.type === "text") return token.text;
  if (token.type === "entity")
    return <EntityLink {...token} onEntityClick={onEntityClick} />;
  if (token.type === "cost") return <CostToken cost={token} />;
  if (token.type === "capability" || token.type === "permission") {
    const Icon = token.type === "capability" ? Sparkles : LockKeyhole;
    return (
      <span
        className={`semantic-requirement semantic-${token.type} ${token.met === undefined ? "" : token.met ? "is-met" : "is-unmet"}`}
      >
        <Icon aria-hidden="true" />
        <span>{token.text}</span>
        {token.met !== undefined && (
          <span className="semantic-status">
            {token.met ? "已具备" : "未满足"}
          </span>
        )}
      </span>
    );
  }
  if (token.type === "condition")
    return (
      <span
        className={`semantic-condition-token ${token.met ? "is-met" : "is-unmet"}`}
        title={token.reason}
      >
        {token.met ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <XCircle aria-hidden="true" />
        )}
        <span>{token.text}</span>
        <span className="semantic-status">
          {token.met ? "已满足" : "未满足"}
        </span>
      </span>
    );
  if (token.type === "effect")
    return (
      <span className={`semantic-effect effect-${token.tone || "neutral"}`}>
        {token.unlock && <UnlockKeyhole aria-hidden="true" />}
        {token.unlock && <b>解锁 · </b>}
        {token.tone === "cost" && <TriangleAlert aria-hidden="true" />}
        <span>{token.text}</span>
      </span>
    );
  if (token.type === "deadline")
    return (
      <span className={`semantic-deadline ${token.urgent ? "is-urgent" : ""}`}>
        <Timer aria-hidden="true" />
        {token.urgent && <strong className="semantic-status">紧急</strong>}
        <span>{token.text}</span>
      </span>
    );
  return null;
}

/** Prefer short highlights embedded in otherwise ordinary prose. */
export function SemanticText({
  tokens,
  onEntityClick,
  className = "",
}: {
  tokens: readonly (string | SemanticToken)[];
  onEntityClick?: EntityClickHandler;
  className?: string;
}) {
  return (
    <span className={`semantic-text ${className}`}>
      {tokens.map((token, index) =>
        typeof token === "string" ? (
          token
        ) : (
          <Token key={index} token={token} onEntityClick={onEntityClick} />
        ),
      )}
    </span>
  );
}

export function ConditionsList({
  conditions,
  title = "执行条件",
  onEntityClick,
  className = "",
}: {
  conditions: readonly SemanticCondition[];
  title?: string;
  onEntityClick?: EntityClickHandler;
  className?: string;
}) {
  if (!conditions.length) return null;
  return (
    <section className={`semantic-conditions ${className}`} aria-label={title}>
      <h4>{title}</h4>
      <ul>
        {conditions.map((condition, index) => (
          <li
            key={condition.id || index}
            className={condition.met ? "is-met" : "is-unmet"}
          >
            {condition.met ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <XCircle aria-hidden="true" />
            )}
            <div>
              <p>
                <strong>{condition.met ? "已满足" : "未满足"}</strong>
                <span>{condition.label}</span>
              </p>
              {condition.reason && (
                <p className="condition-reason">{condition.reason}</p>
              )}
              {!condition.met && condition.remedy?.length ? (
                <p className="condition-remedy">
                  <b>解决方式：</b>
                  <SemanticText
                    tokens={condition.remedy}
                    onEntityClick={onEntityClick}
                  />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CostSummary({
  costs,
  title = "确认后消耗",
  className = "",
}: {
  costs: readonly SemanticCost[];
  title?: string;
  className?: string;
}) {
  return (
    <section
      className={`semantic-cost-summary ${className}`}
      aria-label={title}
    >
      <h4>{title}</h4>
      <ul>
        {costs.map((cost, index) => (
          <li key={`${cost.resource}-${index}`}>
            <CostToken cost={cost} />
            {cost.available !== undefined && (
              <span className="semantic-available">可用 {cost.available}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface RelatedRelation {
  from: string;
  to: string;
  label: string;
  status?: "active" | "blocked" | "pending";
  reason?: string;
}

/** A compact accessible relationship view: edges are explicit, never inferred. */
export function RelatedNetwork({
  nodes,
  relations,
  onEntityClick,
  title = "相关组织与对象",
}: {
  nodes: readonly EntityReference[];
  relations: readonly RelatedRelation[];
  onEntityClick?: EntityClickHandler;
  title?: string;
}) {
  const names = new Map(nodes.map((node) => [node.id, node.label]));
  return (
    <section className="semantic-network" aria-label={title}>
      <h4>{title}</h4>
      <div className="semantic-network-nodes">
        {nodes.map((node) => (
          <EntityLink
            key={`${node.kind}-${node.id}`}
            entity={node}
            onEntityClick={onEntityClick}
          />
        ))}
      </div>
      {relations.length ? (
        <ul className="semantic-relations">
          {relations.map((relation, index) => (
            <li
              key={`${relation.from}-${relation.to}-${index}`}
              className={relation.status || ""}
            >
              <span>{names.get(relation.from) || relation.from}</span>
              <span className="relation-arrow" aria-hidden="true">
                →
              </span>
              <span>{names.get(relation.to) || relation.to}</span>
              <strong>
                {relation.status === "blocked"
                  ? "受阻 · "
                  : relation.status === "pending"
                    ? "待生效 · "
                    : relation.status === "active"
                      ? "已生效 · "
                      : ""}
                {relation.label}
              </strong>
              {relation.reason && <small>{relation.reason}</small>}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
