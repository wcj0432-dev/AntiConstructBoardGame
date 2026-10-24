import portraits from "../../assets/v7/core-portraits.png";
import { PortraitV5 } from "./V5Art";
export const illustratedPeople = ["lin", "mo", "sergei", "xing"];
/** Fixed ID mapping, with a coherent vector fallback for the remaining original roster. */
export function PortraitV7({ id, name }: { id: string; name: string }) {
  const i = illustratedPeople.indexOf(id);
  if (i < 0) return <PortraitV5 id={id} name={name} />;
  return (
    <span
      role="img"
      aria-label={`${name} · 原创档案半身像`}
      className="v7-core-portrait"
      style={{
        backgroundImage: `url(${portraits})`,
        backgroundPosition: `${(i * 100) / 3}% 15%`,
      }}
    />
  );
}
