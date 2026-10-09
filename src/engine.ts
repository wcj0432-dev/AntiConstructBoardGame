import {
  cards,
  getCard,
  getOffice,
  getPerson,
  initialProvinces,
  issueNames,
  offices,
  people,
  domainNames,
} from "./data";
import type {
  Choice,
  Conflict,
  ConflictType,
  Domain,
  Effect,
  FactionId,
  GameState,
  Issue,
  Log,
  Preview,
  ProvinceId,
  Task,
} from "./types";
export const SAVE_KEY = "federation-worlds-v1";
const clone = <T>(v: T): T => structuredClone(v);
function log(s: GameState, text: string, kind: Log["kind"] = "info") {
  s.logs.unshift({ turn: s.turn, text, kind });
}
function hash(seed: string) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0 || 1;
}
function random(s: GameState) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
function updateFactions(s: GameState) {
  for (const id of Object.keys(s.factions) as FactionId[]) {
    s.factions[id].influence =
      Object.values(s.appointments).filter((p) => getPerson(p)?.faction === id)
        .length *
        2 +
      s.factionSupport[id];
    s.factions[id].discontent = people
      .filter((p) => p.faction === id)
      .reduce((a, p) => a + s.grievances[p.id], 0);
  }
}
function check(s: GameState) {
  if (s.crisis >= 12) {
    s.status = "lost";
    s.ending = "全国危机指标达到12，联邦进入失控状态。";
  } else if (s.insolvency >= 2) {
    s.status = "lost";
    s.ending = "连续两个季度无法履行最低财政支出，国家信用崩溃。";
  } else if (s.paralysisStreak >= 2) {
    s.status = "lost";
    s.ending = "行政阻塞连续两个季度达到4，中央机构陷入不可恢复的瘫痪。";
  }
}
function effect(s: GameState, e: Effect, pid: ProvinceId, reason: string) {
  const p = s.provinces.find((p) => p.id === pid)!;
  if (e.treasury) s.treasury = Math.max(0, s.treasury + e.treasury);
  if (e.capital) s.capital = Math.max(0, s.capital + e.capital);
  if (e.crisis) s.crisis = Math.max(0, s.crisis + e.crisis);
  if (e.stock) p.stock = Math.max(0, p.stock + e.stock);
  if (e.paralysis) s.paralysis = Math.max(0, s.paralysis + e.paralysis);
  if (e.autonomy) p.autonomy += e.autonomy;
  if (e.pressure)
    for (const [d, n] of Object.entries(e.pressure))
      p.pressure[d as Domain] = Math.max(0, p.pressure[d as Domain] + n!);
  if (e.spread)
    for (const other of s.provinces.filter((x) => x.id !== pid))
      other.pressure.social += e.spread;
  if (e.project)
    s.projects.push({
      id: `project-${s.nextId++}`,
      province: pid,
      age: 0,
      ...e.project,
    });
  const desc = describeEffect(e, pid);
  if (desc.length)
    log(
      s,
      `${reason}：${desc.join("；")}。`,
      e.crisis && e.crisis > 0 ? "bad" : "info",
    );
}
export function describeEffect(e: Effect, pid: ProvinceId): string[] {
  const p = initialProvinces.find((p) => p.id === pid)!.name;
  const a: string[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  for (const [key, label] of [
    ["treasury", "财政"],
    ["capital", "政治资本"],
    ["crisis", "危机指标"],
    ["paralysis", "行政阻塞"],
  ] as const)
    if (e[key]) a.push(`${label} ${sign(e[key]!)}`);
  if (e.stock) a.push(`${p}物资 ${sign(e.stock)}`);
  if (e.pressure)
    for (const [d, n] of Object.entries(e.pressure))
      if (n) a.push(`${p}${domainNames[d as Domain]}压力 ${sign(n!)}`);
  if (e.spread) a.push(`其他省社会压力 +${e.spread}`);
  if (e.extra) a.push(`额外揭开 ${e.extra} 张基础危机（本回合最多接纳3张）`);
  if (e.autonomy) a.push(`${p}自治 +${e.autonomy}，地方取得本领域主责`);
  if (e.project)
    a.push(
      `建立「${e.project.name}」：每回合物资 +${e.project.output}${e.project.risk ? "，每两回合异常压力 +1" : ""}`,
    );
  return a;
}
function draw(s: GameState, filter: (c: (typeof cards)[number]) => boolean) {
  let candidates = cards.filter(filter).filter((c) => !s.used.includes(c.id));
  if (!candidates.length) {
    const ids = cards.filter(filter).map((c) => c.id);
    s.used = s.used.filter((id) => !ids.includes(id));
    candidates = cards.filter(filter);
  }
  if (!candidates.length) return;
  const c = candidates[Math.floor(random(s) * candidates.length)];
  s.used.push(c.id);
  return c;
}
function admit(s: GameState, cardId: string, reveal = true, allowExtra = true) {
  const c = getCard(cardId),
    task: Task = { uid: `task-${s.nextId++}`, cardId, created: s.turn, age: 0 };
  if (s.admitted < 3) {
    s.tasks.push(task);
    s.admitted++;
  } else {
    s.backlog.push(task);
    log(s, `「${c.title}」进入公开待办栏，下季度依次接纳。`);
  }
  log(
    s,
    `揭开${c.category === "active" ? "主动局势" : c.category === "chain" ? "连锁事件" : "基础危机"}「${c.title}」。`,
  );
  if (reveal && c.reveal) {
    effect(s, c.reveal, c.province, `「${c.title}」揭开效果`);
    if (allowExtra && c.reveal.extra)
      for (let i = 0; i < c.reveal.extra; i++) {
        const extra = draw(s, (c) => c.category === "base");
        if (extra) admit(s, extra.id, true, false);
      }
  }
}
export function newGame(seed = "南岭-071", demo = true): GameState {
  const s: GameState = {
    version: 1,
    seed,
    rng: hash(seed),
    turn: 1,
    commands: 5,
    treasury: 12,
    capital: 5,
    crisis: 0,
    insolvency: 0,
    paralysis: 0,
    paralysisStreak: 0,
    status: "playing",
    provinces: clone(initialProvinces),
    appointments: Object.fromEntries(
      offices.map((o, i) => [o.id, people[i].id]),
    ),
    grievances: Object.fromEntries(people.map((p) => [p.id, 0])),
    roots: Object.fromEntries(people.map((p) => [p.id, 0])),
    politicalTriggered: [],
    factionSupport: { technocrat: 0, popular: 0, security: 0 },
    factions: {
      technocrat: { influence: 0, discontent: 0 },
      popular: { influence: 0, discontent: 0 },
      security: { influence: 0, discontent: 0 },
    },
    jurisdictions: {},
    projects: [],
    tasks: [],
    backlog: [],
    admitted: 0,
    nextId: 1,
    resolved: 0,
    policies: {
      disclosure: null,
      authority: null,
      economy: null,
      method: null,
    },
    used: [],
    logs: [],
  };
  log(s, `第1季度开始。每季度获得5枚行政命令，余量不结转。固定种子：${seed}。`);
  if (demo) {
    s.used.push("base-0");
    admit(s, "base-0");
  } else {
    const c = draw(s, (c) => c.category === "base");
    if (c) admit(s, c.id);
  }
  updateFactions(s);
  return s;
}
function opposition(s: GameState, ids: string[]) {
  return [
    ...new Set(
      ids.map((id) => s.appointments[id]).filter((id): id is string => !!id),
    ),
  ];
}
export function preview(s: GameState, uid: string, choice: Choice): Preview {
  const task = s.tasks.find((t) => t.uid === uid);
  if (!task) throw new Error("事务不在立即处理区");
  const card = getCard(task.cardId),
    option = card.options.find((o) => o.id === choice.optionId);
  if (!option) throw new Error("无效方案");
  const key = `${card.province}:${card.domain}`,
    lead = s.jurisdictions[key] || card.lead;
  const participantIds = [...new Set([lead, ...card.participants])];
  const participants = participantIds.map((id) => ({
    office: getOffice(id),
    person: getPerson(s.appointments[id]),
  }));
  const leader = getPerson(s.appointments[lead]);
  const valid = participants.filter(
    (p) => p.person && (p.office.id === lead || s.grievances[p.person.id] < 3),
  );
  let ability = valid.reduce(
    (sum, p) => sum + p.person!.skills[card.domain],
    0,
  );
  if (leader?.specialty === card.domain) ability++;
  if (leader && s.factions[leader.faction].influence >= 4) {
    if (
      (card.domain === "anomaly" && leader.faction === "security") ||
      (card.domain === "production" && leader.faction === "technocrat") ||
      (card.domain === "social" && leader.faction === "popular")
    )
      ability++;
  }
  if (leader && s.factions[leader.faction].discontent >= 4)
    ability = Math.max(0, ability - 1);
  const conflicts: Conflict[] = [];
  const add = (
    type: ConflictType,
    title: string,
    reason: string,
    opponents: string[],
  ) => {
    const strategy = choice.strategies[type] || "coordinate";
    let commands = 0,
      treasury = 0,
      capital = 0,
      future = "";
    if (strategy === "force") {
      future = opponents.length
        ? `${opponents.map((id) => getPerson(id)!.name).join("、") || "相关负责人"}各积怨 +1；达到3会拒绝协办并触发政治事件。`
        : "负责人空缺，不产生人物积怨；实际征调资源损失仍然发生。";
    } else if (strategy === "compensate" && type === "interest") {
      treasury = 2;
      future = "补偿地方财政：地方库存 +1、社会压力 -1。";
    } else if (strategy === "delegate" && type === "interest") {
      capital = 1;
      future = `让渡${card.domain === "anomaly" ? "异常" : domainNames[card.domain]}主责给省政府，地方自治 +1。`;
    } else if (strategy === "negotiate" && type === "route") {
      capital = 1;
      future = "以政治资本换取本次路线协议，不增加积怨。";
    } else {
      commands = 1;
      future = "支付1命令形成临时协调协议，仅对本次事务有效。";
    }
    conflicts.push({
      type,
      title,
      reason,
      opponents,
      strategy,
      commands,
      treasury,
      capital,
      future,
    });
  };
  const claimants = participants.filter(
    (p) =>
      p.person &&
      p.office.domains.includes(card.domain) &&
      (!p.office.province || p.office.province === card.province),
  );
  if (!s.jurisdictions[key] && claimants.length > 1)
    add(
      "jurisdiction",
      "事权冲突",
      `${claimants.map((p) => p.office.name).join("与")}均有${domainNames[card.domain]}管辖权限，互不隶属且要求主责。`,
      opposition(
        s,
        claimants.filter((p) => p.office.id !== lead).map((p) => p.office.id),
      ),
    );
  const against = valid.filter(
    (p) => p.person!.stance[option.issue] !== option.side,
  );
  if (against.length)
    add(
      "route",
      "路线冲突",
      `${against.map((p) => p.person!.name).join("、")}参与本事务，反对「${issueNames[option.issue][option.side]}」路线。`,
      against.map((p) => p.person!.id),
    );
  const gov = `gov-${card.province}`;
  if (option.stock > 0)
    add(
      "interest",
      "利益冲突",
      `${getOffice(gov).name}将被征调${option.stock}物资，尚无补偿或征调协议。`,
      opposition(s, [gov]),
    );
  const resentmentCost = leader && s.grievances[leader.id] >= 2 ? 1 : 0;
  const policyCost =
    s.policies[option.issue] !== null &&
    s.policies[option.issue] !== option.side
      ? 1
      : 0;
  const base = option.commands + policyCost,
    commands =
      base + resentmentCost + conflicts.reduce((a, c) => a + c.commands, 0),
    treasury = option.treasury + conflicts.reduce((a, c) => a + c.treasury, 0),
    capital = conflicts.reduce((a, c) => a + c.capital, 0);
  const province = s.provinces.find((p) => p.id === card.province)!;
  const errors: string[] = [];
  if (s.status !== "playing") errors.push("本局已经结束");
  for (const c of conflicts) {
    const allowed =
      c.type === "jurisdiction"
        ? ["coordinate", "force"]
        : c.type === "route"
          ? ["coordinate", "force", "negotiate"]
          : ["coordinate", "force", "compensate", "delegate"];
    if (!allowed.includes(c.strategy)) errors.push("无效冲突处理方式");
  }
  if (!leader) errors.push(`${getOffice(lead).name}负责人空缺，无法主持事务`);
  if (ability < option.ability)
    errors.push(`专业能力不足：${ability} / ${option.ability}`);
  if (s.commands < commands) errors.push("行政命令不足");
  if (s.treasury < treasury) errors.push("中央财政不足");
  if (s.capital < capital) errors.push("政治资本不足");
  if (province.stock < option.stock) errors.push(`${province.name}物资不足`);
  return {
    task,
    card,
    option,
    participants,
    lead,
    ability,
    required: option.ability,
    conflicts,
    base,
    resentmentCost,
    commands,
    treasury,
    capital,
    stock: option.stock,
    after: {
      commands: s.commands - commands,
      treasury: s.treasury - treasury,
      capital: s.capital - capital,
      stock: province.stock - option.stock,
    },
    final: {
      commands: s.commands - commands,
      treasury: Math.max(
        0,
        s.treasury - treasury + (option.effect.treasury || 0),
      ),
      capital: Math.max(0, s.capital - capital + (option.effect.capital || 0)),
      stock: Math.max(
        0,
        province.stock -
          option.stock +
          (option.effect.stock || 0) +
          conflicts.filter(
            (c) => c.type === "interest" && c.strategy === "compensate",
          ).length,
      ),
    },
    errors,
    effects: [
      ...describeEffect(option.effect, card.province),
      ...(policyCost ? ["方案偏离全国政策：原始命令成本 +1"] : []),
      ...participants
        .filter(
          (p) =>
            p.person && p.office.id !== lead && s.grievances[p.person.id] >= 3,
        )
        .map((p) => `${p.person!.name}因积怨达到3拒绝协办，未计入能力`),
    ],
  };
}
function grievance(s: GameState, id: string, reason: string) {
  const prev = s.grievances[id];
  s.grievances[id] = Math.min(3, prev + 1);
  log(
    s,
    `${reason}，${getPerson(id)!.name}积怨 ${prev} → ${s.grievances[id]}。`,
    "bad",
  );
  if (s.grievances[id] === 3 && !s.politicalTriggered.includes(id)) {
    s.politicalTriggered.push(id);
    s.crisis++;
    log(
      s,
      `${getPerson(id)!.name}积怨达到3，触发政治事件「拒绝协办」：危机指标 +1；今后协办能力不再生效。`,
      "bad",
    );
  }
}
export function execute(s: GameState, uid: string, choice: Choice): GameState {
  const p = preview(s, uid, choice);
  if (p.errors.length) throw new Error(p.errors.join("；"));
  const n = clone(s);
  n.commands -= p.commands;
  n.treasury -= p.treasury;
  n.capital -= p.capital;
  const province = n.provinces.find((x) => x.id === p.card.province)!;
  province.stock -= p.stock;
  log(
    n,
    `完成「${p.card.title}」→ ${p.option.name}：命令 -${p.commands}，财政 -${p.treasury}，政治资本 -${p.capital}，${province.name}物资 -${p.stock}。`,
    "good",
  );
  for (const c of p.conflicts) {
    log(n, `${c.title}：${c.reason} 处理：${c.future}`);
    if (c.strategy === "force")
      for (const id of c.opponents) grievance(n, id, `强制越过${c.title}`);
    if (c.strategy === "compensate" && c.type === "interest")
      effect(
        n,
        { stock: 1, pressure: { social: -1 } },
        p.card.province,
        "中央支付补偿",
      );
    if (c.strategy === "delegate" && c.type === "interest") {
      n.jurisdictions[`${p.card.province}:${p.card.domain}`] =
        `gov-${p.card.province}`;
      effect(n, { autonomy: 1 }, p.card.province, "以权限补偿征调");
    }
  }
  effect(n, p.option.effect, p.card.province, p.option.name);
  if (p.option.effect.autonomy)
    n.jurisdictions[`${p.card.province}:${p.card.domain}`] =
      `gov-${p.card.province}`;
  for (const participant of p.participants)
    if (
      participant.person &&
      participant.person.stance[p.option.issue] === p.option.side
    )
      n.factionSupport[participant.person.faction] = Math.min(
        6,
        n.factionSupport[participant.person.faction] + 1,
      );
  n.tasks = n.tasks.filter((t) => t.uid !== uid);
  n.resolved++;
  updateFactions(n);
  check(n);
  return n;
}
function playable(s: GameState, cost = 0) {
  if (s.status !== "playing") throw new Error("本局已经结束");
  if (s.commands < cost) throw new Error("行政命令不足");
}
export function appoint(
  s: GameState,
  officeId: string,
  personId: string | null,
): GameState {
  playable(s, 1);
  if (
    !offices.some((o) => o.id === officeId) ||
    (personId && !getPerson(personId))
  )
    throw new Error("非法人事任命");
  if (s.appointments[officeId] === personId) throw new Error("该职位无需调整");
  if (
    personId &&
    Object.entries(s.appointments).some(
      ([o, p]) => o !== officeId && p === personId,
    )
  )
    throw new Error("该人物已任职，请先免职，禁止重复占位");
  const n = clone(s),
    old = n.appointments[officeId];
  n.commands--;
  n.appointments[officeId] = personId;
  if (old && n.roots[old] >= 2)
    grievance(n, old, `撤换已形成职务根基的${getOffice(officeId).name}负责人`);
  if (old) n.roots[old] = 0;
  if (personId) n.roots[personId] = 0;
  log(
    n,
    `人事调整：${getOffice(officeId).name}，${getPerson(old)?.name || "空缺"} → ${getPerson(personId)?.name || "空缺"}；人事调整消耗1命令。`,
  );
  updateFactions(n);
  return n;
}
export function reform(
  s: GameState,
  pid: ProvinceId,
  domain: Domain,
  officeId: string,
): GameState {
  playable(s, 1);
  const o = getOffice(officeId);
  if (!o || !o.domains.includes(domain) || (o.province && o.province !== pid))
    throw new Error("机构不具备该管辖资格");
  const key = `${pid}:${domain}`;
  if (s.jurisdictions[key] === officeId)
    throw new Error("当前权限已经授予该机构");
  const securityCost =
    officeId.startsWith("gov-") &&
    domain === "anomaly" &&
    s.factions.security.influence >= 4
      ? 1
      : 0;
  const cost = 2 + securityCost;
  if (s.capital < cost) throw new Error("政治资本不足");
  const n = clone(s);
  n.commands--;
  n.capital -= cost;
  n.jurisdictions[key] = officeId;
  if (o.province) n.provinces.find((p) => p.id === pid)!.autonomy++;
  log(
    n,
    `组织改革：${initialProvinces.find((p) => p.id === pid)!.name}${domainNames[domain]}主责授予${o.name}，后续同类事务不再产生事权冲突。命令 -1，政治资本 -${cost}${securityCost ? "（安全集团影响力 ≥4，改革阻力 +1）" : ""}${o.province ? "，地方自治 +1" : ""}。`,
    "good",
  );
  return n;
}
export function policy(s: GameState, issue: Issue, side: number): GameState {
  playable(s, 1);
  if (side !== 0 && side !== 1) throw new Error("无效政策");
  if (s.policies[issue] === side) throw new Error("政策无需变更");
  if (s.capital < 1) throw new Error("政治资本不足");
  const n = clone(s);
  n.commands--;
  n.capital--;
  n.policies[issue] = side;
  for (const id of Object.values(n.appointments))
    if (id) {
      const p = getPerson(id)!;
      if (p.stance[issue] === side)
        n.factionSupport[p.faction] = Math.min(
          6,
          n.factionSupport[p.faction] + 1,
        );
    }
  log(
    n,
    `全国政策调整为「${issueNames[issue][side]}」：命令 -1、政治资本 -1。后续偏离该政策的方案额外消耗1命令；支持派系影响力提升。`,
  );
  updateFactions(n);
  return n;
}
export function transfer(
  s: GameState,
  from: ProvinceId,
  to: ProvinceId,
  force = false,
): GameState {
  playable(s, force ? 1 : 2);
  if (from === to) throw new Error("请选择不同省份");
  const source = s.provinces.find((p) => p.id === from),
    target = s.provinces.find((p) => p.id === to);
  if (!source || !target) throw new Error("非法省份");
  if (source.stock < 2) throw new Error("调出省物资不足");
  const n = clone(s);
  n.commands -= force ? 1 : 2;
  n.provinces.find((p) => p.id === from)!.stock -= 2;
  n.provinces.find((p) => p.id === to)!.stock += 2;
  log(
    n,
    `${source.name}向${target.name}调拨2物资：${force ? "强制征调，命令 -1" : "支付1命令调拨及1命令利益协商，共 -2"}。`,
  );
  if (force && n.appointments[`gov-${from}`])
    grievance(
      n,
      n.appointments[`gov-${from}`]!,
      `${source.name}未获补偿被征调物资，产生利益冲突`,
    );
  updateFactions(n);
  check(n);
  return n;
}
export function investigate(
  s: GameState,
  deck: "survey" | "build" | "reform",
): GameState {
  playable(s, 1);
  const n = clone(s);
  n.commands--;
  const c = draw(n, (c) => c.category === "active" && c.deck === deck);
  if (!c) throw new Error("无对应牌堆");
  admit(n, c.id);
  log(n, "主动调查消耗1命令。揭牌后果已经生效，放弃机会不会撤回后果。");
  check(n);
  return n;
}
export function abandon(s: GameState, uid: string): GameState {
  playable(s);
  const t = s.tasks.find((t) => t.uid === uid);
  if (!t || getCard(t.cardId).category !== "active")
    throw new Error("只能放弃主动机会");
  const n = clone(s);
  n.tasks = n.tasks.filter((t) => t.uid !== uid);
  log(
    n,
    `放弃「${getCard(t.cardId).title}」的投资机会；已经产生的揭牌压力保留。`,
  );
  return n;
}
export function mediate(s: GameState, id: string): GameState {
  playable(s, 1);
  if (!getPerson(id) || s.grievances[id] === 0)
    throw new Error("该人物无需调解");
  if (s.capital < 1) throw new Error("政治资本不足");
  const n = clone(s);
  n.commands--;
  n.capital--;
  n.grievances[id]--;
  log(
    n,
    `与${getPerson(id)!.name}达成政治和解：命令 -1，政治资本 -1，积怨降至${n.grievances[id]}；一次政治事件记录保留。`,
    "good",
  );
  updateFactions(n);
  return n;
}
export function unblock(s: GameState): GameState {
  playable(s, 1);
  if (s.paralysis === 0) throw new Error("当前没有行政阻塞");
  if (s.treasury < 1) throw new Error("财政不足");
  const n = clone(s);
  n.commands--;
  n.treasury--;
  n.paralysis = Math.max(0, n.paralysis - 2);
  log(n, "紧急疏通行政：命令 -1，财政 -1，行政阻塞 -2。", "good");
  return n;
}
export function endTurn(s: GameState): GameState {
  playable(s);
  const n = clone(s);
  log(n, `第${n.turn}季度结算：未用命令${n.commands}不结转。`);
  for (const p of n.provinces) {
    const output = p.districts.reduce((a, d) => a + d.output, 0);
    p.stock += output;
    log(n, `${p.name}地区生产：物资 +${output}。`);
  }
  for (const project of n.projects) {
    project.age++;
    const p = n.provinces.find((p) => p.id === project.province)!;
    p.stock += project.output;
    log(n, `「${project.name}」运行：${p.name}物资 +${project.output}。`);
    if (project.risk && project.age % 2 === 0)
      effect(
        n,
        { pressure: { anomaly: 1 } },
        project.province,
        `「${project.name}」两季度运行风险`,
      );
  }
  log(n, "先履行最低行政支出4财政，再收到联邦税收5财政。");
  if (n.treasury >= 4) {
    n.treasury -= 4;
    n.insolvency = 0;
  } else {
    n.insolvency++;
    n.treasury = 0;
    log(n, `最低支出未能履行，连续财政违约 ${n.insolvency}/2。`, "bad");
  }
  n.treasury += 5;
  for (const t of n.tasks) {
    t.age++;
    const c = getCard(t.cardId);
    if (c.category === "active") {
      if (t.age >= 2) log(n, `「${c.title}」投资窗口关闭；揭牌后果保留。`);
      continue;
    }
    effect(
      n,
      c.consequence,
      c.province,
      `未处理「${c.title}」恶化（延期${t.age}/3）`,
    );
    if (t.age >= 3) {
      n.crisis++;
      log(n, `「${c.title}」已超过3季度时限，事务失效并额外增加1危机。`, "bad");
    }
  }
  n.tasks = n.tasks.filter(
    (t) => t.age < (getCard(t.cardId).category === "active" ? 2 : 3),
  );
  for (const id of Object.values(n.appointments))
    if (id) n.roots[id] = Math.min(3, n.roots[id] + 1);
  n.capital += 1;
  log(n, "例行政治议程：政治资本 +1。");
  n.paralysisStreak = n.paralysis >= 4 ? n.paralysisStreak + 1 : 0;
  if (n.paralysis >= 2)
    log(
      n,
      `行政瘫痪预警：阻塞${n.paralysis}，下季度命令减少1（至少4）；连续两个季度阻塞 ≥4 将失败。可使用紧急疏通。`,
      "bad",
    );
  updateFactions(n);
  check(n);
  if (n.status !== "playing") return n;
  if (n.turn === 8) {
    n.status = "won";
    n.ending =
      n.crisis < 4
        ? "在矛盾中维持秩序。八个季度过去，诸界联邦仍有继续协商的余地。"
        : "联邦艰难度过八个季度。危机尚未散去，但国家机器仍然运转。";
    return n;
  }
  n.turn++;
  n.commands = n.paralysis >= 2 ? 4 : 5;
  n.admitted = 0;
  log(n, `第${n.turn}季度开始：行政命令重置为${n.commands}。`);
  while (n.backlog.length && n.admitted < 3) {
    const t = n.backlog.shift()!;
    t.created = n.turn;
    t.age = 0;
    n.tasks.push(t);
    n.admitted++;
    log(n, `待办「${getCard(t.cardId).title}」进入立即处理区。`);
  }
  // Snapshot thresholds before revealing cards; newly introduced pressure waits until next turn.
  const triggers = n.provinces.flatMap((p) =>
    (Object.keys(p.pressure) as Domain[])
      .filter((d) => p.pressure[d] >= 2)
      .map((d) => ({ pid: p.id, domain: d })),
  );
  for (const trigger of triggers) {
    const p = n.provinces.find((p) => p.id === trigger.pid)!;
    p.pressure[trigger.domain] -= 2;
    const c = draw(
      n,
      (c) =>
        c.category === "chain" &&
        c.province === trigger.pid &&
        c.domain === trigger.domain,
    );
    if (!c) throw new Error("缺少同省同类连锁事件数据");
    admit(n, c.id);
  }
  const c = draw(n, (c) => c.category === "base");
  if (c) admit(n, c.id);
  check(n);
  return n;
}
export function serialize(s: GameState) {
  return JSON.stringify(s);
}
export function deserialize(raw: string): GameState {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error("存档不是有效的JSON");
  }
  if (!v || typeof v !== "object") throw new Error("存档格式不正确");
  const s = v as GameState;
  const numeric = [
    "rng",
    "turn",
    "commands",
    "treasury",
    "capital",
    "crisis",
    "insolvency",
    "paralysis",
    "paralysisStreak",
    "nextId",
    "resolved",
    "admitted",
  ] as const;
  if (
    s.version !== 1 ||
    typeof s.seed !== "string" ||
    numeric.some((k) => !Number.isInteger(s[k]) || s[k] < 0) ||
    s.turn < 1 ||
    s.turn > 8 ||
    !["playing", "won", "lost"].includes(s.status)
  )
    throw new Error("存档版本或资源无效");
  if (
    !Array.isArray(s.provinces) ||
    s.provinces.length !== 3 ||
    initialProvinces.some((p) => !s.provinces.some((x) => x.id === p.id)) ||
    s.provinces.some(
      (p) =>
        !Number.isInteger(p.stock) ||
        p.stock < 0 ||
        !p.pressure ||
        (["production", "social", "anomaly"] as Domain[]).some(
          (d) => !Number.isInteger(p.pressure[d]) || p.pressure[d] < 0,
        ),
    )
  )
    throw new Error("存档地区数据无效");
  if (
    !s.appointments ||
    offices.some((o) => !(o.id in s.appointments)) ||
    Object.keys(s.appointments).some((id) => !offices.some((o) => o.id === id))
  )
    throw new Error("存档职位无效");
  const occupied = Object.values(s.appointments).filter(Boolean);
  if (
    new Set(occupied).size !== occupied.length ||
    occupied.some((id) => !getPerson(id))
  )
    throw new Error("存档存在重复或非法任命");
  if (
    !s.grievances ||
    !s.roots ||
    people.some(
      (p) =>
        !Number.isInteger(s.grievances[p.id]) ||
        s.grievances[p.id] < 0 ||
        s.grievances[p.id] > 3 ||
        !Number.isInteger(s.roots[p.id]) ||
        s.roots[p.id] < 0 ||
        s.roots[p.id] > 3,
    )
  )
    throw new Error("存档人物数据无效");
  if (
    !Array.isArray(s.tasks) ||
    !Array.isArray(s.backlog) ||
    [...s.tasks, ...s.backlog].some(
      (t) =>
        !getCard(t.cardId) ||
        typeof t.uid !== "string" ||
        !Number.isInteger(t.age),
    ) ||
    new Set([...s.tasks, ...s.backlog].map((t) => t.uid)).size !==
      s.tasks.length + s.backlog.length
  )
    throw new Error("存档事件无效");
  if (
    !s.factions ||
    !s.factionSupport ||
    !s.jurisdictions ||
    !s.policies ||
    !Array.isArray(s.logs) ||
    !Array.isArray(s.used) ||
    !Array.isArray(s.projects) ||
    !Array.isArray(s.politicalTriggered)
  )
    throw new Error("存档缺少规则状态");
  if (
    (["technocrat", "popular", "security"] as FactionId[]).some(
      (id) =>
        !s.factions[id] ||
        !Number.isInteger(s.factionSupport[id]) ||
        s.factionSupport[id] < 0 ||
        s.factionSupport[id] > 6,
    ) ||
    (Object.keys(issueNames) as Issue[]).some(
      (id) => !(id in s.policies) || ![null, 0, 1].includes(s.policies[id]),
    )
  )
    throw new Error("存档派系或政策数据无效");
  if (
    s.provinces.some(
      (p) =>
        !Number.isInteger(p.autonomy) ||
        p.autonomy < 0 ||
        !Array.isArray(p.districts) ||
        p.districts.length !== 2 ||
        p.districts.some(
          (d) =>
            typeof d.name !== "string" ||
            typeof d.type !== "string" ||
            !Number.isInteger(d.output) ||
            d.output < 0,
        ),
    ) ||
    s.projects.some(
      (p) =>
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        !initialProvinces.some((x) => x.id === p.province) ||
        !Number.isInteger(p.age) ||
        p.age < 0 ||
        !Number.isInteger(p.output) ||
        p.output < 0 ||
        typeof p.risk !== "boolean",
    )
  )
    throw new Error("存档地区或项目结构无效");
  if (
    s.logs.some(
      (l) =>
        typeof l.text !== "string" ||
        !Number.isInteger(l.turn) ||
        !["info", "good", "bad"].includes(l.kind),
    ) ||
    s.used.some((id) => !getCard(id)) ||
    s.politicalTriggered.some((id) => !getPerson(id))
  )
    throw new Error("存档日志或事件记录无效");
  for (const [key, id] of Object.entries(s.jurisdictions)) {
    const [pid, d] = key.split(":");
    const o = getOffice(id);
    if (
      !initialProvinces.some((p) => p.id === pid) ||
      !o ||
      !o.domains.includes(d as Domain) ||
      (o.province && o.province !== pid)
    )
      throw new Error("存档管辖权限无效");
  }
  updateFactions(s);
  return s;
}
