import { useState } from "react";
import { people, getPerson } from "../data";
import type { Action, TrainingCap, V2Game, Work } from "../v2/model";
import {
  chapterNames,
  storyAssets,
  storyFacts,
  storyTitle,
} from "../v2/contractStory";
import { trainingNames } from "../v2/training";
import { accountLabel, workFunding } from "../v2/fiscal";
import { workSpecs } from "../v2/administration";
import { previewAction } from "../v2/engine";
import { ActionButton } from "./AdministrativeConsole";
function ContractChapter({
  game,
  work,
  onChoose,
}: {
  game: V2Game;
  work: Work;
  onChoose: (a: Action) => void;
}) {
  const f = storyFacts(game, work.id),
    step = f.decisions.length;
  const owner = workFunding(game, work).owner;
  const [mentor, setMentor] = useState("mo"),
    [student, setStudent] = useState("yunsong"),
    [cap, setCap] = useState<TrainingCap>("leywork"),
    [method, setMethod] = useState<"field" | "academy">("academy"),
    [facility, setFacility] = useState("");
  const academies = game.machine.works.filter(
    (w) =>
      w.type === "academy" &&
      w.province === work.province &&
      w.completed &&
      !w.cancelled,
  );
  const base = { type: "storyDecision" as const, work: work.id };
  const options: { label: string; action: Action }[] =
    step === 0
      ? [
          {
            label: "中央承接维护",
            action: { ...base, chapter: "charter", choice: "central" },
          },
          {
            label: "地方承担维护",
            action: { ...base, chapter: "charter", choice: "local" },
          },
        ]
      : step === 1
        ? [
            {
              label: "签署具名培养安排",
              action: {
                ...base,
                chapter: "teaching",
                choice: method,
                mentor,
                student,
                cap,
                facility: facility || academies[0]?.id,
              },
            },
          ]
        : step === 2
          ? [
              {
                label: "全国统一征税",
                action: { ...base, chapter: "tax", choice: "central" },
              },
              {
                label: "全国财政自治",
                action: { ...base, chapter: "tax", choice: "autonomy" },
              },
            ]
          : [];
  return (
    <article className="advisor-issue contract-story" data-story-work={work.id}>
      <span className="eyebrow">三章政治故事 · 可选长期议程</span>
      <h3>{storyTitle}</h3>
      <p>
        {accountLabel(game, work.province)} · {workSpecs[work.type].name}。
        产权人：{owner === "joint" ? "共同产权" : accountLabel(game, owner)}。
      </p>
      <h3>
        {step < 3
          ? `第${step + 1}章 · ${chapterNames[step]}`
          : f.complete
            ? "三次签字，当前履约有效"
            : "三次签字，履约条件已经变化"}
      </h3>
      <p>
        {step === 0
          ? "共同投资留下了设备，也留下了每期的付款人。中央愿意承担维护，地方则坚持保有经营权。先决定谁承接旧债与未来维护。"
          : step === 1
            ? "设备可以共用，知识需要有人教、有人学。指定真实导师、学员和教学方式，保留地方教学渠道；课堂不会在签字时自动毕业。"
            : step === 2
              ? "学员开始掌握技术，三省随之争论税源：谁收取发展的收入，谁承担公共支出？这次决定适用于全国三省，会改变其他项目的财政环境。"
              : "后续政策仍可能改写这些承诺。以下记录保留当时签字，当前资格和资金始终由真实规则决定。"}
      </p>
      {f.decisions.map((d, i) => (
        <div className="document-card" key={d.source}>
          <b>
            第{i + 1}章 · T{d.turn}
          </b>
          ：
          {
            (
              {
                central:
                  d.chapter === "charter" ? "中央承接维护" : "全国统一征税",
                local: "地方承担",
                academy: "学院培养",
                field: "基层传承",
                autonomy: "地方自治",
              } as Record<string, string>
            )[d.choice]
          }
          。
          <details>
            <summary>查看签字来源</summary>
            {d.source} → {d.operation ?? "现行制度确认"} · 合同 {work.id}
          </details>
        </div>
      ))}
      {f.course && (
        <p>
          指定课程：{getPerson(f.course.mentor)?.name} →{" "}
          {getPerson(f.course.student)?.name}，{trainingNames[f.course.cap]}{" "}
          {f.course.progress}/{f.course.duration}；{f.course.reason}。
        </p>
      )}
      {f.issues.length > 0 && (
        <p className="unmet">当前事实：{f.issues.join("；")}</p>
      )}
      {step === 1 && (
        <div className="contract-story-fields">
          <label className="v2-field">
            专业
            <select
              aria-label="故事培养专业"
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
          <label className="v2-field">
            导师
            <select
              aria-label="故事导师"
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
          <label className="v2-field">
            学员
            <select
              aria-label="故事学员"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="v2-field">
            教学方式
            <select
              aria-label="故事教学方式"
              value={method}
              onChange={(e) => setMethod(e.target.value as "field" | "academy")}
            >
              <option value="academy">学院 · 两个有效教学周期</option>
              <option value="field">基层 · 三个有效教学周期</option>
            </select>
          </label>
          {method === "academy" && (
            <label className="v2-field">
              本省学院
              <select
                aria-label="故事学院"
                value={facility || academies[0]?.id || ""}
                onChange={(e) => setFacility(e.target.value)}
              >
                {!academies.length && (
                  <option value="">请先建设并运营本省学院</option>
                )}
                {academies.map((w) => (
                  <option key={w.id} value={w.id}>
                    {workSpecs[w.type].name} · {accountLabel(game, w.province)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {options.map(({ label, action }) => {
        const p = previewAction(game, action);
        return (
          <div className="document-card" key={label}>
            <ActionButton
              game={game}
              action={action}
              label={label}
              onChoose={onChoose}
            />
            <p>
              {p.costs.commands}命令 / {p.costs.treasury}中央资金 /{" "}
              {p.costs.capital}政治资本 / {p.costs.stock}实物
            </p>
            <p className={p.errors.length ? "unmet" : "met"}>
              {p.errors.join("；") || "当前条件具备；点击查看后果再确认"}
            </p>
          </div>
        );
      })}
    </article>
  );
}
export function ContractStory({
  game,
  onChoose,
}: {
  game: V2Game;
  onChoose: (a: Action) => void;
}) {
  const assets = storyAssets(game);
  return (
    <section aria-label="三章契约故事">
      {!assets.length && (
        <p>
          三章故事需要一项已竣工、有维护义务的地方、宗门或共同产权设施。可先在经济建设中签订真实合同；随机国情也可能继承此类设施。
        </p>
      )}
      {assets.map((w) => (
        <ContractChapter key={w.id} game={game} work={w} onChoose={onChoose} />
      ))}
    </section>
  );
}
