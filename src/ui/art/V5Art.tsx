import { useId } from "react";
import { getPerson } from "../../data";
import type { ProvinceId } from "../../types";

type Hair =
  "short" | "swept" | "bob" | "long" | "bun" | "braid" | "topknot" | "wave";
type Attire =
  | "engineer"
  | "civil"
  | "uniform"
  | "robe"
  | "magical"
  | "worker"
  | "scholar"
  | "courier";
type Accessory =
  | "none"
  | "glasses"
  | "goggles"
  | "cap"
  | "star"
  | "beard"
  | "headset"
  | "monocle";
interface PortraitProfile {
  hair: Hair;
  attire: Attire;
  accessory: Accessory;
  hairColor: string;
  coat: string;
  accent: string;
  skin: string;
  emblem: "gear" | "star" | "shield" | "rune" | "book" | "leaf";
}

const profile = (
  hair: Hair,
  attire: Attire,
  accessory: Accessory,
  hairColor: string,
  coat: string,
  accent: string,
  skin = "#d9b69a",
  emblem: PortraitProfile["emblem"] = "gear",
): PortraitProfile => ({
  hair,
  attire,
  accessory,
  hairColor,
  coat,
  accent,
  skin,
  emblem,
});

/** Original vector archive portraits. Every roster id has an intentional profile. */
export const portraitProfiles: Record<string, PortraitProfile> = {
  lin: profile("swept", "engineer", "glasses", "#c0bab0", "#455b63", "#d8ba75"),
  lu: profile(
    "short",
    "uniform",
    "cap",
    "#352d2b",
    "#46514e",
    "#d0ba88",
    "#c79f83",
    "shield",
  ),
  sergei: profile(
    "wave",
    "scholar",
    "monocle",
    "#c7c9c2",
    "#414354",
    "#c0b0d5",
    "#e4c4aa",
    "book",
  ),
  zhou: profile(
    "swept",
    "civil",
    "none",
    "#3e332d",
    "#5c5e53",
    "#ddc793",
    "#cfab8d",
    "star",
  ),
  bai: profile(
    "long",
    "robe",
    "none",
    "#d6d3bc",
    "#66705e",
    "#d3d9a4",
    "#e8c5a6",
    "rune",
  ),
  ye: profile(
    "bob",
    "courier",
    "none",
    "#52392c",
    "#42676a",
    "#d2c090",
    "#ccad8d",
    "leaf",
  ),
  xing: profile(
    "braid",
    "magical",
    "star",
    "#283e58",
    "#54758a",
    "#e2acc2",
    "#e8c4ae",
    "star",
  ),
  mo: profile(
    "topknot",
    "robe",
    "glasses",
    "#34383c",
    "#41636a",
    "#c9a663",
    "#c5a487",
    "rune",
  ),
  qi: profile(
    "bob",
    "scholar",
    "headset",
    "#373248",
    "#575266",
    "#c8b1db",
    "#dab39c",
    "book",
  ),
  han: profile(
    "short",
    "engineer",
    "goggles",
    "#504b45",
    "#555a50",
    "#d0aa69",
    "#b58e71",
    "shield",
  ),
  tang: profile(
    "bun",
    "worker",
    "none",
    "#533b2e",
    "#597a63",
    "#d8bd85",
    "#d2ae8b",
    "leaf",
  ),
  wen: profile(
    "wave",
    "civil",
    "glasses",
    "#695347",
    "#5b6672",
    "#d6c296",
    "#dabb9e",
    "book",
  ),
  linruoxu: profile(
    "long",
    "engineer",
    "monocle",
    "#9faeb5",
    "#405c72",
    "#9fd7d6",
    "#d4af99",
    "rune",
  ),
  chenjiliang: profile(
    "short",
    "civil",
    "glasses",
    "#4e4740",
    "#596450",
    "#e0c884",
    "#caa27f",
    "gear",
  ),
  shenyue: profile(
    "bob",
    "civil",
    "none",
    "#51374a",
    "#635170",
    "#d8bd8b",
    "#e0b9a0",
    "shield",
  ),
  guhe: profile(
    "swept",
    "engineer",
    "headset",
    "#383f47",
    "#485d68",
    "#e1b578",
    "#b89073",
    "gear",
  ),
  suyi: profile(
    "wave",
    "magical",
    "star",
    "#497787",
    "#406d80",
    "#b7e3dc",
    "#ddba9e",
    "star",
  ),
  taoqi: profile(
    "bun",
    "scholar",
    "glasses",
    "#665274",
    "#725c80",
    "#e0bac9",
    "#deb89e",
    "star",
  ),
  luchaosheng: profile(
    "swept",
    "uniform",
    "cap",
    "#6a6254",
    "#44646c",
    "#d6ceae",
    "#c8a684",
    "gear",
  ),
  yanxingzhou: profile(
    "braid",
    "courier",
    "none",
    "#342f29",
    "#775f48",
    "#d5b77c",
    "#b99574",
    "shield",
  ),
  yunsong: profile(
    "topknot",
    "robe",
    "beard",
    "#d5d0bf",
    "#5e7064",
    "#cfdbb7",
    "#cda98a",
    "rune",
  ),
  wangshu: profile(
    "bob",
    "worker",
    "glasses",
    "#5a4133",
    "#7b625b",
    "#e0c59b",
    "#dfbda4",
    "book",
  ),
  hejing: profile(
    "short",
    "uniform",
    "goggles",
    "#3e3b33",
    "#5f6553",
    "#dfbc7a",
    "#af896b",
    "shield",
  ),
  xuzhao: profile(
    "long",
    "scholar",
    "headset",
    "#717c88",
    "#48556d",
    "#b8c8e1",
    "#d2b098",
    "book",
  ),
};

