import { getPerson, factionNames } from "../data";
import type { Matter } from "../v2/model";
export function PersonBadge({ id }: { id: string }) {
  const p = getPerson(id);
  if (!p) return null;
  return (
    <span
      className={`person-badge ${p.faction}`}
      aria-label={`${p.name} · ${factionNames[p.faction]}`}
    >
      <svg viewBox="0 0 64 64" role="img" aria-label={`${p.name}档案头像`}>
        <path d="M1 1H63V63H1Z" fill="currentColor" opacity=".16" />
        <path d="M11 60Q11 39 32 39Q53 39 53 60" fill="currentColor" />
        <path d="M18 25Q16 9 32 9Q50 10 46 30L42 40H23Z" fill="currentColor" />
        <path d="M23 23L43 21 42 34Q32 44 24 34Z" fill="#d1c39f" />
        <path
          d="M27 27H29M36 27H38M29 34H35"
          stroke="#233c40"
          strokeWidth="2"
        />
      </svg>
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
  const occult = ["oldgod", "accident"].includes(kind);
  return (
    <svg
      className={`event-art ${occult ? "occult" : "industrial"}`}
      viewBox="0 0 340 100"
      role="img"
      aria-label={occult ? "异常危机档案示意图" : "联邦行政档案示意图"}
    >
      <defs>
        <pattern
          id={`art-grid-${kind}`}
          width="17"
          height="17"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M17 0H0V17"
            stroke="currentColor"
            opacity=".12"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="340" height="100" fill={`url(#art-grid-${kind})`} />
      {occult ? (
        <g fill="none" stroke="currentColor">
          <circle cx="170" cy="50" r="36" />
          <path d="M100 50Q170 0 240 50Q170 100 100 50Z" strokeWidth="3" />
          <circle cx="170" cy="50" r="12" fill="currentColor" />
          <path d="M30 25L75 75M265 75L310 25M170 5V95" strokeDasharray="3 6" />
        </g>
      ) : (
        <g stroke="currentColor" fill="none">
          <path
            d="M44 79V40L92 56V32L138 52V27H173V79M60 78V58M92 78V58M133 78V58M200 79V28H281V79ZM213 41H269M213 52H269M213 63H250"
            strokeWidth="3"
          />
          <path d="M20 86H320" />
        </g>
      )}
      <text x="12" y="16" fill="currentColor" fontSize="10">
        FEDERAL ARCHIVE / {occult ? "CLASSIFIED" : "CIVIL AFFAIRS"}
      </text>
    </svg>
  );
}
