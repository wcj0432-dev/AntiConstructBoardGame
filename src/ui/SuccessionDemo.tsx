import { getPerson } from "../data";
import { assignmentsFor } from "../v2/personnel";
import { useState } from "react";
import type { Action, FundingMode, V2Game } from "../v2/model";
import { demoPhase, demoGrid } from "../v2/demonstration";
import { fundingLabels } from "../v2/fiscal";
import { milestones } from "../v2/engine";
import { ActionButton } from "./AdministrativeConsole";
import { TrainingConsole } from "./TrainingConsole";
import { FacilityOperations } from "./FacilityOperations";
export function SuccessionDemo({
  game,
  onChoose,
  onOpen,
}: {
  game: V2Game;
  onChoose: (a: Action) => void;
  onOpen: (
    panel: "staff" | "economy" | "finance" | "goals" | "matters",
  ) => void;
}) {
  const [funding, setFunding] = useState<FundingMode>("local"),
    phase = demoPhase(game),
    grid = demoGrid(game);
  const academy = game.machine.works.find(
    (w) => w.type === "academy" && w.province === "south",
  )!;
  const graduate = game.machine.trainings?.find(
    (t) => t.state === "completed" && t.cap === "leywork",
  )?.student;
  const originalOffice = graduate
    ? assignmentsFor(game, graduate).mainOffice
    : null;
  return (
    <section aria-label="南岭工程与人才接班" className="succession-guide">
      <h2>南岭工程与人才接班 · 第{phase}/4阶段</h2>
      <p>
        十二回合可重玩演示；场景准备预算为中央36、各省12、宗门8。正式战役的资源与规则保留。所有合同、课程、欠款和操作均使用正式系统，可存档。
      </p>
      <ol>
        <li>签订电网合同：五种投资方式决定产权、收益分配和下一期付款方。</li>
        <li>
          安排工程与指定学员培养：建议林若虚专职施工、墨玄教习陶祈；可以自行更换学员与方式。
        </li>
        <li>
          批准一次应急准备金调拨，观察下一期实际欠付；通过财政回拨或维护接管，再实际补缴。
        </li>
        <li>
          让继任者到实际工程岗位，保持电网运营和计划调度；第10～11回合演练，第12回合完成全国终局。
        </li>
      </ol>
      {!grid && (
        <>
          <label>
            场景电网合同
            <select
              aria-label="场景电网合同"
              value={funding}
              onChange={(e) => setFunding(e.target.value as FundingMode)}
            >
              {Object.entries(fundingLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <ActionButton
            game={game}
            onChoose={onChoose}
            label="预览签订场景电网合同"
            action={{
              type: "project",
              project: "grid",
              province: "south",
              to: "industry",
              partner: "industry",
              worker: "linruoxu",
              assignment: "dedicated",
              funding,
            }}
          />
        </>
      )}
      {phase === 2 && (
        <ActionButton
          game={game}
          onChoose={onChoose}
          label="预览墨玄培养陶祈（学院）"
          action={{
            type: "train",
            mentor: "mo",
            student: "taoqi",
            cap: "leywork",
            province: "south",
            method: "academy",
            facility: academy.id,
          }}
        />
      )}
      {grid?.completed && !game.machine.demonstration?.reserveSource && (
        <ActionButton
          game={game}
          onChoose={onChoose}
          label="预览应急准备金调拨"
          action={{ type: "demoReserve" }}
        />
      )}
      {game.machine.demonstration?.reserveSource && (
        <p>
          准备金调拨已入真实转移账本；
          {game.machine.demonstration.failed
            ? "已观察到电网欠付。补缴不会自动修复独立技术故障。"
            : "结束一回合后查看实际维护付款。"}
        </p>
      )}
      {phase === 4 && graduate && (
        <>
          {originalOffice && originalOffice !== "gov-south" && (
            <ActionButton
              game={game}
              onChoose={onChoose}
              label="先预览解除继任者原主职"
              action={{ type: "appoint", office: originalOffice, person: null }}
            />
          )}
          <ActionButton
            game={game}
            onChoose={onChoose}
            label={`预览${getPerson(graduate)?.name}接任南岭负责人`}
            action={{ type: "appoint", office: "gov-south", person: graduate }}
          />
          <ActionButton
            game={game}
            onChoose={onChoose}
            label="预览全国工程演练"
            action={{ type: "inspect" }}
          />
        </>
      )}
      <div className="quick-grid">
        <button onClick={() => onOpen("staff")}>调阅组织图与任命</button>
        <button onClick={() => onOpen("finance")}>调阅责任账户与拨款</button>
        <button onClick={() => onOpen("economy")}>调阅电网技术维修</button>
        <button onClick={() => onOpen("goals")}>调阅全国目标</button>
        <button onClick={() => onOpen("matters")}>调阅全国终局事务</button>
      </div>
      <TrainingConsole game={game} onChoose={onChoose} />
      <FacilityOperations game={game} onChoose={onChoose} province="south" />
      <h3>当前实际国家资格</h3>
      {milestones(game).map((c) => (
        <p key={c.label} className={c.met ? "met" : "unmet"}>
          {c.met ? "已具备" : "尚未具备"} · {c.label}：{c.reason}
        </p>
      ))}
    </section>
  );
}
