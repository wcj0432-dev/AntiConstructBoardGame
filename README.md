# 诸界联邦 · Federation of Worlds

可在本地浏览器游玩的单人 PvE 数字桌游原型 v0.1。React + TypeScript + Vite，无后端、无在线 API，游戏运行后不依赖网络。

你管理的不是一支完美的队伍，而是一套充满矛盾的国家机器。通过人事、权限、政策与资源安排，度过8个季度。

## 安装与运行

推荐 Node.js 22 或 24，npm 10+（已验证 Node 24.19.0、npm 11.9.0）。

```bash
npm ci
npm run dev
```

在本地浏览器打开 Vite 输出的地址。默认端口5173。部署到自己的设备时可指定端口：

```bash
npm run dev -- --port 5173
```

```bash
npm test          # 规则引擎自动化测试
npm run build    # TypeScript 检查与生产构建
npm run preview  # 查看生产构建，默认端口4173
```

首次安装需要 npm registry；运行不需要服务、账号、密钥或外部素材。页面字体使用本机字体，图标随应用打包。

## 先玩演示场景

默认种子 `南岭-071`，第一张牌固定为「灵脉电站事故」。点击「审议事务」，选择方案及三项冲突的处理方式，点击「预览执行」，检查最终资源和政治后果，最后确认执行。

- **正常协调**：公开处置，三项冲突均协调，消耗4命令、1财政、2南岭物资；没有新增积怨。
- **全部强制**：公开处置，三项冲突均强制，消耗1命令、1财政、2物资；谢尔盖积怨 +1、白芷 +2，白芷主持未来事务时产生阻力。
- **制度改革**：先在权限改革中把南岭异常事务主责授予异常局，消耗1命令、2资本；再公开协调，事务消耗3命令。该领域今后不再产生事权冲突。

选择保密、更换负责人、支付补偿、达成政治协议或向地方让渡权限，也会形成不同路线。正常游玩无需开发者工具。

使用顶部「新游戏」设置种子，可取消固定首张演示牌。相同种子与相同决策可完整复现。存档使用当前浏览器、当前站点的 `localStorage`；不会自动同步到别的设备，清理网站数据会删除存档。

## 已实现

- 三省六区、三中央机构及三省政府；12名人物，独立职位、专业、立场、特殊能力、积怨和根基。
- 动态事权 / 路线 / 利益冲突；参与者、原因、能力门槛、原始成本、处理成本和最终余额预览；确认后统一结算。
- 每类12张、共36张数据定义事件；公开待办、压力连锁、重大危机额外抽牌和行政阻塞预警。
- 三种主动牌堆、投资、地方经营、项目产出和两季度运行风险。
- 人事、永久管辖改革、全国政策、跨省资源调拨、政治和解、派系影响与不满。
- 8季度流程、胜负条件、终局报告、具体决策日志、新游戏、重开、存档和读档。
- 响应式桌游界面；桌面三栏、手机纵向布局；所有内容均为本地资源。

本原型采用可解释的模板化卡牌效果，重点验证政治系统，未加入复杂剧情或对手 AI。组织与行动可在同一行动窗口内交替操作，是原型阶段的明确简化。

## 结构

```text
src/types.ts        统一状态、事务、效果及预览类型
src/data.ts         人物、机构、省份与36张事件数据
src/engine.ts       纯函数规则引擎、固定随机与存档验证
src/engine.test.ts  行为测试与8季度演示验证
src/App.tsx         React 操作与可解释决策界面
src/style.css       本地样式、地图、卡牌与移动布局
RULES.md            完整结算规则与补充设计决定
```

规则引擎不依赖 React 或 DOM，操作返回新状态，UI 不直接修改游戏资源。新增卡牌应使用类型化效果，避免在组件中编写单卡规则。

## 验证

自动化测试覆盖三条演示路线、不参与者的立场、职位空缺与调任、受损者征调、积怨阈值、派系改革阻力、压力时序、额外抽牌上限、项目、资源安全、延期、瘫痪、存档与完整8季度结局。另已在 Chromium 实测预览执行、三条路线、存读档、完整8季度及390px手机布局。

## 下载到本地直接游玩

发行版包含三种文件：Windows-x64 便携 zip（解压后双击 `FederationOfWorlds.exe`）、离线 HTML zip（解压后双击 `诸界联邦.html`）、完整源码 zip。无需联网游玩，也无需给普通玩家安装 Node.js。详见 [游玩说明](PLAYER_GUIDE.md)。

Windows包包含完整 Electron 运行时，需保留全部文件。Windows应用与浏览器版的存档彼此独立。没有制作单文件安装器，也没有发行者签名。

## 自行打包与发布

```bash
npm ci
npm test
npm run release:pack
```

`artifacts/` 中生成 Windows-x64、离线版与源码 zip，以及 `SHA256SUMS.txt`。初次桌面打包需要从 Electron 官方 GitHub 下载校验过的运行时，桌面打包需要 Node.js 24.5以上，使用标准 HTTP(S)代理设置（如有）；默认固定版本44.7.0；后续复用 `.cache/electron`。当前打包工具可在 Linux 或 Windows 上生成 Windows程序；跨平台构建不会证明 Windows运行已验证。

```bash
npm run build:offline       # 单个可直接双击打开的 offline/index.html
npm run build:desktop       # Windows-x64便携文件夹
npm run test:desktop -- artifacts/desktop/FederationOfWorlds-win32-x64/FederationOfWorlds.exe
```

最后一个命令需在 Windows上执行，检查真实 exe 的事务处理、存档与重启读档。可选 Linux桌面打包使用 `npm run build && node --use-env-proxy scripts/pack-desktop.mjs linux x64`，但不是默认发布目标。

GitHub Actions 配置在 `.github/workflows/release.yml`。推送与 package.json 版本一致的 `v0.1.0` 标签后，Windows runner 会测试、打包、对真实 exe 做烟测，再发布 GitHub Release 并附带下载文件。如果标签推送未自动触发，可打开仓库 Actions → Build and publish downloadable game → Run workflow，保持分支 main，填写已有版本标签 v0.1.0；工作流会检出该标签、验证并发布同一版本。工作流使用 GitHub自带临时 token，不需要个人密钥。

默认发行仓库：`wcj0432-dev/AntiConstructBoardGame`。发布命令（仅在所有检查通过且准备发布时执行）：

```bash
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

## 当前可直接下载的离线包

[下载离线浏览器版 v0.1.0](https://github.com/wcj0432-dev/AntiConstructBoardGame/raw/refs/heads/main/downloads/Federation-of-Worlds-v0.1.0-Offline.zip)。完整解压后双击 `诸界联邦.html`。Windows.exe 便携版由上述发布工作流验证并上传到 Releases；仅存在标签页面不代表 exe 附件已发布。
