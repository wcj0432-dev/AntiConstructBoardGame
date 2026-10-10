# 诸界联邦 · 国家机器重构 v0.2

本地单人 PvE 数字桌游。React + TypeScript + Vite，无后端或在线裁判。通过人事、实际事权、路线和具体资源交换，构建一套能够治理奇幻世界的国家机器。

默认进入四阶段操作教学；也可选择固定四回合「南岭—北境紧急状态」，或八回合国家目标模式。「星火计划」「诸界协约」「长夜防线」都需要具体组织与设施，并在第8回合通过终局检验；仅存活不会获得正式胜利。

## 运行

Node.js 22/24，桌面打包使用24.5以上。已验证Node24.19、npm11.9。

```bash
npm ci
npm run dev                 # 浏览器打开 http://localhost:5173
npm test                    # v0.1回归与v0.2行为/完整战役测试
npm run build               # TypeScript检查及生产构建
npm run preview
```

首次安装需要网络；游玩不需要账号、密钥或服务器。所有字体使用本机字体，图标随游戏打包。

## v0.2的实际变化

- 地方分权、中央垂直、中央—地方委员会，改变可参加机构、批准规则和可执行方案。临时授权当回合到期，部门与国家改革下回合生效。
- 六名关键人物的才能进入统一资格判定：群众动员、秘密封印、连续灵脉施工、工业标准、军事隔离、江湖协商运输。人才放错岗位不能发动能力。
- 路线否决需要更换负责人、改变方案、取得真实妥协或合法紧急强制；资源不再自动消除冲突。
- 利益交换分为保留收益权、持续部门预算、中央替代供应，产生不同长期后果。
- 公开事故留下能源配给争议；秘密封印产生地方说明诉求。北境旧神是可撤离、遏制、隔离或封印的持续危机。
- 三种国家目标、工程进度、五种有机制效果的奇幻公报，以及可追溯到真实决策的历史和执政报告。
- 财政预测与结算使用同一函数。收入、固定支出、制度维护及可暂停承诺明确分开；先付支出再收税。
- 主体字号16px，操作按钮16–18px；关键危机和目标集中展示，机构详情可以折叠，保留原来的绿色纸质桌游风格。

详细规则、验证路线和简化见 [RULES.md](RULES.md)；更新与未完成部分见 [CHANGELOG.md](CHANGELOG.md)。

## 第一局

1. 点击「前往人事任命」，任命星野澪为南岭省负责人。
2. 选择「群众参与预防巡检」→「预览后果」→「确认执行」。
3. 给教学事故授予南岭主持、中央协办的临时权限，再执行公开群众救援。
4. 点击「核对财政预测」，处理真实公开路径生成的能源配给争议。

每项受阻方案仍可打开，显示具体人物、机构、政策、权限和供给条件。授权并不自动解锁一切。完整教程使用本回合5条命令；可以跳过提示，实际状态仍保留。

## 存档

手动点击顶部「存档」与「读档」。v0.2使用独立键 `federation-worlds-v2`，保留制度过渡、工程、授权、随机状态及因果记录。v0.1存档不会覆盖或静默迁移，会明确提示新开任期。网页与桌面版存档独立，移动离线HTML或清除浏览器数据可能使原存档不可见。

## 下载及打包

```bash
npm run build:offline       # offline/index.html，全部脚本样式内嵌
npm run release:pack        # Windows-x64、离线HTML、源码zip及SHA256
```

生成文件位于 `artifacts/`。Windows便携版解压整个目录后双击 `FederationOfWorlds.exe`；离线版解压后双击 `诸界联邦.html`。详见 [PLAYER_GUIDE.md](PLAYER_GUIDE.md)。Windows包未签名，无需安装Node.js；exe依赖同目录运行库，不能单独复制。

首次桌面打包从Electron官方GitHub下载校验过的44.7.0运行时，后续复用 `.cache/electron`。Linux可生成Windows包，但Windows实机验证由发布工作流执行。

```bash
npm run test:desktop -- artifacts/desktop/FederationOfWorlds-win32-x64/FederationOfWorlds.exe
```

GitHub Actions `.github/workflows/release.yml` 在版本标签推送时测试、打包，并在Windows runner上检查真实exe的任命、事务、存档和重启读档，再发布附件。也可手动运行，填写与package.json一致的已有标签（本版 `v0.2.0`）。本地生成文件不表示Release已发布，标签页面也不表示exe已验证。

[下载v0.2离线版](https://github.com/wcj0432-dev/AntiConstructBoardGame/raw/refs/heads/main/downloads/Federation-of-Worlds-v0.2.0-Offline.zip)，完整解压后双击HTML。Windows与源码见[GitHub Releases](https://github.com/wcj0432-dev/AntiConstructBoardGame/releases)。原v0.1下载仍保留，新包以v0.2.0命名。

## 工程结构

```text
src/data.ts, types.ts       复用12人物、三省六区、职位、政策和基础状态
src/engine.ts              保留v0.1人事、政策、和解、随机与存档校验
src/v2/model.ts, data.ts    v0.2组织关系、三体制、目标、公报及方案定义
src/v2/engine.ts            纯函数统一资格、预览、执行、持续结算及因果
src/finance.ts              共享财政预测函数
src/v2/engine.test.ts       真正行动集合、财政、教程及4/8回合验收
src/App.tsx, v2/style.css   v0.2可解释界面
src/LegacyApp.tsx           保留旧界面供回归参考，不作为现行模式入口
scripts/, desktop/         离线、桌面、源码打包和真实应用烟测
```

规则不依赖DOM。UI只提交类型化行动，不直接改资源。v0.2沿用工程、人物和基础动作；旧36张牌不直接混入新战役，避免两套冲突规则互相污染。
