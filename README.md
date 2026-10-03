# Qiuniu Score Editor

**Qiuniu Score Editor** 是一款面向 VS Code 的交互式五线谱编辑器。打开 `.music` 乐谱后，可以直接在 HTML5 画布上点选、拖拽和调整音符；不必先学习或手写乐谱标记语言，也不需要在一张渲染图片上“编辑”乐谱。

LilyPond 是 Qiuniu Score Editor 在内部使用的记谱语法和雕版引擎：编辑器把乐谱模型转换成 LilyPond 输入，再用它生成高质量的预览。**Qiuniu Score Editor 才是产品；LilyPond 是幕后工具，不是编辑界面。**

[访问 Qiuniu Score Editor 项目主页](https://luskyle.github.io/qiuniu/)

## 为什么叫 Qiuniu？

囚牛（Qiuniu）是中国传统龙生九子的传说形象之一。相传囚牛喜爱音乐，常与琴、弦乐器和乐律联系在一起，也常被描绘在传统乐器的装饰上。

我们以“囚牛”命名这款编辑器，寄托的是一个简单的愿望：让记谱像演奏和欣赏音乐一样自然。你可以专注于旋律、节奏与乐谱本身，把标记语法和繁琐排版交给工具处理。

## 功能特色

- **直接在五线谱上创作**：`.music` 文件默认在可视化编辑器中打开，谱表和音符由 HTML5 元素构成，可以直接交互，不是背景图片或 SVG 编辑器。
- **VS Code 风格图标工具栏**：常用记谱、播放、预览和 PDF 操作集中在带悬停提示的紧凑图标栏中，窄窗口可横向滚动。
- **点选与拖拽记谱**：选择音符时值后点击谱表添加音符或休止符；也可以拖动来调整音高。
- **钢琴音色试听与速度控制**：调节 40–240 BPM 的速度后即可试听当前旋律；按音符时值、附点、休止符、调号和临时记号演奏。播放时当前音符/休止符会高亮，状态栏显示当前位置，并在翻页时自动跟随；也可随时停止。
- **常用记谱控制**：支持高音谱表、C3–E6 音域、全音符至十六分音符、休止符、占时值但不发声的空白符、附点、升号/降号/还原号，以及常用调号和拍号。
- **整齐的小节网格**：每行保持相同小节数；音符、休止符与空白符在各自小节内等距排列。
- **乐谱标题**：点击 A4 页面顶部可编辑标题，标题保存在 `.music` 文件中，并随 LilyPond 预览和 PDF 导出。
- **多页 A4 乐谱**：单个 `.music` 文件可保存任意长度的旋律；编辑器会在每张 A4 纵向页面铺满谱表系统，空白乐谱和末页剩余区域也会保留可编辑谱行，内容超出后继续分页，音域变化时也会调整谱表高度。
- **PDF 导出**：一键将整首乐谱（含标题和所有页面）导出为 PDF，适合打印和分享。
- **乐谱即数据**：`.music` 文件保存结构化乐谱模型。交互修改会同步回文件，适合版本管理，也便于后续继续扩展。
- **所见与雕版兼顾**：画布负责即时交互；需要精细排版预览时，可调用 LilyPond 对当前乐谱进行雕版。编辑过程本身不依赖 LilyPond 图片。
- **开箱即用的本地运行时**：发布的 VSIX 内含目标平台所需的 LilyPond 运行资源，一般无需另外安装 LilyPond。

## 开始使用

1. 从项目的 GitHub Release 下载与你的系统和处理器架构对应的 VSIX。
2. 在 VS Code 扩展视图中打开 **…** 菜单，选择 **从 VSIX 安装…**，然后选择下载的安装包。
3. 打开现有 `.music` 乐谱，或运行命令面板中的 **Qiuniu: New Visual Score** 创建新乐谱。
4. 选择时值和记谱工具，在五线谱上点选添加音符；拖动已有音符调整音高。重复运行 **Qiuniu: New Visual Score** 会自动建议不同文件名，方便同时编辑多份新乐谱。
5. 调节速度后点击 **播放** 试听；点击 **预览雕版** 查看排版，或点击 **导出 PDF** 保存所有页面。

仓库 [`examples/`](./examples/) 中有《欢乐颂》《小星星》《两只老虎》、公有领域作品《致爱丽丝》的简化旋律编配，以及两首原创的 16 小节乐曲《夏日风铃》和《溪流与晨光》。可以直接打开 `.music` 文件体验编辑器。

## 当前支持范围

当前版本面向单行旋律创作，支持一个高音谱表及上述常用音符、休止符和基础调拍号。尚不支持任意 LilyPond `.ly` 源码导入、和弦、多声部、其他谱号或完整的专业制谱功能。

`.music` 是可视化编辑器的源文件格式。已有的 LilyPond `.ly` 文档仍可通过 **Qiuniu: Preview LilyPond Source** 生成预览，但目前不会把任意 `.ly` 语法反向转换成可视化乐谱。

## LilyPond 在项目中的角色

Qiuniu Score Editor 维护自己的结构化乐谱模型和 `.music` 文档格式，并从模型生成 LilyPond 记谱输入。LilyPond 目前通过官方 standalone 运行时以命令行进程的方式执行，负责高质量雕版和预览；它不负责 HTML5 编辑画布的交互绘制。

各平台 VSIX 分别打包对应的 LilyPond 2.26.0 运行时与所需资源。Linux 运行仍依赖宿主系统的 glibc（官方 x64 二进制要求 glibc 2.28 或更新版本）及系统加载器。包内包含许可证和第三方声明；对应的 LilyPond 源码归档会随 GitHub Release 一同提供。项目不把 LilyPond 源码仓库作为子模块，也不依赖它来构建扩展。

## 本地开发

需要 Node.js 22、npm，以及 VS Code 1.85 或更新版本。

```sh
npm install
npm run prepare:lilypond -- linux-x64
npm run compile
npm test
```

在对应平台上将 `linux-x64` 替换为 `win32-x64`、`darwin-x64` 或 `darwin-arm64`。不准备本地运行时也可以运行测试；依赖真实 LilyPond 雕版的集成测试会在运行时不可用时跳过。

在 VS Code 中打开仓库并按 **F5** 启动扩展开发宿主。运行 **Qiuniu: New Visual Score** 创建乐谱。也可以用 `npm test` 运行测试；测试包括 Score Model 序列化、乐谱示例校验以及可用时的真实 LilyPond 雕版。

## CI 与发布

GitHub Actions 会在推送到 `main`、面向 `main` 的 Pull Request 和手动触发时运行类型检查、测试，并为 Linux x64、Windows x64、macOS x64 和 macOS arm64 构建平台专属 VSIX。推送版本标签（例如 `v0.1.0`）会创建 GitHub Release，并附上各平台安装包及对应的 LilyPond 源码归档。

## 项目结构

- `src/score/` — 结构化乐谱模型与 LilyPond 输入生成
- `src/visualEditor/`、`media/` — HTML5 交互式谱面编辑器
- `src/engine/` — 乐谱雕版引擎接口及 LilyPond 适配
- `src/compiler/` — LilyPond 命令行调用和输出管理
- `src/preview/` — LilyPond 雕版预览
- `examples/` — 可直接打开的 `.music` 示例
- `docs/architecture/` — 编辑器与运行时架构说明
