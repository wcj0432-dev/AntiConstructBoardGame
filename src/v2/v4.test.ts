import { describe, expect, it } from "vitest";
import { executeAction, executeCommand, newV2 } from "./engine";
import type { Action, V2Game } from "./model";
const go = (g: V2Game, action: Action) => executeAction(g, action);
function engineerOpening() {
  let g = newV2("national", "spark", "工程回归-v04");
  g = go(g, { type: "investigate", deck: "ley" });
  g = go(g, { type: "appoint", office: "gov-south", person: "mo" });
  return g;
}
describe("v0.4 第一阶段：工程入口一致性", () => {
  it("通过机会事务开工不会把同次开工标记为工程师抽调", () => {
    let g = engineerOpening();
    g = go(g, { type: "resolve", matter: g.machine.matters.find(x => x.kind === "opportunity")!.id, option: "invest" });
    expect(g.machine.occupied.mo).toBeUndefined();
    g = go(g, { type: "end" });
    expect(g.machine.works[0].progress).toBe(1);
  });
  it("先在建设菜单开工后，旧机会事务不能再次开同省同类工程", () => {
    let g = engineerOpening();
    g = go(g, { type: "project", project: "energy", province: "south" });
    const r = executeCommand(g, { type: "resolve", matter: g.machine.matters.find(x => x.kind === "opportunity")!.id, option: "invest" });
    expect(r.result.status).toBe("failed");
    expect(r.game).toBe(g);
    expect(r.game.machine.works).toHaveLength(1);
  });
});