function Emblem({
  shape,
  x,
  y,
  color,
}: {
  shape: PortraitProfile["emblem"];
  x: number;
  y: number;
  color: string;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      {shape === "gear" && (
        <>
          <circle r="4" />
          <path d="M-7 0H-5M5 0H7M0-7V-5M0 5V7M-5-5L-3-3M3 3L5 5M-5 5L-3 3M3-3L5-5" />
        </>
      )}
      {shape === "star" && (
        <path d="M0-7L2-2 7-2 3 1 4 6 0 3-4 6-3 1-7-2-2-2Z" />
      )}
      {shape === "shield" && (
        <>
          <path d="M-6-5L0-7 6-5V1Q5 5 0 7Q-5 5-6 1Z" />
          <path d="M0-4V4M-3 0H3" />
        </>
      )}
      {shape === "rune" && (
        <>
          <path d="M0-7L6 0 0 7-6 0Z" />
          <path d="M0-3V3M-3 0H3" />
        </>
      )}
      {shape === "book" && (
        <>
          <path d="M0-4Q-3-6-7-4V5Q-3 3 0 5Q3 3 7 5V-4Q3-6 0-4V5" />
          <path d="M-5-1H-2M2-1H5" />
        </>
      )}
      {shape === "leaf" && (
        <>
          <path d="M-5 6Q-8-5 6-7Q9 5-5 6Z" />
          <path d="M-5 6L4-4M-2 2H3" />
        </>
      )}
    </g>
  );
}

