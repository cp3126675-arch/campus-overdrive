# 参与合成清华小游戏

可以贡献代码、配乐、美术、玩法建议和设备反馈。提交前先阅读 [README](README.md)、[游戏总纲](docs/游戏设计与长期开发文档.md) 和 [许可范围](NOTICE.md)。

## 第一次贡献代码

1. 在 GitHub 点击 **Fork**，把仓库复制到自己的账号。
2. 克隆自己的副本并建立分支：

```sh
git clone https://github.com/YOUR-USERNAME/campus-overdrive.git
cd campus-overdrive
git remote add upstream https://github.com/cp3126675-arch/campus-overdrive.git
git switch -c feat/battle-music
npm ci
npm run dev
```

需要 Node.js 22.13+（建议 Node 22 LTS）和 Python 3.10+。开发无需 Codex、OpenAI 账号、API Key 或付费托管账号。以终端打印的本地地址访问。

3. 修改代码后运行：

```sh
npm run check
npm test
npm run build:pages
npm run build
```

4. 只暂存本次贡献相关文件，提交并推送到自己的 Fork：

```sh
git add public/audio/tracks.json public/audio/campus-battle.mp3
git commit -m "feat: add campus battle music"
git push -u origin feat/battle-music
```

以上暂存命令是配乐示例；修改代码时换成实际修改的文件。之后打开原仓库的 **Pull requests → New pull request → compare across forks**，目标 `cp3126675-arch/campus-overdrive:main`，来源是自己的贡献分支。

维护者审核、试听/测试后合并。提交 PR 不会自动修改线上游戏；每次正式更新仍需独立版本和发布核验。不要替换 `campus-game.zip` 或修改历史版本标签。

## 不写代码，只交配乐

按 [配乐规范](public/audio/README.md) 在自己的 Fork 中上传音频、编辑 `tracks.json`，然后提交 PR。GitHub 网页也可以上传小文件；不必安装开发工具。音频登记由自动检查校验，播放器接入可由维护者补充。请在 PR 中明确注明“仅提供配乐，需要协助接入”。

原创代码贡献采用 MIT；图片和音乐按各自明确许可处理。贡献者须有权提交相关内容，保留来源和署名；不上传账号凭据、个人隐私或未获授权的音乐。

## 同步上游更新

```sh
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

在自己的贡献分支中用 `git merge upstream/main` 同步最新主线。`git pull` 是获取并整合远端更新；**Pull Request** 是向原项目提议合并你的修改。

## PR 写什么

说明解决的问题、最终效果、运行过的检查及未测试项。界面改动附前后截图；手机问题附机型、浏览器/微信版本和复现步骤。音频说明作者、许可、用途及是否已接入播放。

PR 自动运行类型/lint、贡献清单检查、游戏回归与构建。首次外部贡献的 Actions 可能需要维护者批准运行。检查失败时修复同一分支后推送，PR 会自动更新。自动通过不等于功能或真机体验已验收。
