# LilyPond 原生运行时与可视化记谱方案

## 目标

- 把 LilyPond 作为扩展随包分发的本地运行时，而不是要求用户单独安装。
- 为扩展内部提供稳定、可替换的渲染 API。
- 用户通过拖拽和点选记谱，直接看到可编辑的五线谱；LilyPond 源码由结构化乐谱模型生成，不要求用户手写语法。
- H5 记谱画布是直接编辑的主界面；LilyPond 作为后台源码目标和最终高质量排版/导出引擎，不能替代交互编辑画布。

## 版本与分发约束

扩展直接使用官方发布的 LilyPond standalone distributions，不克隆、不构建也不修改 LilyPond Git 源码仓库。运行时版本固定为已验证的稳定发布版 2.26.0，各平台下载包的 SHA-256 固定在 `scripts/prepare-lilypond-runtime.mjs`，以保证 CI 和本地构建可复现。升级时只需选择一个正式发布版，更新平台归档及其校验值，再运行各平台雕版和 VSIX 验证。

LilyPond 当前通过 CLI 作为独立进程调用；本方案不假设官方发行版提供可直接加载的动态库 ABI。将来若需要 DLL、SO 或 dylib，须另外维护并验证共享库封装及其依赖、线程和崩溃隔离。

随包分发 LilyPond 二进制仍需处理 GPL 文本、版权/许可声明及对应源代码的可获取性。发布流程附带与所打包版本精确匹配的官方源码归档，仅用于满足再分发义务；它不是 Git 子模块，也不参与扩展构建。这里不对 Apache-2.0 扩展代码与 GPL 组件组合的法律兼容性作未经审查的结论。

## 方案选择

### 前端编辑数据

以版本化、可校验的结构化 Score Model 作为交互编辑的唯一数据源，并存入 `.music` 文件。VS Code 将 `.music` 注册为默认自定义编辑器，因此打开文件直接进入记谱 Webview。Webview 使用 HTML5 DOM/CSS 直接绘制并编辑五线谱元素，而非把 LilyPond 渲染的 SVG/图片作为编辑面；每次交互通过 WorkspaceEdit 保存回同一个 `.music` 文档。TypeScript serializer 从模型生成 LilyPond 源码供后台雕版和预览，不要求用户维护 `.ly` 文件。后续加入打开/导入原始 `.ly` 时，须明确支持的语法子集和不可逆语法的保留策略。

### 渲染引擎接口

扩展依赖 `LilyPondEngine` API，不直接依赖某一种运行时：

```ts
interface LilyPondEngine {
  render(source: string, options?: RenderOptions): Promise<RenderedScore>;
}
```

当前实现继续使用 LilyPond CLI 作为开发阶段适配器。未来可新增原生共享库适配器或随扩展发行的 sidecar 适配器，编辑器、源码生成和预览 UI 不需要改变。调用层应使用独立临时目录、异步请求、取消/过期渲染保护和明确的诊断信息。

### 原生运行时交付决策

首选先比较两条路线，而不是假设上游已提供库：

1. **平台 sidecar（建议先行验证）**：分别为 Windows x64/arm64、Linux x64/arm64、macOS x64/arm64 使用官方发布的 LilyPond 完整运行时，以独立进程提供 JSON-RPC/stdin-stdout 或本地 socket API。保留进程隔离，避免把 Guile/Pango 初始化和符号空间耦合进 VS Code Node Host。发布平台专属 VSIX 或通过 VS Code 平台选择器下载，并校验签名/哈希。
2. **共享库封装（需要可行性原型后再决定）**：维护一个薄的、版本化 C ABI（例如 `lilypond_create`、`lilypond_render`、`lilypond_cancel`、`lilypond_destroy`），再由 N-API/Rust bridge 调用。必须证明所有支持平台均能构建和加载，资源闭包、线程、崩溃隔离及 GPL 源码义务可接受。官方发布版没有 ABI 保证，升级 LilyPond 时要维护该 adapter。

真正给扩展用户交付 DLL/SO/dylib 前，先完成一个平台原型、依赖闭包清单、最小 API、崩溃/取消测试、包体积和 GPL 再分发审查。若任一平台不可靠，平台 sidecar 是正式降级方案；不要发布空壳库或只带 Linux 库的“跨平台”VSIX。

## 分阶段实施

### 阶段 1：可视化记谱闭环（MVP 已实现）

- 新增 typed Score Model 和 deterministic LilyPond serializer。
- 暴露 `LilyPondEngine` 接口并把现有 CLI 渲染封装为默认适配器。
- 提供 VS Code `.music` 自定义编辑器：拖放时值到五线谱、点选添加音符、拖动音符改变音高；乐谱模型保存在当前 `.music` 文件，并可按需生成 LilyPond 源码预览。
- 加 serializer/交互协议测试和开发说明。