function HairShape({
  p,
  front = false,
}: {
  p: PortraitProfile;
  front?: boolean;
}) {
  if (front)
    return (
      <g fill={p.hairColor} stroke="#233039" strokeWidth="1.2">
        {p.hair === "short" && (
          <path d="M36 60Q33 37 49 34Q74 28 86 48L83 59 73 45 66 53 53 42 42 60Z" />
        )}
        {p.hair === "swept" && (
          <path d="M35 60Q31 33 54 31Q83 27 87 54L78 52 72 39Q61 57 37 54Z" />
        )}
        {p.hair === "bob" && (
          <path d="M35 65Q28 42 46 34Q81 26 88 52L88 81 81 83 79 51 67 45 56 54 42 48 41 82 31 78Z" />
        )}
        {p.hair === "long" && (
          <path d="M35 61Q33 34 57 31Q80 28 87 55L81 65 77 44 60 50 47 45 39 66Z" />
        )}
        {p.hair === "bun" && (
          <path d="M35 58Q33 30 58 32Q88 27 87 59L78 59 71 43 57 48 43 43 41 61Z" />
        )}
        {p.hair === "braid" && (
          <path d="M35 60Q33 29 60 30Q88 30 87 58L79 62 75 44 62 51 47 44 41 62Z" />
        )}
        {p.hair === "topknot" && (
          <path d="M35 58Q34 31 59 32Q85 31 86 56L78 56 72 42 47 42 40 60Z" />
        )}
        {p.hair === "wave" && (
          <path d="M34 61Q24 49 36 38Q38 24 54 29Q69 22 79 34Q96 36 89 55L82 64 76 43 65 49 55 42 43 55Z" />
        )}
      </g>
    );
  return (
    <g fill={p.hairColor} stroke="#233039" strokeWidth="1.2">
      {p.hair === "long" && (
        <path d="M38 51Q24 62 28 109L43 123 60 111 80 122 94 108Q89 72 82 45Z" />
      )}
      {p.hair === "braid" && (
        <>
          <path d="M34 58Q25 77 35 109L44 110 41 79ZM85 55Q96 77 85 109L77 110 80 76Z" />
          <path
            d="M33 78L42 84 33 92 42 99M85 78L77 85 86 92 77 99"
            fill="none"
            stroke="#bcb294"
          />
        </>
      )}
      {p.hair === "bun" && <circle cx="60" cy="30" r="14" />}
      {p.hair === "topknot" && (
        <>
          <path d="M48 34Q42 13 61 16Q78 18 70 34Z" />
          <path d="M44 32H76" stroke={p.accent} strokeWidth="3" />
        </>
      )}
      {p.hair === "wave" && (
        <path d="M35 50Q23 65 31 79L37 89 44 78 79 78 86 89Q100 68 83 43Z" />
      )}
    </g>
  );
}

function Costume({ p }: { p: PortraitProfile }) {
  return (
    <g stroke="#233039" strokeWidth="1.4" strokeLinejoin="round">
      <path
        d="M11 150L17 119Q21 104 44 97H76Q101 104 105 118L112 150Z"
        fill={p.coat}
      />
      {p.attire === "robe" ? (
        <>
          <path
            d="M40 99L66 121 59 150H27L36 107ZM80 100L51 129 45 150H95L87 112Z"
            fill={p.coat}
          />
          <path
            d="M42 98L67 120 53 150M80 99L49 129"
            fill="none"
            stroke={p.accent}
            strokeWidth="4"
          />
          <path d="M77 122L89 141M76 130L84 142" stroke={p.accent} />
        </>
      ) : p.attire === "magical" ? (
        <>
          <path
            d="M28 107L45 101 60 117 75 100 93 108 75 130H44Z"
            fill="#d7dcd6"
          />
          <path
            d="M33 111L48 117M87 111L73 117"
            stroke={p.accent}
            strokeWidth="3"
          />
          <path d="M45 124L60 119 74 125 60 135Z" fill={p.accent} />
          <circle cx="60" cy="125" r="4" fill="#e4cd94" />
        </>
      ) : p.attire === "uniform" ? (
        <>
          <path d="M43 99L60 113 77 99 78 119 61 123 43 119Z" fill="#d4cdb4" />
          <path d="M60 113V150" stroke={p.accent} strokeWidth="2" />
          <path
            d="M22 109L35 115M86 115L99 109"
            stroke={p.accent}
            strokeWidth="5"
          />
          <path d="M27 126H45M78 126H96" stroke={p.accent} />
          <circle cx="64" cy="131" r="2" fill={p.accent} />
          <circle cx="64" cy="142" r="2" fill={p.accent} />
        </>
      ) : p.attire === "worker" ? (
        <>
          <path d="M43 99L60 112 77 99 74 125H45Z" fill="#ded5bd" />
          <path
            d="M34 109L37 150M86 109L83 150"
            stroke={p.accent}
            strokeWidth="6"
          />
          <path d="M46 130H74V150H46Z" fill="none" stroke={p.accent} />
        </>
      ) : p.attire === "courier" ? (
        <>
          <path d="M39 99L60 109 81 99 78 116 60 126 41 118Z" fill={p.accent} />
          <path d="M26 150L82 107" stroke="#c4b393" strokeWidth="9" />
          <path d="M26 150L82 107" stroke="#463f37" strokeWidth="1" />
          <path d="M74 136L91 150" stroke={p.accent} strokeWidth="4" />
        </>
      ) : (
        <>
          <path d="M44 99L60 112 76 99 70 133H50Z" fill="#d9d6c7" />
          <path
            d="M43 101L32 117 50 124 54 150M77 101L88 117 70 124 66 150"
            fill="none"
            stroke={p.accent}
            strokeWidth="2"
          />
          {p.attire === "engineer" && (
            <path d="M81 130H96V143H81Z" fill="none" stroke={p.accent} />
          )}
          {p.attire === "scholar" && (
            <path d="M20 125L30 116 39 147 31 150Z" fill={p.accent} />
          )}
          {p.attire === "civil" && (
            <path d="M57 113H63L66 134 60 142 54 134Z" fill={p.accent} />
          )}
        </>
      )}
      <Emblem
        shape={p.emblem}
        x={p.attire === "courier" ? 29 : 85}
        y={p.attire === "magical" ? 112 : 120}
        color={p.accent}
      />
    </g>
  );
}

