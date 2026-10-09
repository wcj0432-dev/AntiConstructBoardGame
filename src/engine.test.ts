import { describe, it, expect } from "vitest";
import {
  abandon,
  appoint,
  deserialize,
  endTurn,
  execute,
  investigate,
  mediate,
  newGame,
  policy,
  preview,
  reform,
  serialize,
  transfer,
  unblock,
} from "./engine";
import { cards, getCard } from "./data";
import type { Choice, GameState } from "./types";
const coordinated: Choice = { optionId: "public", strategies: {} };
const forced: Choice = {
  optionId: "public",
  strategies: { jurisdiction: "force", route: "force", interest: "force" },
};
const task = (s: GameState) => s.tasks[0].uid;
describe("南岭灵脉电站 · 三路径验收", () => {
  it("按实际事务触发三类冲突，并可解释", () => {
    const s = newGame();
    const p = preview(s, task(s), coordinated);
    expect(p.conflicts.map((c) => c.type)).toEqual([
      "jurisdiction",
      "route",
      "interest",
    ]);
    expect(p.conflicts[1].opponents).toEqual(["sergei"]);
    expect(p.conflicts[2].opponents).toEqual(["bai"]);
    expect(p.commands).toBe(4);
    expect(p.errors).toEqual([]);
  });
  it("未参与者的立场不会触发路线冲突", () => {
    const s = newGame();
    s.appointments.anomaly = "mo";
    const p = preview(s, task(s), coordinated);
    expect(p.conflicts.find((c) => c.type === "route")?.opponents).toEqual([
      "mo",
    ]);
    expect(p.conflicts.flatMap((c) => c.opponents)).not.toContain("qi");
  });
  it("正常协调消耗4命令，无新增积怨", () => {
    const s = newGame();
    const n = execute(s, task(s), coordinated);
    expect(n.commands).toBe(1);
    expect(n.treasury).toBe(11);
    expect(n.provinces[1].stock).toBe(4);
    expect(n.grievances.sergei).toBe(0);
    expect(n.grievances.bai).toBe(0);
    expect(s.commands).toBe(5);
  });
  it("强制只需1命令，积怨指向受损者而非所有人物", () => {
    const s = newGame();
    const n = execute(s, task(s), forced);
    expect(n.commands).toBe(4);
    expect(n.grievances.sergei).toBe(1);
    expect(n.grievances.bai).toBe(2);
    expect(n.grievances.lin).toBe(0);
  });
  it("改革先付1命令2资本，永久消除同类事权争夺", () => {
    const s = reform(newGame(), "south", "anomaly", "anomaly");
    const p = preview(s, task(s), coordinated);
    expect(p.commands).toBe(3);
    expect(p.conflicts.map((c) => c.type)).toEqual(["route", "interest"]);
    const n = execute(s, task(s), coordinated);
    expect(n.commands).toBe(1);
    expect(n.capital).toBe(4);
    expect(n.jurisdictions["south:anomaly"]).toBe("anomaly");
  });
  it("财政补偿与权限补偿各有明确代价", () => {
    const s = newGame();
    const paid = execute(s, task(s), {
      ...forced,
      strategies: { ...forced.strategies, interest: "compensate" },
    });
    expect(paid.treasury).toBe(9);
    expect(paid.provinces[1].stock).toBe(5);
    expect(paid.grievances.bai).toBe(1);
    const delegated = execute(s, task(s), {
      ...forced,
      strategies: { ...forced.strategies, interest: "delegate" },
    });
    expect(delegated.capital).toBe(5);
    expect(delegated.provinces[1].autonomy).toBe(1);
    expect(delegated.jurisdictions["south:anomaly"]).toBe("gov-south");
  });
  it("预览成本和执行结算一致，预览不修改状态", () => {
    const s = newGame();
    const raw = serialize(s);
    const p = preview(s, task(s), coordinated);
    expect(serialize(s)).toBe(raw);
    const n = execute(s, task(s), coordinated);
    expect(n.commands).toBe(p.after.commands);
    expect(n.treasury).toBe(p.after.treasury);
    expect(n.capital).toBe(p.after.capital + 1);
    expect(n.provinces[1].stock).toBe(p.after.stock);
    expect(n.resolved).toBe(1);
  });
});
describe("职位、权限、积怨与派系", () => {
  it("空缺机构不争夺事权，但主责空缺无法执行", () => {
    const s = appoint(newGame(), "gov-south", null);
    expect(
      preview(s, task(s), coordinated).conflicts.some(
        (c) => c.type === "jurisdiction",
      ),
    ).toBe(false);
    const n = appoint(newGame(), "anomaly", null);
    expect(preview(n, task(n), coordinated).errors.join()).toContain(
      "负责人空缺",
    );
  });
  it("免职再任命改变事务参与者与路线", () => {
    let s = appoint(newGame(), "anomaly", null);
    s = appoint(s, "anomaly", "xing");
    expect(
      preview(s, task(s), coordinated).conflicts.some(
        (c) => c.type === "route",
      ),
    ).toBe(false);
  });
  it("禁止非法任命和一人多职", () => {
    expect(() => appoint(newGame(), "anomaly", "lin")).toThrow("已任职");
    expect(() => appoint(newGame(), "missing", "xing")).toThrow();
    expect(() => appoint(newGame(), "anomaly", "missing")).toThrow();
  });
  it("积怨2产生主持阻力，积怨3拒绝协办并触发一次政治事件", () => {
    const s = newGame();
    s.grievances.sergei = 2;
    expect(preview(s, task(s), forced).resentmentCost).toBe(1);
    const n = execute(s, task(s), forced);
    expect(n.grievances.sergei).toBe(3);
    expect(n.politicalTriggered).toContain("sergei");
    expect(n.logs.some((l) => l.text.includes("拒绝协办"))).toBe(true);
    const second = structuredClone(n);
    second.tasks = [{ uid: "again", cardId: "base-0", age: 0, created: 1 }];
    second.commands = 5;
    second.grievances.bai = 3;
    const p = preview(second, "again", forced);
    expect(p.effects.join()).toContain("白芷因积怨达到3拒绝协办");
    expect(p.ability).toBeLessThan(preview(s, task(s), forced).ability);
    const n2 = execute(second, "again", forced);
    expect(n2.politicalTriggered.filter((id) => id === "sergei")).toHaveLength(
      1,
    );
  });
  it("调解有成本且恢复协办", () => {
    const s = newGame();
    s.grievances.bai = 3;
    const n = mediate(s, "bai");
    expect(n.grievances.bai).toBe(2);
    expect(n.commands).toBe(4);
    expect(n.capital).toBe(4);
  });
  it("职务根基达到2后免职产生积怨", () => {
    const s = newGame();
    s.roots.sergei = 2;
    expect(appoint(s, "anomaly", null).grievances.sergei).toBe(1);
  });
  it("安全集团强势时限制地方异常权限改革", () => {
    const s = newGame();
    s.factions.security.influence = 4;
    const n = reform(s, "south", "anomaly", "gov-south");
    expect(n.capital).toBe(2);
    expect(n.provinces[1].autonomy).toBe(1);
  });
  it("全国政策偏离改变原始成本", () => {
    const s = policy(newGame(), "disclosure", 0);
    expect(preview(s, task(s), coordinated).base).toBe(2);
  });
  it("资源征调关联调出省负责人，协商明确消耗", () => {
    const s = newGame();
    const n = transfer(s, "south", "north", true);
    expect(n.grievances.bai).toBe(1);
    expect(n.grievances.ye).toBe(0);
    expect(n.provinces[1].stock).toBe(4);
    expect(n.provinces[2].stock).toBe(8);
    expect(transfer(s, "south", "north").commands).toBe(3);
  });
});
describe("事件、回合与资源安全", () => {
  it("提供12人物、各12张事件，连锁覆盖全部省/压力组合", () => {
    expect(cards.filter((c) => c.category === "base")).toHaveLength(12);
    expect(cards.filter((c) => c.category === "chain")).toHaveLength(12);
    expect(cards.filter((c) => c.category === "active")).toHaveLength(12);
    for (const pid of ["industry", "south", "north"])
      for (const d of ["production", "social", "anomaly"])
        expect(
          cards.some(
            (c) =>
              c.category === "chain" && c.province === pid && c.domain === d,
          ),
        ).toBe(true);
  });
  it("压力在下季度生成同省同类连锁并消耗2，不立即递归", () => {
    const s = execute(newGame(), task(newGame()), coordinated);
    s.provinces[1].pressure.production = 2;
    expect(s.tasks).toHaveLength(0);
    const n = endTurn(s);
    expect(
      n.tasks.some((t) => {
        const c = getCard(t.cardId);
        return (
          c.category === "chain" &&
          c.domain === "production" &&
          c.province === "south"
        );
      }),
    ).toBe(true);
    expect(n.provinces[1].pressure.production).toBe(0);
  });
  it("重大危机多翻3牌，接纳上限3，额外牌不再递归", () => {
    const s = execute(newGame(), task(newGame()), coordinated);
    s.used = cards
      .filter((c) => c.category === "base" && c.id !== "base-9")
      .map((c) => c.id);
    const n = endTurn(s);
    expect(n.logs.some((l) => l.text.includes("三界共振灾难"))).toBe(true);
    expect(n.tasks).toHaveLength(3);
    expect(n.backlog).toHaveLength(1);
    expect(
      n.logs.filter((l) => l.text.startsWith("揭开基础危机")),
    ).toHaveLength(5);
  });
  it("待办公开且下季优先接纳，不计未处理惩罚", () => {
    const s = execute(newGame(), task(newGame()), coordinated);
    s.backlog = [{ uid: "queued", cardId: "base-3", created: 1, age: 0 }];
    const n = endTurn(s);
    expect(n.tasks[0].uid).toBe("queued");
    expect(n.tasks[0].age).toBe(0);
    expect(n.crisis).toBe(0);
  });
  it("主动揭牌即产生压力，放弃也保留后果", () => {
    const s = newGame();
    const n = investigate(s, "survey");
    const t = n.tasks.find((t) => getCard(t.cardId).category === "active")!;
    const c = getCard(t.cardId);
    expect(n.commands).toBe(4);
    expect(
      n.provinces.find((p) => p.id === c.province)!.pressure[c.domain],
    ).toBe(1);
    const result = abandon(n, t.uid);
    expect(result.provinces).toEqual(n.provinces);
  });
  it("项目产出与第二季度运行风险正确触发", () => {
    const s = newGame();
    s.tasks = [{ uid: "project", cardId: "active-0", created: 1, age: 0 }];
    const n = execute(s, "project", {
      optionId: "invest",
      strategies: { jurisdiction: "force", route: "force" },
    });
    expect(n.projects).toHaveLength(1);
    const q2 = endTurn(n);
    expect(q2.provinces[1].stock).toBe(11);
    const q3 = endTurn(q2);
    expect(q3.projects[0].age).toBe(2);
    expect(q3.logs.some((l) => l.text.includes("两季度运行风险"))).toBe(true);
  });
  it("不足资源会阻止执行，而不是无理由负数", () => {
    const s = newGame();
    s.commands = 0;
    expect(() => execute(s, task(s), coordinated)).toThrow("命令不足");
    s.commands = 5;
    s.provinces[1].stock = 1;
    expect(() => execute(s, task(s), forced)).toThrow("物资不足");
    s.provinces[1].stock = 6;
    s.treasury = 0;
    expect(() => execute(s, task(s), coordinated)).toThrow("财政不足");
    expect(() => transfer(s, "industry", "industry")).toThrow();
  });
  it("危机延期3季失效，未处理恶化原因可追溯", () => {
    const s = newGame();
    s.tasks[0].age = 2;
    const n = endTurn(s);
    expect(n.tasks.some((t) => t.uid === task(s))).toBe(false);
    expect(n.crisis).toBe(2);
    expect(n.logs.some((l) => l.text.includes("超过3季度时限"))).toBe(true);
  });
  it("行政瘫痪有预警且可缓解", () => {
    const s = newGame();
    s.paralysis = 2;
    const n = endTurn(s);
    expect(n.commands).toBe(4);
    expect(n.status).toBe("playing");
    expect(n.logs.some((l) => l.text.includes("行政瘫痪预警"))).toBe(true);
    const recovered = unblock(n);
    expect(recovered.paralysis).toBe(0);
    expect(recovered.treasury).toBe(n.treasury - 1);
  });
  it("危机达到上限或连续行政瘫痪触发失败", () => {
    const s = newGame();
    s.crisis = 11;
    expect(endTurn(s).status).toBe("lost");
    const blocked = newGame();
    blocked.paralysis = 4;
    blocked.paralysisStreak = 1;
    expect(endTurn(blocked).status).toBe("lost");
  });
  it("相同seed和操作完全可复现", () => {
    let a = newGame("固定测试"),
      b = newGame("固定测试");
    for (let i = 0; i < 4; i++) {
      a = endTurn(a);
      b = endTurn(b);
    }
    expect(a).toEqual(b);
  });
  it("从新游戏正常处理事务完成8季度并得到结局", () => {
    let s = newGame("南岭-071");
    for (let turn = 1; turn <= 8; turn++) {
      for (const t of [...s.tasks]) {
        const coordinatedPreview = preview(s, t.uid, coordinated);
        const choice = coordinatedPreview.errors.length ? forced : coordinated;
        if (!preview(s, t.uid, choice).errors.length)
          s = execute(s, t.uid, choice);
      }
      s = endTurn(s);
      expect(s.treasury).toBeGreaterThanOrEqual(0);
      expect(s.provinces.every((p) => p.stock >= 0)).toBe(true);
      if (turn < 8) expect(s.status).toBe("playing");
    }
    expect(s.status).toBe("won");
    expect(s.turn).toBe(8);
    expect(s.ending).toBeTruthy();
  });
});
describe("完整存档", () => {
  it("保存并恢复随机、人物、项目、待办与规则状态", () => {
    let s = reform(newGame(), "south", "anomaly", "anomaly");
    s = execute(s, task(s), coordinated);
    s = endTurn(s);
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
    expect(endTurn(restored)).toEqual(endTurn(s));
  });
  it("拒绝损坏、负资源、重复任命与非法权限存档", () => {
    expect(() => deserialize("bad")).toThrow();
    const s = newGame();
    s.commands = -1;
    expect(() => deserialize(serialize(s))).toThrow();
    s.commands = 5;
    s.appointments.anomaly = "lin";
    expect(() => deserialize(serialize(s))).toThrow();
    s.appointments.anomaly = "sergei";
    s.jurisdictions["south:anomaly"] = "gov-north";
    expect(() => deserialize(serialize(s))).toThrow();
  });
});

