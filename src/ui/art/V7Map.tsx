import { useId } from "react";
import type { ProvinceId } from "../../types";
import type { RegionFeature } from "../../v2/model";
/** Original atlas relief. Information overlays retain their own hit targets above this drawing. */
export function MapReliefV7({
  province,
  features,
  quiet = false,
}: {
  province: ProvinceId;
  features: RegionFeature[];
  quiet?: boolean;
}) {
  const id = `relief-${useId().replace(/\W/g, "")}`;
  return (
    <g opacity={quiet ? 0.24 : 0.58} pointerEvents="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e4d5a5" />
          <stop offset=".48" stopColor="#789287" />
          <stop offset="1" stopColor="#182c2c" />
        </linearGradient>
      </defs>
      {province === "industry" ? (
        <>
          <path
            d="M145 260Q170 180 230 115L267 165 319 125 364 219 416 244 441 330 376 377 264 308Z"
            fill={`url(#${id})`}
            opacity=".35"
          />
          <path
            d="M147 249Q228 287 257 368T412 399"
            stroke="#88b2af"
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M202 217l48-36 45 70m-31-17 34-38 48 81"
            stroke="#c4c9ac"
            strokeWidth="2"
            fill="none"
          />
          <g fill="#263735" stroke="#b7b29a">
            <path d="M336 270h44v22h-44zm8-13h8v13h-8zm17-7h8v20h-8z" />
            <path d="M365 306h34v17h-34zm-10-2h6v18h-6z" />
          </g>
        </>
      ) : province === "north" ? (
        <>
          <path
            d="M555 185L606 116 656 181 696 132 736 204 792 181 816 277 751 295 708 231 643 269Z"
            fill={`url(#${id})`}
            opacity=".48"
          />
          <path
            d="M572 184l34-51 26 42m40 20 24-43 28 54m30 7 35-20 15 50"
            fill="none"
            stroke="#c7d1ca"
            strokeWidth="2"
          />
          <path
            d="M611 280q64-49 101 15t-37 48q-50 6-64-63"
            fill="#6f969b"
            opacity=".5"
          />
          <path
            d="M748 330q-42 8-70 42t-14 72"
            stroke="#99b4b4"
            strokeWidth="4"
            fill="none"
          />
        </>
      ) : (
        <>
          <path
            d="M222 467L272 381 326 410 368 365 421 424 470 387 566 484 513 546 409 507 318 580Z"
            fill={`url(#${id})`}
            opacity=".46"
          />
          <path
            d="M241 466l31-61 30 35m45-6 24-41 30 36m48 20 24-30 28 54"
            fill="none"
            stroke="#d1d5ac"
            strokeWidth="2"
          />
          <path
            d="M239 528q88-100 133-68t137 48"
            stroke="#95c3ad"
            strokeWidth="4"
            fill="none"
          />
        </>
      )}
      {features.includes("leyline") && (
        <path
          d={
            province === "south"
              ? "M310 430q30 42 70 45t58 45"
              : province === "north"
                ? "M670 211q14 25 45 35"
                : "M265 241q30 20 60 65"
          }
          stroke="#a6d5c3"
          strokeWidth="2"
          strokeDasharray="5 8"
          fill="none"
        />
      )}
    </g>
  );
}