function portraitProfile(id: string): PortraitProfile {
  if (portraitProfiles[id]) return portraitProfiles[id];
  const person = getPerson(id);
  const code = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const background =
    person?.faction === "popular"
      ? "#597267"
      : person?.faction === "security"
        ? "#555b64"
        : "#506777";
  return profile(
    (["short", "swept", "bob", "wave"] as const)[code % 4],
    person?.specialty === "anomaly" ? "scholar" : "civil",
    "none",
    "#485052",
    background,
    "#d7c391",
  );
}

/** Same art direction for all 24 people, including uniform fallback for mod ids. */
export function PortraitV5({
  id,
  name,
  size = 64,
  className = "",
}: {
  id: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const person = getPerson(id);
  const p = portraitProfile(id);
  const clip = `portrait-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className={`v5-portrait ${className}`}
      viewBox="0 0 120 152"
      width={size}
      height={Math.round((size * 152) / 120)}
      role="img"
      aria-label={`${name || person?.name || id} · ${person?.title || "联邦人员"}档案头像`}
    >
      <title>{name || person?.name || id}</title>
      <desc>原创统一矢量半身档案插画，以服装、发型和职业徽记区分人物。</desc>
      <defs>
        <clipPath id={clip}>
          <rect x="2" y="2" width="116" height="148" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="120" height="152" fill="#1d343c" />
        <circle cx="60" cy="61" r="49" fill={p.accent} opacity=".12" />
        <path
          d="M7 19H113M7 134H113M14 6V146M106 6V146"
          stroke={p.accent}
          opacity=".25"
        />
        <path
          d="M5 115L114 6M5 143L116 32"
          stroke={p.accent}
          opacity=".08"
          strokeWidth="10"
        />
        <HairShape p={p} />
        <Costume p={p} />
        <path
          d="M48 82V103Q60 114 73 102V82Z"
          fill={p.skin}
          stroke="#6f574b"
          strokeWidth="1.2"
        />
        <path
          d="M49 88L71 86 70 98 59 104 50 98Z"
          fill="#5a3f35"
          opacity=".18"
        />
        <ellipse cx="36" cy="67" rx="5" ry="9" fill={p.skin} />
        <ellipse cx="84" cy="67" rx="5" ry="9" fill={p.skin} />
        <path
          d="M37 48Q59 32 82 48L81 76Q78 93 61 100Q43 95 38 79Z"
          fill={p.skin}
          stroke="#6f574b"
          strokeWidth="1.2"
        />
        <path
          d="M78 55L78 76Q75 90 64 96Q81 93 82 76V52Z"
          fill="#6a493d"
          opacity=".15"
        />
        <HairShape p={p} front />
        <g fill="none" stroke="#3b3737" strokeLinecap="round">
          <path d="M43 63Q48 60 53 62M67 62Q73 60 78 63" strokeWidth="2" />
          <path d="M44 69H53M68 69H77" strokeWidth="2.4" />
          <path d="M60 70L58 80 62 80" stroke="#876650" strokeWidth="1.2" />
          <path d="M54 87Q60 89 66 87" stroke="#8b5e55" strokeWidth="1.5" />
        </g>
        <circle cx="49" cy="70" r="2" fill="#293b42" />
        <circle cx="72" cy="70" r="2" fill="#293b42" />
        {p.accessory === "glasses" && (
          <g fill="none" stroke={p.accent} strokeWidth="2">
            <rect x="40" y="63" width="16" height="12" rx="3" />
            <rect x="65" y="63" width="16" height="12" rx="3" />
            <path d="M56 67H65M34 65H40M81 65H87" />
          </g>
        )}
        {p.accessory === "monocle" && (
          <g fill="none" stroke={p.accent} strokeWidth="2">
            <circle cx="73" cy="69" r="9" />
            <path d="M81 73L89 106" />
          </g>
        )}
        {p.accessory === "cap" && (
          <g stroke="#263435" strokeWidth="1.5">
            <path d="M31 44L40 25H81L90 44Z" fill={p.coat} />
            <path d="M29 44Q60 38 91 44L83 52H37Z" fill="#29373b" />
            <path d="M38 39H83" stroke={p.accent} strokeWidth="3" />
            <Emblem shape={p.emblem} x={60} y={34} color={p.accent} />
          </g>
        )}
        {p.accessory === "goggles" && (
          <g fill="#314b53" stroke={p.accent} strokeWidth="2">
            <rect x="37" y="40" width="19" height="12" rx="4" />
            <rect x="65" y="40" width="19" height="12" rx="4" />
            <path d="M56 46H65M33 44H37M84 44H89" />
          </g>
        )}
        {p.accessory === "headset" && (
          <g fill="none" stroke={p.accent} strokeWidth="3">
            <path d="M30 70V51Q31 26 60 26Q91 26 90 53V69M90 72L86 83 72 85" />
            <rect x="26" y="60" width="8" height="16" rx="3" fill={p.coat} />
            <rect x="86" y="60" width="8" height="16" rx="3" fill={p.coat} />
          </g>
        )}
        {p.accessory === "star" && (
          <>
            <Emblem shape="star" x={36} y={50} color={p.accent} />
            <path
              d="M28 51L20 60M33 54L27 65"
              stroke={p.accent}
              strokeWidth="2"
            />
          </>
        )}
        {p.accessory === "beard" && (
          <path
            d="M43 81Q60 94 78 80L72 105 61 116 48 103Z"
            fill={p.hairColor}
            stroke="#aaa893"
            strokeWidth="1"
          />
        )}
        <path
          d="M5 10V5H20M100 5H115V20M115 132V147H100M20 147H5V132"
          fill="none"
          stroke={p.accent}
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

/** Six district outlines retain existing hit targets while adding coastal identity. */
export const V5_REGION_PATHS = [
  "M160 140L179 133 185 121 240 118 268 105 310 100 354 114 390 115 480 140 465 270 320 290 195 250 181 215 171 207Z",
  "M195 250L320 290 465 270 455 405 305 445 170 360 167 327 179 303Z",
  "M170 360L305 445 455 405 460 525 418 545 406 559 357 568 320 580 276 566 250 550 220 548 185 510 154 482 145 464 120 425 139 400Z",
  "M455 405L570 345 680 410 687 438 683 455 690 480 690 520 654 531 632 552 603 553 580 570 548 559 516 562 460 525Z",
  "M480 140L507 119 536 111 563 85 595 70 629 75 652 87 710 93 755 105 774 133 801 146 812 170 845 210 825 227 812 251 788 261 755 290 620 270 465 270Z",
  "M465 270L620 270 755 290 778 326 782 348 804 364 810 390 773 404 746 400 717 414 680 410 570 345 455 405Z",
] as const;

function Mountains({
  x,
  y,
  count = 3,
  color = "#c4d0ae",
}: {
  x: number;
  y: number;
  count?: number;
  color?: string;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={color}
      strokeWidth="2"
      opacity=".55"
    >
      {Array.from({ length: count }, (_, i) => (
        <path key={i} d={`M${i * 24} 15l12-24 16 25M${i * 24 + 6} 3l6-3 7 4`} />
      ))}
    </g>
  );
}

function Landmark({
  kind,
  x,
  y,
}: {
  kind: "city" | "factory" | "temple" | "tower";
  x: number;
  y: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="#34474b"
      stroke="#d7cba0"
      strokeWidth="1.8"
      strokeLinejoin="round"
      opacity=".85"
    >
      {kind === "city" && (
        <>
          <path d="M-22 15V-5H-10V15M-8 15V-21H8V15M10 15V-7H23V15M-26 15H27" />
          <path d="M-3-25H3M0-25V-32M-3-15H3M-3-7H3M-3 1H3" fill="none" />
        </>
      )}
      {kind === "factory" && (
        <>
          <path d="M-26 16V-7L-12 0V-10L3-2V-16H14V16ZM19 16V-27H25V16M-28 16H30" />
          <path d="M-20 7H-13M-8 7H-1M5 7H11M22-32Q13-41 25-48" fill="none" />
        </>
      )}
      {kind === "temple" && (
        <>
          <path d="M-28-2L0-20 28-2ZM-24 1H24M-19 2V16H19V2M-26 17H27M-4 15V4H4V15" />
          <path d="M-13-12L0-31 13-12M-18-10H18" fill="none" />
        </>
      )}
      {kind === "tower" && (
        <>
          <path d="M-17 17L-10-17H10L17 17ZM-13-17H13M-7-24H7M0-24V-34M-20 18H20" />
          <path d="M-4-6H4M-7 4H7M-10 12H10" fill="none" />
        </>
      )}
    </g>
  );
}

/** Decorative geography has no input handlers and cannot cover interactive map targets. */
export function MapGeographyV5({ province }: { province?: ProvinceId }) {
  return (
    <g className="v5-map-geography" pointerEvents="none" aria-hidden="true">
      {(!province || province === "industry") && (
        <g>
          <path
            d="M181 160Q240 210 230 250Q220 296 190 329Q170 365 222 392"
            fill="none"
            stroke="#9dbabf"
            strokeWidth="6"
            opacity=".32"
          />
          <path
            d="M187 160Q244 210 235 250Q225 296 195 329Q176 365 227 392"
            fill="none"
            stroke="#d2e1dd"
            strokeWidth="1"
            opacity=".35"
          />
          <Landmark kind="city" x={265} y={168} />
          <Landmark kind="factory" x={244} y={342} />
          <path
            d="M266 188L294 229 260 300 246 322M350 151L405 178 401 222"
            fill="none"
            stroke="#ddd1aa"
            strokeDasharray="3 6"
            opacity=".5"
          />
          <Mountains x={367} y={364} count={2} color="#c7c6a5" />
        </g>
      )}
      {(!province || province === "south") && (
        <g>
          <Mountains x={178} y={445} count={4} />
          <Mountains x={492} y={490} count={3} />
          <Mountains x={619} y={434} count={2} />
          <Landmark kind="temple" x={362} y={505} />
          <path
            d="M203 473Q252 420 312 460T448 485Q474 520 535 524T634 502"
            fill="none"
            stroke="#b0e5d6"
            strokeWidth="3"
            opacity=".5"
          />
          <path
            d="M205 481Q253 428 312 468T448 493Q474 528 535 532T634 510"
            fill="none"
            stroke="#b0e5d6"
            strokeWidth="1"
            strokeDasharray="4 8"
            opacity=".35"
          />
          <g fill="#dcdec0" stroke="#496d65">
            <circle cx="235" cy="451" r="4" />
            <circle cx="430" cy="480" r="4" />
            <circle cx="590" cy="527" r="4" />
          </g>
        </g>
      )}
      {(!province || province === "north") && (
        <g>
          <Mountains x={577} y={111} count={4} color="#d7d9e4" />
          <Mountains x={729} y={335} count={2} color="#d7d9e4" />
          <path
            d="M682 98Q705 144 752 164T805 220M600 305Q645 278 684 295T750 323"
            fill="none"
            stroke="#bbc6d5"
            strokeWidth="2"
            opacity=".3"
          />
          <Landmark kind="tower" x={718} y={228} />
          <g
            transform="translate(767 203) rotate(-20)"
            fill="none"
            stroke="#d8bbdf"
            opacity=".5"
          >
            <ellipse rx="28" ry="13" />
            <ellipse rx="18" ry="9" />
            <path d="M-34 0Q0-28 35 0Q0 29-34 0Z" />
            <path d="M0-25V25M-10-4L9 8" />
          </g>
          <g fill="none" stroke="#b3c8c3" opacity=".45" strokeWidth="2">
            <path d="M523 180l9-17 9 17h-18l9-9M548 206l9-17 9 17h-18l9-9M534 226l9-17 9 17h-18l9-9" />
          </g>
        </g>
      )}
    </g>
  );
}

export function FacilityMarkerV5({
  type,
  status,
  x,
  y,
  size = 24,
}: {
  type: string;
  status: "construction" | "completed" | "paused";
  x: number;
  y: number;
  size?: number;
}) {
  const color =
    status === "completed"
      ? "#c4edca"
      : status === "paused"
        ? "#ffbdaf"
        : "#f5d69b";
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size / 24})`}
      className={`v5-facility-marker ${status}`}
    >
      <circle
        r="15"
        fill="#1e343b"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={status === "construction" ? "3 3" : undefined}
      />
      <g
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === "energy" || type === "grid" ? (
          <path d="M2-10L-6 2H0L-2 10 7-3H1Z" />
        ) : type === "rail" ? (
          <>
            <path d="M-7-8H7V5H-7ZM-4 5L-8 10M4 5L8 10M-7 9H7M-3-4H3" />
            <circle cx="-3" cy="2" r=".5" />
            <circle cx="3" cy="2" r=".5" />
          </>
        ) : type === "warning" ? (
          <>
            <path d="M0-10L10 8H-10ZM0-4V2" />
            <circle cy="5" r=".5" />
          </>
        ) : type === "farm" || type === "cooperative" ? (
          <>
            <path d="M0 10V-8M0-3Q-9-10-8-1Q-3 3 0 0M0 2Q9-5 8 3Q4 8 0 6" />
          </>
        ) : type === "academy" ? (
          <>
            <path d="M0-6Q-4-9-10-6V8Q-4 5 0 8Q4 5 10 8V-6Q4-9 0-6V8M-7-2H-3M3-2H7" />
            <path d="M0-13V-10M-3-11L-5-13M3-11L5-13" />
          </>
        ) : type === "port" ? (
          <>
            <path d="M-10 2H10L5 8H-6ZM-5 2V-5H5V2M0-5V-10M-10 11Q-5 8 0 11Q5 8 10 11" />
          </>
        ) : (
          <>
            <path d="M-10 8V-4L-3 0V-6L4-1V-9H9V8ZM-6 4H-3M1 4H4" />
          </>
        )}
        {status === "paused" && (
          <path d="M-3-3V4M3-3V4" stroke="#ffbdaf" strokeWidth="3" />
        )}
      </g>
    </g>
  );
}

