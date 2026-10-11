import { useState } from "react";
import type { Action, V2Game } from "../v2/model";
import type { ProvinceId } from "../types";
import { regionalActions } from "../v2/regionalActions";
import { featureNames } from "../v2/regions";
import { previewAction } from "../v2/engine";
import { ActionButton } from "./AdministrativeConsole";
export function RegionalActions({
  game,
  province,
  onChoose,
}: {
  game: V2Game;
  province: ProvinceId;
  onChoose: (a: Action) => void;
}) {
  const [to, setTo] = useState<ProvinceId>(
    province === "industry" ? "north" : "industry",
  );
  const target =
    to === province
      ? game.core.provinces.find((p) => p.id !== province)!.id
      : to;
  const actions = regionalActions(game, province, target);
  return (
    <section className="regional-actions" aria-label="地区行动适用范围">
      <h3>地域治理与协作</h3>
      <p>
        当地特征：
        {game.machine.regionFeatures?.[province]
          .map((f) => featureNames[f])
          .join("、")}
      </p>
      <label>
        跨地区协作目标
        <select
          aria-label="跨地区协作目标"
          value={target}
          onChange={(e) => setTo(e.target.value as ProvinceId)}
        >
          {game.core.provinces
            .filter((p) => p.id !== province)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      {(
        [
          ["local", "本地治理"],
          ["special", "地方特色"],
          ["cross", "跨地区协作"],
        ] as const
      ).map(([group, name]) => (
        <section key={group}>
          <h4>{name}</h4>
          <div className="quick-grid">
            {actions
              .filter((a) => a.group === group)
              .map((a) => (
                <div key={a.id}>
                  <ActionButton
                    game={game}
                    action={a.action}
                    label={a.label}
                    onChoose={onChoose}
                  />
                  <p>
                    {a.features.map((f) => featureNames[f]).join("、") ||
                      "所有省份均可申请"}{" "}
                    · {a.repeat === "once" ? "一次性安排" : "有次数或间隔限制"}
                  </p>
                </div>
              ))}
          </div>
        </section>
      ))}
      <details>
        <summary>尚未具备条件的已知机会</summary>
        {actions.map((a) => {
          const missing = previewAction(game, a.action).conditions.filter(
            (c) => !c.met,
          );
          return missing.length ? (
            <article className="document-card" key={a.id}>
              <strong>{a.label}</strong>
              <ul>
                {missing.map((c) => (
                  <li key={c.label} className="unmet">
                    {c.label}：{c.reason}
                  </li>
                ))}
              </ul>
              <p>{a.effect}</p>
            </article>
          ) : null;
        })}
      </details>
    </section>
  );
}