describe("结算边界与预览最终余额", () => {
  it("最终余额包含财政补偿、地方补偿和方案资本收益", () => {
    const s = newGame();
    const choice: Choice = {
      optionId: "public",
      strategies: {
        jurisdiction: "force",
        route: "negotiate",
        interest: "compensate",
      },
    };
    const p = preview(s, task(s), choice),
      n = execute(s, task(s), choice);
    expect(p.final).toEqual({
      commands: n.commands,
      treasury: n.treasury,
      capital: n.capital,
      stock: n.provinces[1].stock,
    });
  });
  it("社会事务保密的减压和信任代价相抵", () => {
    const s = newGame();
    s.tasks = [{ uid: "social", cardId: "base-2", age: 0, created: 1 }];
    s.provinces[2].pressure.social = 2;
    const n = execute(s, "social", { ...forced, optionId: "secret" });
    expect(n.provinces[2].pressure.social).toBe(2);
  });
  it("最低支出检查先于税收，连续违约可触发失败", () => {
    const s = newGame();
    s.tasks = [];
    s.treasury = 0;
    const n = endTurn(s);
    expect(n.insolvency).toBe(1);
    expect(n.treasury).toBe(5);
    n.treasury = 0;
    n.tasks = [];
    expect(endTurn(n).status).toBe("lost");
  });
  it("拒绝结构不完整的嵌套存档", () => {
    const s = newGame();
    delete (s.factions as Partial<GameState["factions"]>).popular;
    expect(() => deserialize(serialize(s))).toThrow("派系");
    const n = newGame();
    delete (n.policies as Partial<GameState["policies"]>).economy;
    expect(() => deserialize(serialize(n))).toThrow("政策");
  });
});
