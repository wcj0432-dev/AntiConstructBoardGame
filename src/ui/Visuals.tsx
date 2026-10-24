import { PortraitV7 } from "./art/V7Art";
import { getPerson, factionNames } from "../data";
import type { Matter } from "../v2/model";
import { EventArtV5 } from "./art/V5Art";
export function PersonBadge({ id }: { id: string }) {
  const p = getPerson(id);
  if (!p) return null;
  return (
    <span
      className={`person-badge ${p.faction}`}
      aria-label={`${p.name} · ${factionNames[p.faction]}`}
    >
      <PortraitV7 id={p.id} name={p.name} />
      <span>
        <b>{p.name}</b>
        <small>
          {p.title} · {factionNames[p.faction]}
        </small>
      </span>
    </span>
  );
}
export function EventArt({ kind }: { kind: Matter["kind"] }) {
  const category = ["oldgod", "energyFault", "accident", "final"].includes(kind)
    ? "crisis"
    : ["gazette", "distrust", "fiscalClaim"].includes(kind)
      ? "political"
      : "administrative";
  return (
    <div className={`v7-event-art ${category}`}>
      <span className="event-document-stamp">
        {category === "crisis"
          ? "国家紧急通告"
          : category === "political"
            ? "联席会议记录"
            : "行政文书"}
      </span>
      <EventArtV5 kind={kind} />
    </div>
  );
}
