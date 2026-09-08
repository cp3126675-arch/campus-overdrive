# 合成清华小游戏 · Campus Overdrive

非官方清北校园题材的 2D 徽章合成动作竞速游戏。操控中央徽章，击败教材怪、躲避 Boss、抢鹅腿，合成清华并击败最终 Boss。

[在线试玩 v0.6.0](https://cp3126675-arch.github.io/campus-overdrive/?v=0.6.0) · [贡献指南](CONTRIBUTING.md) · [配乐投稿](public/audio/README.md) · [游戏总纲](docs/游戏设计与长期开发文档.md) · [版本记录](RELEASES.md)

## 下载与运行

这是完整开发工程，源码位于 `app/`、`components/`、`lib/`，不是只有部署 ZIP。

要求：Node.js 22.13+（建议 Node 22 LTS）、npm、Python 3.10+。**不需要 Codex、OpenAI 账号、API Key 或云服务凭据。**

```sh
git clone https://github.com/cp3126675-arch/campus-overdrive.git
cd campus-overdrive
npm ci
npm run dev
```

打开终端给出的地址（默认 `http://127.0.0.1:3000/`）。已有本地副本可用 `git pull` 获取上游更新；有未提交修改时先保存自己的工作。

## 参与贡献

**Fork → 创建分支 → 修改/上传音频 → 提交 Pull Request → 自动检查 → 维护者审核合并。**

欢迎只提供原创配乐，不要求会写代码；按 [配乐目录说明](public/audio/README.md) 上传音频并填写作者、许可和用途即可。目前只有程序音效，音乐目录是投稿入口，提交文件后由维护者安排接入。

[新建 PR](https://github.com/cp3126675-arch/campus-overdrive/compare) · [提交问题](https://github.com/cp3126675-arch/campus-overdrive/issues/new/choose)

## 检查与构建

```sh
npm run check
npm test
npm run build:pages
npm run build
```

- `check`：TypeScript、lint、配乐文件与清单校验。
- `test`：游戏规则、加载、横屏触控、贡献检查器及发布工具回归。
- `build:pages`：生成 `outputs/GitHub-Pages部署版/`，可部署到静态服务器；请通过 HTTP 访问，不能直接双击 HTML。
- `build`：保留原 vinext 生产构建验证。普通贡献开发使用上方 Vite 入口，不依赖本机 `.openai` 设置。
- `dev:site`：维护者的原 vinext 开发入口，可选。

## 操作与内容

桌面 WASD / 方向键移动，E 合成、空格车神、Q 院系技能、P / Esc 暂停。手机从首页起横屏显示，左手摇杆、右手技能；物理竖屏浏览器内旋转整个游戏舞台。

126 个院系/书院/机构方向、30 枚徽章武器、192 张教材封面与 8 个 Boss。每局 15 级合成链；合成清华后还须击败最终 Boss。具体规则及仍待真机验收的问题见 GDD。

## 工程结构

|目录|内容|
|---|---|
|`app/`、`components/`|菜单、HUD、摇杆与页面样式|
|`lib/game-model.ts`|战斗、合成、进度和结算规则|
|`lib/game.ts`|Canvas 绘制、资源与音效|
|`lib/*json`|院系、徽章和图片内容配置|
|`public/`|游戏素材；`audio/` 是配乐贡献入口|
|`scripts/`|导出、测试、贡献校验与版本工具|
|`docs/`|设计总纲、素材来源、发布回执|
|`.github/`|PR 检查、模板及发布工作流|

## 发布与回滚

当前可玩版本为 **v0.6.0**，四场景配乐与图片、渲染优化已发布并核验。完整源码已通过 PR #2 公开，更新通过 PR #3 合并；普通 PR 只运行检查。v0.5.2 原始包和 GitHub Release 历史继续保留，可作为回滚目标。[版本与回滚说明](docs/版本管理与回滚.md)

## 许可证

原创程序代码采用 [MIT](LICENSE)。第三方图片、校徽、教材封面和新闻照片 **不在 MIT 授权范围内**，音乐按清单中的独立许可处理。[许可范围](NOTICE.md) · [素材台账](public/ASSET-CREDITS.txt)

## v0.6.0 资源与配乐维护

[v0.6.0 Release](https://github.com/cp3126675-arch/campus-overdrive/releases/tag/v0.6.0) 已公开，线上 244 个文件与封存包哈希一致；OPPO 微信真机待复验。图片原件在 `public/art`、`public/badges`；`npm run assets:optimize` 生成带内容哈希的 WebP 与清单，`npm run check:assets` 校验原图/压缩图一致和体积预算。静态导出只交付压缩图，源码不删除原图。配乐接入与署名边界见 [PR #1 记录](docs/contributions/PR-1-配乐接入.md)。

## v0.6.1 修复候选

横屏手机和平板摇杆采用统一输入模式，首页与暂停菜单可选择“自动／触控／键鼠”。已完成本地检查与构建，线上仍为 v0.6.0；见 [验证与发布状态](docs/releases/0.6.1-validation.md)。

## v0.6.2 全服排行榜候选

昵称参榜，院系前10名、总榜前20名，每名玩家只按最佳成绩排名；本机历史和个人最佳单独保留。使用独立 Cloudflare Pages Functions + D1，前端继续在 GitHub Pages。生产 API 已部署并验收，GitHub 游戏发布待完成，线上仍为 v0.6.0。[部署说明](docs/全服排行榜部署.md)
