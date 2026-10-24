# 诸界联邦 · 国家机器 v0.7.0

本地单人PvE国家治理策略游戏。React + TypeScript + Vite，无后端、账号或在线AI。通过实际人事、事权、融资合同、财政、工程、维护与具名师承治理三省六区。

## 本版

正式游戏由首席秘书沈岚提供可跳过、状态驱动的引导和真实政务分析；原教学与《南岭工程与人才接班》保留在“特别剧本 / 规则演示”。主界面仍是地图中心、固定视口、单一管理面板，正文16px。

八条国家战略、十六种附加方向进入可视发展规划：第1回合认识国情，第2～3回合立项。新增《万象法典》的真实设施契约登记/法域执行，与《寰宇通讯计划》的实际中继、传令、集中故障/分布韧性。原六路线保留既有路径；选择附加分支后执行相应融资、制度和终局条件，不能重复领能力。

秘书三表情与四名核心人物使用本任务原创AI插画，其余20人保留原创SVG；新增地图浮雕/通讯、文书分类及实际成果通告。五组合成音乐主题和11类音效统一管理，本地生成，支持静音/音量/动态音乐/失败退路，不依赖互联网。

[完整交付与未完成清单](V7_DELIVERY.md) · [美术音频来源](docs/ART_AUDIO_V7.md) · [扩图准备（未开放）](docs/V7_EXPANSION_DESIGN.md)

## 下载

[Windows / 离线HTML / 源码 / SHA256](https://github.com/wcj0432-dev/AntiConstructBoardGame/releases/tag/v0.7.0)

Windows包完整解压后运行`FederationOfWorlds.exe`，不能只复制exe；离线包解压后双击`诸界联邦.html`。无需Node.js或网络，Windows包尚无发行者签名。旧版本发布仍保留。详见[游玩说明](PLAYER_GUIDE.md)。

## 开发与测试

Node.js24；使用锁定依赖。

```bash
npm ci
npm run dev
npm test                 # 本版327项 / 12文件，含真实正常资源12回合新路线
npm run build            # TypeScript与生产构建
npm run build:offline    # 全部脚本、样式、插画内嵌的单HTML
npm run release:pack     # Windows、Offline、Source ZIP及SHA256SUMS
```

服务运行后执行浏览器检查：

```bash
npx playwright install chromium
npm run test:browser -- http://localhost:5173
npm run test:v3 -- http://localhost:5173
npm run test:v4 -- http://localhost:5173
npm run test:v5 -- http://localhost:5173
npm run test:v6 -- http://localhost:5173
npm run test:v7 -- http://localhost:5173
```

系统Chromium可用时设置`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。v7覆盖正式任期引导、乱序主题、人事/财政/秘书意见、实际规划与分支、存读、Web Audio混音和失效退路、四桌面及四窗口真实原生125%。截图写入`artifacts/screenshots/v7`，交付证据在`docs/screenshots/v7`。

版本标签触发`.github/workflows/release.yml`：锁定安装→规则→构建→Windows实际exe存读/重启→离线`file://`六套浏览器→上传Release。Linux生成Windows包不代表Windows实机验证。手动发布时标签须与package一致。

## 核心规则与存档

- 中央和地方资金、宗门基金及实物分别记账。先运作/逐设施维护/施工，再收实际税与经营收入；拨款和依法上缴守恒。
- 五种出资合同决定投资、维护、产权和经营。欠付只停本设施；回拨补缴或明确维护接管不会自动取得产权、修好技术故障或追回停运收益。
- 人物的主职/正式兼职/顾问/专职/临时占用共用一个状态；当前职位、政策和专业决定资格，授权不会创造人才。
- 导师指定学员，基层/学院课程有真实费用、周期和容量；学院停运或抽调会暂停，毕业资格属于该学员，导师离任不会抹掉。
- 4/8/12回合模式；八/十二回合须完成原终局仪式，十二回合还需第10～11回合演练。存活本身不足以获得正式胜利。

保存键仍为`federation-worlds-v2`，规则0.7.0。读取旧档不替玩家选分支，不改原资金/合同/培养/目标/RNG；当前档损坏明确拒绝。已读主题随本局保存，音量与秘书模式为本地界面偏好。网页与桌面存储相互独立。

规则见[RULES.md](RULES.md)，历史实现见[V6_DELIVERY.md](V6_DELIVERY.md)及更早交付报告。

## 已知边界与下一步

三省六区仍为实际可玩地图；东海/西陲只有结构与依赖设计。长期故事目前来自真实状态的三组章节，尚非多轮专属剧情选择链。配乐为基础合成短循环；其余人物与大型事件插画尚未完成。四个正常资源新路线分支已走通，不等于全种子/难度/十六分支已经平衡。

优先补原六路线的两分支完整战役与人工试玩，再做一条真实政治故事链、分批美术/配乐，最后逐省启用扩图。具体可验证交付目标见[V7_DELIVERY.md第10节](V7_DELIVERY.md#10-后续建议按可验证结果推进)。

## 主要结构

```text
src/v2/engine.ts          统一预览、命令执行、结算、历史与迁移
src/v2/fiscal.ts          央地账户、融资合同与共享财政预测
src/v2/operations.ts      设施真实运营状态
src/v2/maintenance.ts     逐设施债务、责任与补缴
src/v2/personnel.ts       正式岗位、兼职、项目和临时任务
src/v2/training.ts        具体课程、暂停、毕业和个人继任资格
src/v2/nationalStrategy.ts 分支、真实契约登记、通讯与当前验收
src/v2/advisor.ts         由同一规则推导的秘书事实、引导和回顾
src/v2/politicalStories.ts 有来源的合同/救援/继任章节
src/ui/Secretary.tsx      可折叠秘书与上下文意见
src/ui/StrategyTree.tsx   可视发展规划与实际操作入口
src/ui/audio.ts           离线Web Audio、混音、合成、限频与退路
scripts/v7-campaigns.ts   四个正常资源12回合新路线序列
```