### 阶段 2：原生运行时可行性（Linux 运行时原型已验证）

- 固定可发行的 LilyPond 稳定版本并梳理每个平台构建环境、运行时依赖、字体/资源和许可证。
- 先做 Linux 原型，对比 sidecar 和 C ABI shared library 的构建/调用/崩溃隔离成本。
- 形成 API 版本策略、并发/取消语义、错误诊断结构和包体积基线。

### 阶段 3：平台交付（2.26.0 的四个平台包已接入）

- 建立 Windows/macOS/Linux 构建矩阵和可复现供应链，生成平台对应工件。
- 将实际运行时装入平台专属 VSIX，或在安装时下载校验的平台工件；不得把一种 OS 的库放入通用包。
- 附上对应的官方源码归档、GPL 许可/声明并验证可获取对应源码。
- CI 对每个平台执行加载测试、样例 `.music` 渲染、取消/并发和打包内容检查。

### 阶段 4：编辑器扩展

- 扩展 Score Model：谱号/多声部/连线/力度/歌词。
- 实现键盘无障碍输入、选择/复制/移动与实时诊断。
- 评估 LilyPond source-map/点选回跳和 SVG 点选高亮。

### 当前实现状态与边界

阶段 1 已实现单高音谱表的 HTML5 DOM/CSS 交互编辑器、`.music` 模型文件、自定义编辑器、可替换的 `LilyPondEngine` 和 CLI 适配器。编辑器支持乐谱标题、音符、休止符、静音空白符（LilyPond skip）、升降记号、附点时值、常见调号/拍号、40–240 BPM 速度设置，并将长乐谱自动排版到连续 A4 页面；每行保持相同的小节数量，小节内事件等距排列。页面会补足空白谱行以铺满纸面，且空白乐谱也保留可点击的谱表。标题保存在 `.music` 文件中，LilyPond 雕版和 PDF 导出会显示标题。一个 `.music` 文件可包含多页。画布支持钢琴音色试听与多页 PDF 导出，PDF 由 LilyPond 直接生成。可视化编辑器不以内嵌 SVG 作为交互编辑面。尚未实现导入任意 `.ly` 或原生共享库。各平台 LilyPond standalone runtime 已打入对应的 VSIX。

平台交付现使用官方 LilyPond 2.26.0 standalone release archives：Linux x64 40.6 MB、Windows x64 43.4 MB、macOS x64 39.6 MB、macOS arm64 38.9 MB（压缩下载体积）。解包后的 Linux runtime 约 134 MB，包含 `bin/`、`lib/`、`libexec/`、`share/`、字体与所有依赖许可证；`ldd` 未发现缺失依赖，独立运行 `--version` 和真实 SVG 雕版成功。Linux 仍需操作系统的 glibc（检查出的最低符号版本为 GLIBC_2.28）和 ELF loader；“独立”表示不需要另装 LilyPond/Guile/字体包，并非替换操作系统基础 ABI。官方下载 URL 和 SHA-256 在 `scripts/prepare-lilypond-runtime.mjs` 固定校验。CI 将每个平台的完整 runtime 放进相应 target VSIX，不再将 Linux 资源混入 Windows/macOS 包。VSIX 内包含官方提供的组件 license notices；tag release 同时附上精确匹配的 LilyPond 2.26.0 官方源码归档，用于 GPL 源码可获取性，不依赖或检出 Git 源码仓库。

CI 在 Linux、Windows、macOS Intel、macOS Apple Silicon 原生 runner 上对每个平台的 bundled runtime 执行版本检查和真实 SVG 雕版，再生成对应 VS Code target 的 VSIX；包体检查验证 runtime 可执行文件、SHA 元数据、LilyPond GPL、第三方 notices 与 HTML5 编辑器均在包内。扩展通过进程调用 standalone CLI，不把 LilyPond 动态链接进 VS Code Host；由于官方发行物提供的是完整程序/runtime 包，这比自行维护一个无上游 ABI 保证的 shared library 更可靠。

## 验收标准

- 用户无需编辑 LilyPond 语法即可通过五线谱交互加入、拖动音符。
- 每次结构化编辑都能稳定生成有效的 LilyPond 源码，并同步展示。
- 生成源码可通过 LilyPond 编译为 SVG/PDF。
- 预览调用经由 `LilyPondEngine` 接口，不与 UI 耦合到 CLI。
- 文档明确区分目前已实现的 CLI 适配器与未来原生动态库/sidecar。
