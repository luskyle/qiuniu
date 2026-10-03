import * as vscode from "vscode";
export function createEditorHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const mediaDirectory = vscode.Uri.joinPath(extensionUri, "media");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(mediaDirectory, "visualScoreEditor.js")
  );
  return createEditorDocument(webview, scriptUri);
}

function createEditorDocument(
  webview: vscode.Webview,
  scriptUri: vscode.Uri
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src 'unsafe-inline';">
  <title>乐谱工作台</title>
  <style>
    :root { color-scheme: light dark; }
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px 12px 28px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .workspace { max-width: 980px; margin: 0 auto; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 0 auto 14px; max-width: 794px; }
    .brand { display: flex; align-items: center; gap: 13px; }
    .brand-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font-size: 25px; }
    h1 { margin: 0; font-size: 1.2rem; font-weight: 650; letter-spacing: .01em; }
    .subtitle { margin-top: 3px; color: var(--vscode-descriptionForeground); font-size: .82rem; }
    button, select { color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-widget-border)); border-radius: 7px; font: inherit; }
    button { cursor: pointer; }
    button:focus-visible, select:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .primary { padding: 9px 16px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: transparent; font-weight: 600; }
    .primary:hover { background: var(--vscode-button-hoverBackground); }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .play-button { min-height: 36px; padding: 0 14px; font-weight: 600; }
    .play-button[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: transparent; }
    .toolbox { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px; margin-bottom: 14px; border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); border-radius: 12px; background: var(--vscode-editorWidget-background); }
    .tool-group { display: flex; align-items: center; gap: 6px; padding: 0 10px; border-right: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); }
    .tool-group:last-child { border: 0; }
    .group-label { margin-right: 3px; color: var(--vscode-descriptionForeground); font-size: .75rem; white-space: nowrap; }
    select { min-height: 34px; padding: 0 28px 0 10px; }
    .duration { display: grid; width: 38px; height: 36px; place-items: center; font-family: serif; font-size: 22px; }
    .duration:hover, .tool-toggle:hover, #remove-note:hover { border-color: var(--vscode-focusBorder); }
    button[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-color: transparent; }
    .tool-toggle { min-height: 34px; padding: 0 11px; }
    #remove-note { min-height: 34px; padding: 0 12px; }
    #remove-note:disabled { cursor: default; opacity: .45; }
    .sheet-shell { padding: 0; border: 0; background: transparent; }
    #score-sheet { display: flex; flex-direction: column; align-items: center; gap: 18px; }
    .score-page { position: relative; width: min(100%, 210mm); min-height: 297mm; padding: 12mm 11mm; overflow: hidden; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); box-shadow: 0 8px 26px color-mix(in srgb, var(--vscode-widget-shadow, #000) 22%, transparent); }
    .page-systems { display: flex; flex-direction: column; gap: 8px; }
    .page-number { position: absolute; right: 11mm; bottom: 6mm; color: var(--vscode-descriptionForeground); font-size: .7rem; }
    .staff-system { position: relative; width: 100%; min-width: 0; height: 150px; overflow: hidden; border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border, var(--vscode-editorWidget-border)) 60%, transparent); background: var(--vscode-editor-background); touch-action: none; user-select: none; }
    .measure-signature { position: absolute; top: 3px; left: 62px; color: var(--vscode-descriptionForeground); font-size: .68rem; }
    .staff-lines { position: absolute; top: 34px; right: 9px; left: 61px; height: 101px; pointer-events: none; background: repeating-linear-gradient(to bottom, var(--vscode-editor-foreground) 0 1.5px, transparent 1.5px 25px); opacity: .8; }
    .barline { position: absolute; top: 34px; height: 101px; border-left: 1.5px solid var(--vscode-editor-foreground); opacity: .65; pointer-events: none; }
    .clef { position: absolute; top: 78px; left: 12px; font: 58px/1 serif; pointer-events: none; }
    .score-item { position: absolute; width: 30px; height: 18px; min-width: 0; padding: 0; border: 0; color: var(--vscode-editor-foreground); background: transparent; cursor: ns-resize; touch-action: none; }
    .score-item:active { cursor: grabbing; }
    .notehead { position: absolute; top: 2px; left: 5px; width: 17px; height: 12px; border: 1.7px solid currentColor; border-radius: 50%; background: var(--vscode-editor-background); transform: rotate(-18deg); }
    .score-item[data-duration="4"] .notehead, .score-item[data-duration="8"] .notehead, .score-item[data-duration="16"] .notehead { background: currentColor; }
    .note-stem { position: absolute; top: -31px; left: 21px; height: 38px; border-left: 1.6px solid currentColor; }
    .score-item[data-duration="1"] .note-stem { display: none; }
    .note-flag { position: absolute; top: -30px; left: 21px; width: 12px; height: 17px; border-right: 2px solid currentColor; border-radius: 0 0 60% 0; transform: skewY(25deg); }
    .score-item[data-duration="1"] .note-flag, .score-item[data-duration="2"] .note-flag, .score-item[data-duration="4"] .note-flag { display: none; }
    .score-item[data-duration="16"] .note-flag::after { position: absolute; top: 8px; right: -2px; height: 15px; border-right: 2px solid currentColor; content: ""; }
    .note-accidental { position: absolute; top: -3px; left: -9px; font: 20px/1 serif; }
    .note-dot { position: absolute; top: 3px; right: -2px; font-size: 17px; }
    .note-rest { position: absolute; top: -9px; left: 1px; font: 34px/1 serif; }
    .score-item.selected .notehead, .score-item.selected .note-rest { filter: drop-shadow(0 0 4px var(--vscode-focusBorder)); }
    .ledger-line { position: absolute; left: 1px; width: 27px; border-top: 1.5px solid currentColor; pointer-events: none; }
    .statusbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 36px; padding: 7px 3px 0; color: var(--vscode-descriptionForeground); font-size: .78rem; }
    #status { min-height: 1.25em; }
    .keyboard-hint { text-align: right; }
    kbd { padding: 1px 5px; border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); border-radius: 4px; background: var(--vscode-editor-background); }
    @media print { body { padding: 0; background: #fff; } .topbar, .toolbox, .statusbar { display: none; } #score-sheet { gap: 0; } .score-page { width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm; padding: 12mm 11mm; border: 0; box-shadow: none; break-after: page; } .score-page:last-child { break-after: auto; } }
    @media (max-width: 720px) { body { padding: 12px 8px 20px; } .topbar { align-items: flex-start; } .toolbox { align-items: stretch; } .tool-group { padding: 0 5px; } .score-page { min-height: 297mm; padding: 8mm 6mm; } .statusbar { align-items: flex-start; flex-direction: column; gap: 3px; } .keyboard-hint { text-align: left; } }
  </style>
</head>
<body>
  <main class="workspace">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">♫</div>
        <div><h1>乐谱工作台</h1><div class="subtitle">可视化五线谱 · .music 文档</div></div>
      </div>
      <div class="top-actions">
        <button id="play-score" class="play-button" aria-pressed="false" title="播放当前乐谱">▶&nbsp; 播放</button>
        <button id="preview-score" class="primary">预览雕版</button>
      </div>
    </header>
    <section class="toolbox" aria-label="记谱工具">
      <div class="tool-group">
        <span class="group-label">调性</span>
        <select id="key-signature" aria-label="调号">
          <option value="C major">C 大调</option><option value="G major">G 大调</option>
          <option value="D major">D 大调</option><option value="F major">F 大调</option>
          <option value="Bb major">降 B 大调</option><option value="A minor">A 小调</option>
          <option value="E minor">E 小调</option><option value="D minor">D 小调</option>
        </select>
        <select id="time-signature" aria-label="拍号">
          <option value="2/4">2/4</option><option value="3/4">3/4</option>
          <option value="4/4">4/4</option><option value="6/8">6/8</option>
          <option value="12/8">12/8</option>
        </select>
      </div>
      <div class="tool-group" aria-label="音符时值">
        <span class="group-label">时值</span>
        <button class="duration" data-duration="1" aria-label="全音符" title="全音符">𝅝</button>
        <button class="duration" data-duration="2" aria-label="二分音符" title="二分音符">𝅗𝅥</button>
        <button class="duration" data-duration="4" aria-label="四分音符" title="四分音符">♩</button>
        <button class="duration" data-duration="8" aria-label="八分音符" title="八分音符">♪</button>
        <button class="duration" data-duration="16" aria-label="十六分音符" title="十六分音符">𝅘𝅥𝅯</button>
        <button id="dotted-tool" class="tool-toggle" aria-pressed="false" title="附点">附点&nbsp;·</button>
      </div>
      <div class="tool-group">
        <span class="group-label">输入</span>
        <button id="note-tool" class="tool-toggle" aria-pressed="true">音符</button>
        <button id="rest-tool" class="tool-toggle" aria-pressed="false">休止符</button>
        <select id="accidental-tool" aria-label="临时升降记号">
          <option value="none">不加记号</option><option value="0">还原号 ♮</option>
          <option value="1">升号 ♯</option>
          <option value="-1">降号 ♭</option>
        </select>
      </div>
      <div class="tool-group">
        <button id="remove-note" title="删除选中的音符或休止符" disabled>删除</button>
      </div>
    </section>
    <section class="sheet-shell" aria-label="五线谱画布">
      <div id="score-sheet" role="application" aria-label="可交互的高音谱表"></div>
    </section>
    <footer class="statusbar">
      <div id="status" role="status" aria-live="polite">正在载入乐谱…</div>
      <div class="keyboard-hint">选择音符后按 <kbd>↑</kbd>/<kbd>↓</kbd> 移调，<kbd>Delete</kbd> 删除</div>
    </footer>
  </main>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
