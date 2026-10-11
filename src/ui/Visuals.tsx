import { getPerson, factionNames } from "../data";
import type { Matter } from "../v2/model";
import { EventArtV5, PortraitV5 } from "./art/V5Art";
export function PersonBadge({ id }: { id: string }) {
  const p = getPerson(id);
  if (!p) return null;
  return (
    <span
      className={`person-badge ${p.faction}`}
      aria-label={`${p.name} · ${factionNames[p.faction]}`}
    >
      <PortraitV5 id={p.id} name={p.name} />
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
  return <EventArtV5 kind={kind} />;
}
