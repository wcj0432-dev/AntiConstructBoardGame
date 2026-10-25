# 诸界联邦 · 国家治理桌面 v0.8.5

本地单人 PvE 政治组织构筑与国家治理游戏。架空冷战、奇幻工业与三省六区；React + TypeScript + Vite，无后端、账号或在线 AI。

进入游戏后，默认在**国家治理桌面**观察六个关键职位、3～5项当前事务、工程与协议、近期目标和实际行政命令筹码；随时切换地图查看地区、资源网络与危机。两种视图共享一份游戏状态，切换不扣资源。关闭详情回到局面，结束回合始终独立可见。

本版新增工程组件与局部因果链、受阻行动反查职位、真实任命前后对照、持续危机阶段轨、两类有限派系议程、一页规则速查，以及四回合《四次会议与一座电站》。原24人物、八路线/十六方向、4/8/12回合、财政合同、维护债务、具名培养、政治故事、秘书和音频系统保留。

[下载 Windows / 离线 HTML / 源码 / SHA256](https://github.com/wcj0432-dev/AntiConstructBoardGame/releases/tag/v0.8.5) · [交付与未完成清单](V85_DELIVERY.md) · [游玩说明](PLAYER_GUIDE.md) · [规则](RULES.md) · [人工试玩材料](docs/v85/HUMAN_PLAYTEST.md)

Windows 包完整解压后运行 `FederationOfWorlds.exe`，不能只复制 exe；离线包解压后双击 `诸界联邦.html`。无需 Node.js 或网络。Windows 尚无发行者签名；网页、离线文件、桌面各自存档。历史版本和 Release 保留。

## 游戏与验证边界

- 行动筹码就是 `core.commands`，没有第二套资源或部门免费次数。所有行动沿用原预览→确认→统一命令 API。
- 工程卡显示真实投资、管理、技术、维护、产权与收益。接管维护不自动转移产权、维修权或补发停运收益。
- 两种派系议程由实际工程开工/维护接管产生，每种每局一次、最多两项，接受/谈判复用原预算/暂停/拨款/维护操作；拒绝、延期、逾期有明确后果，不是完整派系 AI。
- 验证战役公开使用中央32、地方10/5/10、宗门6、政治资本8及既有学院/铁路/未完工工厂；仍每回合5命令。中央、地方合作、专业分工均有真实四回合胜利路径，属于独立场景，不是普通开局平衡证据。
- 393项规则/音频测试，保留原362项。16种标准方向仍可完成12回合；原80脚本重跑仍71成功/9挑战失败，另提供其中一个挑战局的正常资源替代通关。脚本通关与截图不等于真人可读性、疲劳或全面平衡验收。

## 开发与测试

Node.js 24，锁定依赖：

```bash
npm ci
npm run dev
npm test
npm run build
npm run build:offline
npm run test:playability     # 三条4回合路径、16条12回合用途统计、挑战替代
npm run test:campaigns       # 重跑80样本，写新文件，不覆盖v0.8报告
```

安装浏览器后，在服务地址上执行各套检查：

```bash
npx playwright install chromium
npm run test:browser -- http://localhost:5173
npm run test:v3 -- http://localhost:5173
npm run test:v4 -- http://localhost:5173
npm run test:v5 -- http://localhost:5173
npm run test:v6 -- http://localhost:5173
npm run test:v7 -- http://localhost:5173
npm run test:v8 -- http://localhost:5173
npm run test:v85 -- http://localhost:5173
npm run release:pack
```

可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。v85 实际 UI 完成三条战役并逐行动对照规则；另测维护缺口→组织瓶颈→任命→接管→派系要求、地图切换、四桌面尺寸和四窗口原生125%缩放、局部面板与确认按钮。旧七套浏览器主动选择地图偏好，完整保留既有教学、规则、故事和音频断言。截图和机器记录在 `artifacts/screenshots`，可分享材料在 `docs/screenshots/v85` 和 `docs/v85`。

发布工作流在 Windows 实际运行打包 exe，检查旧教程与新桌面任命、地图切换、存档、进程重启和读取，并对单 HTML 的 `file://` 执行八套浏览器检查后才上传附件。`verify_only` 手动预检不创建 Release。Linux 构建 Windows 包不算 Windows 执行证据。

## 存档与代码

保持 schema2 和 `federation-worlds-v2`；规则版本更新为0.8.5。v0.8.0/0.8.1档只增添空派系记录，不追溯产生要求，不重置人物、兼职、合同、维护债务、课程、目标、故事、历史和 RNG。更早档沿既有迁移链升级；损坏当前档明确拒绝。布局偏好 `federation-ui.workView` 在正式状态以外。

| 文件 | 职责 |
| --- | --- |
| `src/v2/engine.ts` | 正式预览、执行、统一结算与记录 |
| `src/v2/governance.ts` | 无状态、无随机消耗的组织/事务/工程/协议/目标投影 |
| `src/v2/crisisTrack.ts` | 危机轨道与原结算共享的阶段规则 |
| `src/v2/factionAgendas.ts` | 两类有来源的正式政治诉求与期限 |
| `src/v2/governanceTrial.ts` | 公开准备的四回合验证场景与真实终检 |
| `src/v2/migrationV85.ts` | 增量兼容与当前档校验 |
| `src/ui/GovernanceTable.tsx` | 桌面、工程局部链、组织对照、规则速查 |
| `src/ui/StateMarks.tsx` | 桌面/原组织图/设施/秘书共用状态标记 |
| `scripts/governance-trial.ts` | 三种组织方案的实际命令见证 |
| `scripts/verify-governance-play.mjs` | 路径差异与逐回合操作用途证据 |

## 下一步

先完成独立三秒截图测试与真人12回合试玩，针对后半程选择和信息负担迭代；再研究剩余挑战样本、随机政治下的适应性路径、更多有组织依据的派系议程。五省扩图、大量新增人物、外交战争与大规模 AI 本轮按需求暂缓。其余20人物立绘、长故事和完整人工配乐仍属历史未完成项，详见 [V85_DELIVERY.md](V85_DELIVERY.md)。
