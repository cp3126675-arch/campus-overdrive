# PR #1 配乐接入记录

状态：v0.6.0 本地候选；原 PR 尚未在 GitHub 合并，线上仍为 v0.5.2。

原 PR：[基于5.0.1版本增加了音乐](https://github.com/cp3126675-arch/campus-overdrive/pull/1)，提交者 FreneticWind60，head `16abc67c738146ae8d9bad4e78e5e1856a47d38a`。虽然标题写 5.0.1，逐文件比较表明包以项目 v0.5.1 为底。

原 ZIP SHA256：`f479956cdb264ce93a866e55eac1401679a36515286fd1bc142a0bb932d01e19`，26,852,806 字节；本地只读留存 `outputs/research/pr1-original.zip`。校验 ZIP CRC、路径与文件差异后读取，未执行贡献者的编译脚本。

与 v0.5.1 相比只新增四个 MP3、`assets/music.js`，修改主脚本与 index.html。当前 v0.5.2 已有横屏修复，因此不能以 PR 里的旧 ZIP 覆盖线上。

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

源码开放分支先经 PR 检查合入 main。配乐接入分支从最新 main 创建，以 PR #1 的精确 head 进行普通合并；仅有 `campus-game.zip` 的二进制冲突时用已核验的 v0.6.0 新包解决，并纳入当前源码和以上原音频。用真正的 merge commit 保留贡献者祖先关系，不强制推送、不把旧包替换新包、不只关闭原 PR 冒充合并。合并前确认当前 PR head 未变化。新分支 PR 通过检查后合入，核验 Pages 和每个线上文件，再建 v0.6.0 Release。

该流程尚待 GitHub 已登录浏览器恢复操作；没有把本地接入写成远端已合并。
