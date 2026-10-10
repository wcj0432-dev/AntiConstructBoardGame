import {describe,expect,it} from "vitest";
import {deserializeV2,executeAction,executeCommand,matterProgress,newV2,previewAction,serializeV2,startCampaign} from "./engine";
import type {Action,V2Game} from "./model";
const go=(g:V2Game,a:Action)=>executeAction(g,a);
const end=(g:V2Game)=>go(g,{type:"end"});
function oldgod(){let g=newV2("national","night","联邦-v03-验收");g=end(g);g=end(g);g=end(g);g.core.appointments["gov-north"]="xing";g.core.appointments["gov-south"]="bai";return g;}
describe("v0.3 原子事务与生命周期",()=>{
 it("完全解决只扣费一次，移出队列并归档；同请求跨存档重放不扣费",()=>{
  const g=newV2("campaign","night","联邦-v03-验收"),id=g.machine.matters[0].id,a:Action={type:"resolve",matter:id,option:"repair"};
  const receipt={id:"fixed-request",revision:0},out=executeCommand(g,a,receipt);
  expect(out.result.status).toBe("resolved");expect(out.game.core.commands).toBe(g.core.commands-1);
  expect(out.game.machine.matters.some(x=>x.id===id)).toBe(false);expect(out.game.machine.archive.find(x=>x.id===id)?.lifecycle).toBe("resolved");
  const restored=deserializeV2(serializeV2(out.game));expect(executeCommand(restored,a,receipt).game).toBe(restored);
  expect(g.machine.matters).toHaveLength(1);expect(g.machine.archive).toHaveLength(0);
  const duplicate=executeCommand(restored,a,{id:"another-click",revision:1});expect(duplicate.result.status).toBe("failed");expect(duplicate.game).toBe(restored);
 });
 it("条件失败与过期预览返回原状态，不扣费，也不推进随机序列",()=>{
  const g=newV2(),a:Action={type:"resolve",matter:g.machine.matters[0].id,option:"public"};
  const before=serializeV2(g),fail=executeCommand(g,a);expect(fail.result.status).toBe("failed");expect(fail.result.errors.length).toBeGreaterThan(0);expect(serializeV2(g)).toBe(before);expect(fail.game).toBe(g);
  const newer=go(g,{type:"project",project:"warning",province:"south"});const stale=executeCommand(newer,{type:"end"},{id:"stale",revision:0});expect(stale.result.errors.join()).toContain("局势已经变化");expect(stale.game).toBe(newer);
 });
 it("撤离是部分完成，仍需管理异常源；遏制到期后的下一次结算会恶化",()=>{
  const g=oldgod(),it=g.machine.matters.find(x=>x.kind==="oldgod")!,out=executeCommand(g,{type:"resolve",matter:it.id,option:"evacuate"});
  expect(out.result.status).toBe("partial");expect(out.result.remaining.join()).toContain("异常源尚未封印");
  const n=deserializeV2(serializeV2(out.game)),saved=n.machine.matters.find(x=>x.id===it.id)!;expect(saved.evacuated).toBe(true);expect(saved.lifecycle).toBe("partial");expect(matterProgress(saved).completed.join()).toContain("居民");
  expect(executeCommand(n,{type:"resolve",matter:it.id,option:"evacuate"}).result.status).toBe("failed");
  const first=end(n);expect(first.machine.matters.find(x=>x.id===it.id)?.stage).toBe(it.stage);
  const second=end(first);expect(second.machine.matters.find(x=>x.id===it.id)?.lifecycle).toBe("deteriorated");
 });
 it("临时遏制明确返回持续危机且不允许当回合重复支付",()=>{
  const g=oldgod(),it=g.machine.matters.find(x=>x.kind==="oldgod")!,a:Action={type:"resolve",matter:it.id,option:"contain"},out=executeCommand(g,a);
  expect(out.result.status).toBe("changed");expect(out.game.machine.matters.find(x=>x.id===it.id)?.containment).toBe(1);
  const again=executeCommand(out.game,a);expect(again.result.status).toBe("failed");expect(again.game).toBe(out.game);
 });
 it("原v0.2存档补全新元数据，不丢掉已有目标、项目与持续进度",()=>{
  const g=newV2("national","spark"),old=JSON.parse(serializeV2(g));for(const k of ["goalPending","revision","archive","results","rulesVersion","difficulty"])delete old.machine[k];
  const migrated=deserializeV2(JSON.stringify(old));expect(migrated.machine.goal).toBe("spark");expect(migrated.machine.goalPending).toBe(false);expect(migrated.machine.results).toEqual([]);
 });
});
describe("v0.3 游戏内国家规划",()=>{
 it("第1回合不立项，第2回合会议保留之前建设，其他项目仍可启动",()=>{
  let g=startCampaign({mode:"national",seed:"联邦-v03-验收",difficulty:"standard"});expect(g.machine.goalPending).toBe(true);
  expect(previewAction(g,{type:"selectGoal",goal:"spark"}).errors.join()).toContain("第2回合");
  g=go(g,{type:"project",project:"warning",province:"south"});g=end(g);expect(g.machine.works[0].completed).toBe(true);
  g=go(g,{type:"selectGoal",goal:"spark"});expect(g.machine.goal).toBe("spark");expect(g.machine.goalPending).toBe(false);expect(g.machine.works[0].completed).toBe(true);
  expect(previewAction(g,{type:"project",project:"warning",province:"north"}).errors).toEqual([]);expect(previewAction(g,{type:"selectGoal",goal:"accord"}).errors.length).toBeGreaterThan(0);
 });
 it("第3回合期限清晰，没有静默替玩家选择目标",()=>{
  let g=startCampaign({mode:"national",seed:"联邦-v03-验收",difficulty:"standard"});g=end(g);g=end(g);
  const out=executeCommand(g,{type:"end"});expect(out.result.status).toBe("failed");expect(out.result.errors.join()).toContain("规划期限");expect(out.game.core.turn).toBe(3);
 });
 it("相同种子与操作在保存恢复后仍得到完全相同的随机公报",()=>{
  const g=startCampaign({mode:"national",seed:"联邦-v03-验收",difficulty:"standard"}),a:Action={type:"investigate",deck:"civic"};
  expect(go(g,a)).toEqual(go(deserializeV2(serializeV2(g)),a));
 });
});
