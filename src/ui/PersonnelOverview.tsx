import { useMemo, useState } from "react";
import {
  domainNames,
  factionNames,
  getOffice,
  getPerson,
  offices,
} from "../data";
import type { Domain, FactionId, ProvinceId } from "../types";
import type { Action, V2Game } from "../v2/model";
import { personMechanics, specialistPreview } from "../v2/traits";
import {
  appointmentImpact,
  concurrentConditions,
  filterPersonnelRows,
  officePerson,
  personnelRows,
  personnelStateNames,
  sortPersonnelRows,
  type PersonnelAppointmentAction,
  type PersonnelFilter,
  type PersonnelSort,
  type PersonnelWorkState,
} from "../v2/personnel";
import { PersonBadge } from "./Visuals";

export function AppointmentImpact({
  game,
  action,
}: {
  game: V2Game;
  action: PersonnelAppointmentAction;
}) {
  const impact = appointmentImpact(
    game,
    action.office,
    action.person,
    action.type === "concurrent" ? "secondary" : "primary",
  );
  const sections = [
    ["职务变化", impact.changes],
    ["将产生的空缺", impact.vacancies],
    ["原机构失去的能力", impact.lostCapabilities],
    ["新职位的作用", impact.gainedCapabilities],
    ["工程与临时任务", impact.projectEffects],
    ["派系与组织影响", impact.politicalEffects],
  ] as const;
  return (
    <section
      className="appointment-impact document-card"
      aria-label="人事安排后果"
    >
      <h3>人事安排后果</h3>
      <div className="impact-grid">
        {sections
          .filter(([, items]) => items.length)
          .map(([title, items]) => (
            <section key={title}>
              <h4>{title}</h4>
              {items.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>
          ))}
      </div>
    </section>
  );
}

const headers: { title: string; sort: PersonnelSort }[] = [
  { title: "人物", sort: "name" },
  { title: "派系", sort: "factionName" },
  { title: "主职务", sort: "mainOfficeLabel" },
  { title: "所在地区", sort: "regionLabel" },
  { title: "正式兼职", sort: "secondaryOfficeLabel" },
  { title: "当前任务", sort: "taskLabel" },
  { title: "专长与技能", sort: "specialty" },
  { title: "工作状态", sort: "stateLabel" },
  { title: "组织状态", sort: "grievance" },
];

export function PersonnelOverview({
  game,
  onChoose,
  province = "south",
  onSelectPerson,
  selectedPerson,
}: {
  game: V2Game;
  onChoose: (action: Action) => void;
  province?: ProvinceId;
  onSelectPerson?: (person: string) => void;
  selectedPerson?: string;
}) {
  const [filter, setFilter] = useState<PersonnelFilter>({});
  const [sort, setSort] = useState<PersonnelSort>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [person, setPerson] = useState("mo");
  const [office, setOffice] = useState("gov-south");
  const [mode, setMode] = useState<"primary" | "secondary">("primary");
  const [skillProvince, setSkillProvince] = useState<ProvinceId>(province);
  const rows = useMemo(() => personnelRows(game), [game]);
  const filtered = useMemo(
    () => sortPersonnelRows(filterPersonnelRows(rows, filter), sort, direction),
    [rows, filter, sort, direction],
  );
  const selected =
    rows.find((row) => row.id === (selectedPerson || person)) || rows[0];
  const record = getPerson(selected?.id);
  const action: PersonnelAppointmentAction =
    mode === "secondary"
      ? { type: "concurrent", office, person: selected?.id || null }
      : { type: "appoint", office, person: selected?.id || null };
  const concurrency =
    mode === "secondary"
      ? concurrentConditions(game, office, selected?.id || null)
      : [];
  const disabled = game.core.status !== "playing";
  const mechanics = personMechanics(game, selected?.id || "", skillProvince);
  const skill = specialistPreview(game, selected?.id || "", skillProvince);
  const changeSort = (next: PersonnelSort) => {
    if (next === sort) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      setDirection("asc");
    }
  };
  const selectPerson = (id: string) => {
    setPerson(id);
    onSelectPerson?.(id);
  };
  return (
    <div className="personnel-overview">
      <h2>全国人员总览</h2>
      <p>
        主职、正式兼职、工程顾问和专职派遣分别列示。两项正式职务共享同一人的实际行动能力；临时占用会同时影响所有职务。
      </p>
      <div
        className="personnel-filters"
        role="group"
        aria-label="人员筛选"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 12,
        }}
      >
        <label className="v2-field">
          搜索人物
          <input
            aria-label="搜索人物"
            placeholder="姓名、身份或技能"
            value={filter.search || ""}
            onChange={(event) =>
              setFilter({ ...filter, search: event.target.value })
            }
          />
        </label>
        <label className="v2-field">
          地区
          <select
            aria-label="按地区筛选人员"
            value={filter.region || "all"}
            onChange={(event) =>
              setFilter({
                ...filter,
                region: event.target.value as PersonnelFilter["region"],
              })
            }
          >
            <option value="all">全部地区</option>
            <option value="central">中央</option>
            {game.core.provinces.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
            <option value="unassigned">未派驻</option>
          </select>
        </label>
        <label className="v2-field">
          机构
          <select
            aria-label="按机构筛选人员"
            value={filter.institution || "all"}
            onChange={(event) =>
              setFilter({ ...filter, institution: event.target.value })
            }
          >
            <option value="all">全部机构</option>
            {offices.map((position) => (
              <option key={position.id} value={position.id}>
                {position.short}
              </option>
            ))}
          </select>
        </label>
        <label className="v2-field">
          派系
          <select
            aria-label="按派系筛选人员"
            value={filter.faction || "all"}
            onChange={(event) =>
              setFilter({
                ...filter,
                faction: event.target.value as FactionId | "all",
              })
            }
          >
            <option value="all">全部派系</option>
            {Object.entries(factionNames).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="v2-field">
          专业
          <select
            aria-label="按专业筛选人员"
            value={filter.specialty || "all"}
            onChange={(event) =>
              setFilter({
                ...filter,
                specialty: event.target.value as Domain | "all",
              })
            }
          >
            <option value="all">全部专业</option>
            {Object.entries(domainNames).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="v2-field">
          工作状态
          <select
            aria-label="按工作状态筛选人员"
            value={filter.state || "all"}
            onChange={(event) =>
              setFilter({
                ...filter,
                state: event.target.value as PersonnelWorkState | "all",
              })
            }
          >
            <option value="all">全部状态</option>
            {Object.entries(personnelStateNames).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="personnel-table-tools">
        <p role="status">
          显示 {filtered.length} / {rows.length} 人 ·
          点击列标题排序，点击人物查看详细资料
        </p>
        <label className="v2-field">
          排序字段
          <select
            aria-label="人员排序字段"
            value={sort}
            onChange={(event) => setSort(event.target.value as PersonnelSort)}
          >
            {headers.map((header) => (
              <option key={header.sort} value={header.sort}>
                {header.title}
              </option>
            ))}
            <option value="roots">职务根基</option>
          </select>
        </label>
        <button onClick={() => setFilter({})}>清除筛选</button>
      </div>
      <div
        className="personnel-table-scroll"
        role="region"
        aria-label="全国人员表"
        tabIndex={0}
        style={{
          overflow: "auto",
          maxHeight: "min(420px,42dvh)",
          border: "1px solid var(--line,#44606a)",
        }}
      >
        <table
          className="personnel-table"
          style={{
            width: "100%",
            minWidth: 1120,
            borderCollapse: "collapse",
            fontSize: "1rem",
          }}
        >
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header.sort}
                  scope="col"
                  aria-sort={
                    sort === header.sort
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "#203139",
                    textAlign: "left",
                  }}
                >
                  <button
                    onClick={() => changeSort(header.sort)}
                    aria-label={`按${header.title}排序`}
                  >
                    {header.title}
                    {sort === header.sort
                      ? direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : " ↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className={row.id === selected?.id ? "selected-person" : ""}
                aria-selected={row.id === selected?.id}
                onClick={() => selectPerson(row.id)}
              >
                <td>
                  <button
                    className="personnel-name"
                    aria-label={`查看${row.name}资料`}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectPerson(row.id);
                    }}
                  >
                    <PersonBadge id={row.id} />
                  </button>
                </td>
                <td>{row.factionName}</td>
                <td>{row.mainOfficeLabel}</td>
                <td>{row.regionLabel}</td>
                <td>{row.secondaryOfficeLabel}</td>
                <td>{row.taskLabel}</td>
                <td>
                  <strong>{domainNames[row.specialty]}专业</strong>
                  <p>{row.ability}</p>
                </td>
                <td>
                  <strong
                    className={
                      row.adminAvailable
                        ? "met"
                        : row.state === "restricted" ||
                            row.state === "dedicated" ||
                            row.state === "temporary"
                          ? "unmet"
                          : ""
                    }
                  >
                    {row.stateLabel}
                  </strong>
                  <p>
                    {row.adminAvailable
                      ? "行政能力可用"
                      : row.mainOffice
                        ? "行政能力暂不可用"
                        : "无正式行政权限"}
                  </p>
                </td>
                <td>
                  积怨 {row.grievance}/3
                  <br />
                  根基 {row.roots}/3
                  {row.promises.map((promise) => (
                    <p key={promise}>{promise}</p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="empty-state">
            没有符合当前筛选的人物；可清除筛选查看全国人员。
          </p>
        )}
      </div>
      {selected && record && (
        <section
          className="personnel-detail document-card"
          aria-label={`${selected.name}详细资料`}
        >
          <PersonBadge id={selected.id} />
          <h3>{selected.name} · 职务与工作分配</h3>
          <p>
            主职：{selected.mainOfficeLabel}；兼职：
            {selected.secondaryOfficeLabel}；派驻：{selected.regionLabel}。
          </p>
          <p>
            实际任务：{selected.taskLabel}。
            {selected.projectAvailable
              ? "可投入新的工程，仍需满足项目专业与组织条件。"
              : "当前不能同时投入另一项活动工程。"}
          </p>
          {selected.restrictions.map((restriction) => (
            <p key={restriction} className="unmet">
              {restriction}
            </p>
          ))}
          <p>
            生产 {record.skills.production} / 社会 {record.skills.social} / 异常{" "}
            {record.skills.anomaly}；积怨 {selected.grievance}/3，主职根基{" "}
            {selected.roots}/3。
          </p>
          <h4>{mechanics.trait?.title || selected.title}</h4>
          <p>{mechanics.description || record.ability}</p>
          <p>
            有效承诺：{selected.promises.join("；") || "当前无记录中的有效承诺"}
            。
          </p>
          <div
            className="personnel-appointment-fields"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 12,
            }}
          >
            <label className="v2-field">
              任免职位
              <select
                aria-label="人员详情任免职位"
                value={office}
                onChange={(event) => setOffice(event.target.value)}
              >
                {offices.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name} ·{" "}
                    {getPerson(officePerson(game, position.id))?.name || "空缺"}
                    {game.machine.secondaryAppointments?.[position.id]
                      ? "（兼职）"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="v2-field">
              工作关系
              <select
                aria-label="人员任命工作关系"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "primary" | "secondary")
                }
              >
                <option value="primary">正式主职</option>
                <option value="secondary">正式兼职</option>
              </select>
            </label>
          </div>
          <p>
            {mode === "primary"
              ? "任免消耗1命令。调任保留原规则：先免去原主职，再任命新职。免主职时同步取消其兼职；专职工程保留。"
              : "新增/更换兼职消耗1命令、1政治资本，取消兼职消耗1命令。兼职仅补空缺机构，一人最多一个主职及一个兼职。"}
          </p>
          {concurrency.map((item) => (
            <p className={item.met ? "met" : "unmet"} key={item.label}>
              {item.met ? "✓" : "✕"} {item.label}：{item.reason}
            </p>
          ))}
          <div className="quick-grid">
            <button
              className="v2-primary"
              disabled={disabled}
              onClick={() => onChoose(action as Action)}
            >
              预览{mode === "primary" ? "主职任命" : "正式兼职"}
            </button>
            {selected.mainOffice && (
              <button
                disabled={disabled}
                onClick={() =>
                  onChoose({
                    type: "appoint",
                    office: selected.mainOffice!,
                    person: null,
                  })
                }
              >
                预览免去{getOffice(selected.mainOffice)?.short || "主职"}
              </button>
            )}
            {selected.secondaryOffices.map((held) => (
              <button
                key={held}
                disabled={disabled}
                onClick={() =>
                  onChoose({
                    type: "concurrent",
                    office: held,
                    person: null,
                  } as Action)
                }
              >
                预览取消{getOffice(held)?.short}兼职
              </button>
            ))}
            {selected.grievance > 0 && (
              <button
                disabled={disabled}
                onClick={() =>
                  onChoose({ type: "mediate", person: selected.id })
                }
              >
                预览政治和解
              </button>
            )}
          </div>
          <AppointmentImpact game={game} action={action} />
          <h4>个人特征行动</h4>
          <label className="v2-field">
            行动地区
            <select
              aria-label="人物特征行动地区"
              value={skillProvince}
              onChange={(event) =>
                setSkillProvince(event.target.value as ProvinceId)
              }
            >
              {game.core.provinces.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            行动代价：{skill.costs.commands}命令 / {skill.costs.treasury}财政 /{" "}
            {skill.costs.capital}政治资本 / {skill.costs.stock}本地实物。
          </p>
          {skill.conditions.map((item) => (
            <p key={item.label} className={item.met ? "met" : "unmet"}>
              {item.met ? "✓" : "✕"} {item.label}：{item.reason}
            </p>
          ))}
          <button
            disabled={disabled}
            onClick={() =>
              onChoose({
                type: "personSkill",
                person: selected.id,
                province: skillProvince,
              } as Action)
            }
          >
            预览{selected.name} · {mechanics.trait?.title || "特征行动"}
          </button>
        </section>
      )}
    </div>
  );
}
