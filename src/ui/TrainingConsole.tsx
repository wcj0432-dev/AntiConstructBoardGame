import { useState } from "react";
import { people, getPerson } from "../data";
import type { Action, TrainingCap, V2Game } from "../v2/model";
import type { ProvinceId } from "../types";
import { trainingNames, courseConditions, admission } from "../v2/training";
import { workSpecs } from "../v2/administration";
import { ActionButton } from "./AdministrativeConsole";
export function TrainingConsole({
  game,
  onChoose,
  person,
}: {
  game: V2Game;
  onChoose: (a: Action) => void;
  person?: string;
}) {
  const [mentor, setMentor] = useState(person || "mo"),
    [student, setStudent] = useState("taoqi"),
    [cap, setCap] = useState<TrainingCap>("leywork"),
    [province, setProvince] = useState<ProvinceId>("south"),
    [method, setMethod] = useState<"field" | "academy">("field"),
    [facility, setFacility] = useState("");
  const academies = game.machine.works.filter(
    (w) => w.type === "academy" && w.province === province,
  );
  return (
    <section className="training-console" aria-label="专业与师承">
      <h3>专业与师承</h3>
      <p>
        具体导师培养具体学员。基层3个有效周期，费用2及教材1；学院2个周期，费用1，最多两名学员。调任、任务、欠付和隔离可能暂停课程。
      </p>
      <div className="quick-grid">
        <label>
          培养专业
          <select
            aria-label="培养专业"
            value={cap}
            onChange={(e) => setCap(e.target.value as TrainingCap)}
          >
            {Object.entries(trainingNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          导师
          <select
            aria-label="培养导师"
            value={mentor}
            onChange={(e) => setMentor(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          学员
          <select
            aria-label="培养学员"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          >
            {people
              .filter((p) => admission(p.id, cap))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          教学地区
          <select
            aria-label="教学地区"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value as ProvinceId);
              setFacility("");
            }}
          >
            {game.core.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          教学方式
          <select
            aria-label="教学方式"
            value={method}
            onChange={(e) => setMethod(e.target.value as "field" | "academy")}
          >
            <option value="field">基层教习</option>
            <option value="academy">学院培养</option>
          </select>
        </label>
        {method === "academy" && (
          <label>
            教学设施
            <select
              aria-label="教学设施"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            >
              <option value="">选择实际学院</option>
              {academies.map((w) => (
                <option key={w.id} value={w.id}>
                  {workSpecs[w.type].name} · {w.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <ActionButton
        game={game}
        onChoose={onChoose}
        action={{
          type: "train",
          mentor,
          student,
          cap,
          province,
          method,
          facility: method === "academy" ? facility : undefined,
        }}
        label="预览指定学员培养"
      />
      {(game.machine.trainings ?? [])
        .filter(
          (t) =>
            !person ||
            t.mentor === person ||
            t.student === person ||
            t.state === "unassigned",
        )
        .map((t) => (
          <article className="document-card" key={t.id} data-training-id={t.id}>
            <h4>
              {getPerson(t.mentor)?.name ?? "导师：旧版未记录"} →{" "}
              {getPerson(t.student)?.name ?? "旧历史待确认学员"} ·{" "}
              {trainingNames[t.cap]}
            </h4>
            <p>
              {t.method === "academy"
                ? "学院培养"
                : t.method === "legacy"
                  ? "迁移的历史教习"
                  : "基层教习"}{" "}
              · {game.core.provinces.find((p) => p.id === t.province)?.name} ·
              进度{t.progress}/{t.duration} ·{" "}
              {
                {
                  active: "培养中",
                  paused: "课程暂停",
                  completed: "已获得个人资格",
                  cancelled: "已取消",
                  unassigned: "待确认",
                }[t.state]
              }
            </p>
            <p>{t.reason}</p>
            {t.completedAt !== undefined && (
              <p>
                完成于第{t.completedAt}
                回合；导师后续离任不会撤回此人资质。当前能力仍由岗位、政策和工作占用决定。
              </p>
            )}
            {t.state === "paused" && (
              <>
                <ul>
                  {courseConditions(game, t)
                    .filter((c) => !c.met)
                    .map((c) => (
                      <li key={c.label} className="unmet">
                        {c.label}：{c.reason}
                      </li>
                    ))}
                </ul>
                <ActionButton
                  game={game}
                  onChoose={onChoose}
                  action={{
                    type: "trainingControl",
                    training: t.id,
                    operation: "resume",
                    mentor,
                  }}
                  label="检查恢复 / 更换导师"
                />
              </>
            )}
            {["active", "paused"].includes(t.state) && (
              <ActionButton
                game={game}
                onChoose={onChoose}
                action={{
                  type: "trainingControl",
                  training: t.id,
                  operation: "cancel",
                }}
                label="预览取消课程"
              />
            )}
            {t.state === "unassigned" && (
              <ActionButton
                game={game}
                onChoose={onChoose}
                action={{ type: "legacyTraining", training: t.id, student }}
                label="确认旧历史的指定继任者"
              />
            )}
          </article>
        ))}
    </section>
  );
}
