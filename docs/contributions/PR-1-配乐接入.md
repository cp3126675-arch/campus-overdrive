# PR #1 配乐接入记录

状态：四首音乐随 v0.6.0 已公开。原 PR #1 由作者关闭、分支删除，GitHub 状态仍为 closed / merged=false；维护者随后明确确认采用四首音乐，接入经 [PR #3](https://github.com/cp3126675-arch/campus-overdrive/pull/3) 合并。

原 PR：[基于5.0.1版本增加了音乐](https://github.com/cp3126675-arch/campus-overdrive/pull/1)，提交者 FreneticWind60，head `16abc67c738146ae8d9bad4e78e5e1856a47d38a`。虽然标题写 5.0.1，逐文件比较表明包以项目 v0.5.1 为底。

原 ZIP SHA256：`f479956cdb264ce93a866e55eac1401679a36515286fd1bc142a0bb932d01e19`，26,852,806 字节；本地只读留存 `outputs/research/pr1-original.zip`。校验 ZIP CRC、路径与文件差异后读取，未执行贡献者的编译脚本。

与 v0.5.1 相比只新增四个 MP3、`assets/music.js`，修改主脚本与 index.html。接入时的 v0.5.2 已有横屏修复，因此不能以 PR 里的旧 ZIP 覆盖线上。

## 接入内容与调整

四首音频按原字节保留并重命名。复用贡献者设计的生命 <50 切紧急曲、四场景选择、1.2 秒渐变和静音联动，改写为可测试的 `lib/music.ts`。原实现同时 fetch/decode 四首并一直循环；当前实现最多两首流式播放，胜负曲单次播放，暂停/后台停播，销毁释放媒体。音乐加载失败或自动播放受限不阻断开始和战斗。

|原文件|当前文件|SHA256|
|---|---|---|
|art/music/a.mp3|public/audio/pr1-battle.mp3|`5c69f21ce481cbc9fc3adb9bb2269de1e3915ed7d26fb19890675d60e1f1fd14`|
|art/music/b.mp3|public/audio/pr1-urgent.mp3|`1055dd8c82247a687c1890e5f90eaf71372a245fe87c8a7d8241d2c9eb7e3250`|
|art/music/c.mp3|public/audio/pr1-victory.mp3|`9ba8fc3e44e6ee476e534928b4aa47463e1f4a3115720dfc030c3d888ded07a3`|
|art/music/d.mp3|public/audio/pr1-defeat.mp3|`6ccf8fce29e6000915b8cb42eb5c97a22b7c384280f347f9dcba92f33a22fe41`|

## 素材署名边界

提交说明与 ID3 未提供可核对的曲名、作曲者或许可；部分编码标签含转码工具信息，不能据此推断作者。署名记录“原作者未注明；由 FreneticWind60 提交”，许可为 `NOASSERTION`，不标作 MIT、CC 或原创。后续应由贡献者补充来源或替换为许可明确的音乐。

## GitHub 合并方式

工程 PR #2 先通过 CI 合入 main。集成提交 `7cab6c5ccdc638b55323dc3b301bfd21d4a466da` 的第二父提交为原音乐提交 `16abc67c738146ae8d9bad4e78e5e1856a47d38a`，保留原作者与祖先关系。旧 `campus-game.zip` 冲突由已验证的 v0.6.0 封存包解决。

PR #3 通过 CI 34145551323 后普通合并，公开提交 `7040e4a765aa1414a8a9d813d131037d9d6f0b8e`。Pages 34145675044 成功，线上 244/244 文件哈希通过，已创建 [v0.6.0 Release](https://github.com/cp3126675-arch/campus-overdrive/releases/tag/v0.6.0)。没有重新打开原 PR，也没有将它的 closed 状态描述为 merged。
