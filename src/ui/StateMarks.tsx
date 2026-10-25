import type { StateMark } from "../v2/governance";
import { personMarks } from "../v2/governance";
import type { V2Game } from "../v2/model";
import { Tooltip } from "./Tooltip";
export function StateMarks({
  marks,
  embedded = false,
}: {
  marks: StateMark[];
  embedded?: boolean;
}) {
  return (
    <span className="state-marks">
      {marks.map((m) => (
        <Tooltip key={m.id} title={m.label} content={<p>{m.reason}</p>}>
          <span
            tabIndex={embedded ? undefined : 0}
            className={`state-mark mark-${m.tone}`}
            data-state-mark={m.id}
          >
            {m.label}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}
export function PersonStateMarks({
  game,
  person,
  embedded = false,
}: {
  game: V2Game;
  person: string | null;
  embedded?: boolean;
}) {
  return <StateMarks embedded={embedded} marks={personMarks(game, person)} />;
}