/** Thematic original compositions for the existing event kinds. */
export function EventArtV5({ kind, title }: { kind: string; title?: string }) {
  const clip = `event-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const occult = kind === "oldgod" || kind === "accident";
  const color = occult
    ? "#c2bddf"
    : kind === "distrust"
      ? "#dfa98d"
      : "#dfcb96";
  return (
    <svg
      className="v5-event-art"
      viewBox="0 0 420 118"
      role="img"
      aria-label={title ? `${title} · 档案插画` : "联邦事务档案插画"}
    >
      <desc>原创工业幻想档案构图，示意事务主题，不表示额外的游戏效果。</desc>
      <defs>
        <clipPath id={clip}>
          <rect x="1" y="1" width="418" height="116" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="420" height="118" fill={occult ? "#242a3e" : "#1e3439"} />
        <path
          d="M0 20H420M0 40H420M0 60H420M0 80H420M0 100H420M40 0V118M80 0V118M120 0V118M160 0V118M200 0V118M240 0V118M280 0V118M320 0V118M360 0V118M400 0V118"
          stroke={color}
          opacity=".07"
        />
        <circle cx="333" cy="45" r="53" fill={color} opacity=".05" />
        <g stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none">
          {occult ? (
            <>
              <path
                d="M35 97L35 64 74 74V47H109V97M9 103H146M119 97V59H136V97"
                fill="#253c46"
              />
              <path
                d="M148 92Q194 19 254 36Q292 9 344 48Q387 73 412 98"
                opacity=".4"
              />
              <path d="M189 58Q267-3 345 58Q267 117 189 58Z" />
              <circle cx="267" cy="58" r="24" />
              <circle cx="267" cy="58" r="8" fill={color} />
              <path d="M163 51L172 45 171 63 180 57M356 54L363 45 374 68 385 57M267 10V30M267 85V107" />
              <path d="M43 21L66 21 81 40M103 10V32M21 46H46" opacity=".5" />
            </>
          ) : kind === "distrust" ? (
            <>
              <path d="M45 95L53 66 65 56 71 79 80 63 88 93M114 99L113 67 128 54 140 99M165 102L165 70 177 59 195 98" />
              <circle cx="69" cy="43" r="11" />
              <circle cx="127" cy="41" r="12" />
              <circle cx="178" cy="47" r="10" />
              <path d="M251 24H385V100H251ZM261 42H375M261 53H342M261 66H370M261 79H317" />
              <path d="M254 14L370 14" strokeWidth="5" />
              <path d="M216 40L208 59 222 69 208 88" strokeWidth="4" />
            </>
          ) : kind === "opportunity" ? (
            <>
              <path d="M38 100L64 59 95 101M73 70L111 19 163 99M137 66L164 42 206 101M21 103H221" />
              <path d="M98 74L104 37 116 37 131 74ZM89 74H141M95 75V99H135V75" />
              <path d="M215 87Q252 18 302 55T409 78" stroke="#a8dfd2" />
              <path
                d="M228 96Q260 27 307 64T413 87"
                stroke="#a8dfd2"
                strokeDasharray="4 6"
              />
              <circle cx="317" cy="47" r="22" />
              <path d="M317 31V63M301 47H333" />
            </>
          ) : kind === "supply" ? (
            <>
              <path d="M24 95H227L220 103H34ZM46 90V46H116V90M125 90V39H195V90M55 55H108M134 48H188M62 45V89M95 45V89M146 39V89M176 39V89" />
              <circle cx="67" cy="106" r="8" />
              <circle cx="182" cy="106" r="8" />
              <path d="M265 92V31H355V92ZM273 31L310 10 346 31M277 48H343M277 61H343M277 74H343" />
              <path d="M235 111H411" />
            </>
          ) : kind === "final" ? (
            <>
              <path d="M211 16V104M144 103L163 52 201 62 218 27 252 58 279 50 302 103ZM36 108H386" />
              <path d="M73 90V33L106 25V89M315 90V34L349 26V89M88 19V91M331 18V91" />
              <path
                d="M87 21Q121 16 136 37L88 34ZM331 20Q369 17 385 37L331 34Z"
                fill={color}
                opacity=".5"
              />
              <circle cx="211" cy="50" r="35" opacity=".35" />
              <path d="M24 50L51 60M366 59L396 49M172 20L160 10M252 18L265 7" />
            </>
          ) : kind === "gazette" ? (
            <>
              <path d="M72 13H321V106H72Z" fill="#2b4143" />
              <path d="M89 31H303M89 41H303M89 56H185V91H89ZM200 57H304M200 69H304M200 81H290M200 93H304" />
              <path d="M105 82L132 62 165 82M47 31V106H70M342 11V92" />
              <circle cx="360" cy="84" r="17" />
              <path d="M356 75L366 84 355 93" />
            </>
          ) : (
            <>
              <path d="M30 99V53L68 66V41L104 59V33H128V99ZM143 99V26H154V99M20 103H179M41 81H60M76 80H92M108 78H121" />
              <path d="M153 20Q130 7 165 5M162 13Q178 6 182 0" opacity=".5" />
              <path d="M211 18H376V104H211ZM225 37H363M225 51H335M225 65H363M225 80H293M225 93H347" />
              <circle cx="350" cy="82" r="17" />
              <path d="M342 81L349 88 360 74" />
            </>
          )}
        </g>
        <path
          d="M8 8H30M8 8V25M390 8H412V25M8 95V110H30M390 110H412V95"
          fill="none"
          stroke={color}
          opacity=".65"
        />
      </g>
    </svg>
  );
}
