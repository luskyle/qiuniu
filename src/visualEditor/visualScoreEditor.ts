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
    .toolbox { display: flex; flex-wrap: nowrap; align-items: center; gap: 0; min-height: 46px; padding: 5px 7px; margin-bottom: 14px; overflow-x: auto; border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); border-radius: 9px; background: var(--vscode-editorWidget-background); }
    .tool-group { display: flex; flex: 0 0 auto; align-items: center; gap: 3px; padding: 0 7px; border-right: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); }
    .tool-group:last-child { border: 0; }
    .group-label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
    select { min-height: 32px; padding: 0 24px 0 8px; }
    .tempo-control { display: flex; align-items: center; gap: 4px; color: var(--vscode-descriptionForeground); font-size: .72rem; white-space: nowrap; }
    #tempo { width: 54px; min-height: 30px; padding: 0 4px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-widget-border)); border-radius: 5px; font: inherit; }
    #tempo:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .toolbar-icon { display: grid; flex: 0 0 32px; width: 32px; height: 32px; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 5px; color: var(--vscode-icon-foreground, var(--vscode-editor-foreground)); background: transparent; }
    .toolbar-icon:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); }
    .toolbar-icon:disabled { cursor: default; opacity: .4; }
    .toolbar-icon[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    .toolbar-icon svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .duration { display: grid; flex: 0 0 32px; width: 32px; height: 32px; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 5px; font-family: serif; font-size: 21px; }
    .duration:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); }
    .duration[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    .toolbar-glyph { font: 20px/1 var(--vscode-font-family); }
    #note-tool .toolbar-glyph { font-family: serif; font-size: 22px; }
    #rest-tool .toolbar-glyph { font-family: serif; font-size: 20px; }
    #spacer-tool .toolbar-glyph { font-size: 18px; font-weight: 700; letter-spacing: -3px; padding-right: 3px; }
    .spacer-mark { position: absolute; top: -2px; left: 9px; color: var(--vscode-descriptionForeground); font-size: 13px; opacity: .65; }
    .score-item.spacer { border: 1px dashed color-mix(in srgb, var(--vscode-descriptionForeground) 42%, transparent); border-radius: 4px; cursor: pointer; }
    .sheet-shell { padding: 0; border: 0; background: transparent; }
    #score-sheet { display: flex; flex-direction: column; align-items: center; gap: 18px; }
    .score-page { position: relative; display: flex; flex-direction: column; width: min(100%, 210mm); height: 297mm; min-height: 297mm; padding: 12mm 11mm; overflow: hidden; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); box-shadow: 0 8px 26px color-mix(in srgb, var(--vscode-widget-shadow, #000) 22%, transparent); }
    .score-title { display: block; width: 100%; height: 36px; flex: 0 0 36px; margin: 0 0 4px; padding: 0 8px; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border, var(--vscode-editorWidget-border)) 55%, transparent); color: var(--vscode-editor-foreground); background: transparent; font: 600 19px/1.3 var(--vscode-font-family); text-align: center; }
    .score-title::placeholder { color: var(--vscode-descriptionForeground); opacity: .7; }
    .score-title:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .page-systems { display: flex; flex: 1; flex-direction: column; justify-content: space-between; min-height: 970px; }
    .page-number { position: absolute; right: 11mm; bottom: 6mm; color: var(--vscode-descriptionForeground); font-size: .7rem; }
    .staff-system { position: relative; width: 100%; min-width: 0; height: 120px; overflow: hidden; border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border, var(--vscode-editorWidget-border)) 60%, transparent); background: var(--vscode-editor-background); touch-action: none; user-select: none; }
    .measure-signature { position: absolute; top: 2px; left: 52px; color: var(--vscode-descriptionForeground); font-size: .64rem; }
    .staff-lines { position: absolute; top: 28px; right: 8px; left: 51px; height: 81px; pointer-events: none; background: repeating-linear-gradient(to bottom, var(--vscode-editor-foreground) 0 1px, transparent 1px 20px); opacity: .8; }
    .barline { position: absolute; top: 28px; height: 81px; border-left: 1px solid var(--vscode-editor-foreground); opacity: .65; pointer-events: none; }
    .clef { position: absolute; top: 63px; left: 10px; font: 47px/1 serif; pointer-events: none; }
    .score-item { position: absolute; width: 26px; height: 16px; min-width: 0; padding: 0; border: 0; color: var(--vscode-editor-foreground); background: transparent; cursor: ns-resize; touch-action: none; }
    .score-item:active { cursor: grabbing; }
    .score-item.playing { z-index: 2; border-radius: 5px; background: color-mix(in srgb, var(--vscode-focusBorder) 24%, transparent); box-shadow: 0 0 0 2px var(--vscode-focusBorder), 0 0 12px color-mix(in srgb, var(--vscode-focusBorder) 70%, transparent); }
    .score-item.playing .notehead, .score-item.playing .note-rest { filter: drop-shadow(0 0 5px var(--vscode-focusBorder)); }
    .notehead { position: absolute; top: 3px; left: 5px; width: 15px; height: 10px; border: 1.4px solid currentColor; border-radius: 50%; background: var(--vscode-editor-background); transform: rotate(-18deg); }
    .score-item[data-duration="4"] .notehead, .score-item[data-duration="8"] .notehead, .score-item[data-duration="16"] .notehead { background: currentColor; }
    .note-stem { position: absolute; top: -25px; left: 19px; height: 31px; border-left: 1.4px solid currentColor; }
    .score-item[data-duration="1"] .note-stem { display: none; }
    .note-flag { position: absolute; top: -24px; left: 19px; width: 10px; height: 14px; border-right: 1.6px solid currentColor; border-radius: 0 0 60% 0; transform: skewY(25deg); }
    .score-item[data-duration="1"] .note-flag, .score-item[data-duration="2"] .note-flag, .score-item[data-duration="4"] .note-flag { display: none; }
    .score-item[data-duration="16"] .note-flag::after { position: absolute; top: 7px; right: -2px; height: 12px; border-right: 1.6px solid currentColor; content: ""; }
    .note-accidental { position: absolute; top: -2px; left: -7px; font: 16px/1 serif; }
    .note-dot { position: absolute; top: 3px; right: -2px; font-size: 14px; }
    .note-rest { position: absolute; top: -7px; left: 1px; font: 27px/1 serif; }
    .score-item.selected .notehead, .score-item.selected .note-rest { filter: drop-shadow(0 0 4px var(--vscode-focusBorder)); }
    .ledger-line { position: absolute; left: 1px; width: 23px; border-top: 1px solid currentColor; pointer-events: none; }
    .statusbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 36px; padding: 7px 3px 0; color: var(--vscode-descriptionForeground); font-size: .78rem; }
    #status { min-height: 1.25em; }
    .keyboard-hint { text-align: right; }
    kbd { padding: 1px 5px; border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border)); border-radius: 4px; background: var(--vscode-editor-background); }
    @media print { body { padding: 0; background: #fff; } .topbar, .toolbox, .statusbar { display: none; } #score-sheet { gap: 0; } .score-page { width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm; padding: 12mm 11mm; border: 0; box-shadow: none; break-after: page; } .score-page:last-child { break-after: auto; } .score-title { border: 0; color: #111; } }
    @media (max-width: 720px) { body { padding: 12px 8px 20px; } .topbar { align-items: flex-start; } .tool-group { padding: 0 5px; } .score-page { min-height: 297mm; padding: 8mm 6mm; } .statusbar { align-items: flex-start; flex-direction: column; gap: 3px; } .keyboard-hint { text-align: left; } }
  </style>
</head>
<body>
  <main class="workspace">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">♫</div>
        <div><h1>乐谱工作台</h1><div class="subtitle">可视化五线谱 · .music 文档</div></div>
      </div>
    </header>
    <section class="toolbox" aria-label="记谱工具">
      <div class="tool-group" aria-label="乐谱设置">
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
        <label class="tempo-control" for="tempo">速度
          <input id="tempo" type="number" min="40" max="240" step="1" value="100" aria-label="播放速度 BPM">
          <span>BPM</span>
        </label>
      </div>
      <div class="tool-group" aria-label="音符时值">
        <button class="duration" data-duration="1" aria-label="全音符" title="全音符">𝅝</button>
        <button class="duration" data-duration="2" aria-label="二分音符" title="二分音符">𝅗𝅥</button>
        <button class="duration" data-duration="4" aria-label="四分音符" title="四分音符">♩</button>
        <button class="duration" data-duration="8" aria-label="八分音符" title="八分音符">♪</button>
        <button class="duration" data-duration="16" aria-label="十六分音符" title="十六分音符">𝅘𝅥𝅯</button>
        <button id="dotted-tool" class="toolbar-icon" aria-label="附点" aria-pressed="false" title="附点"><span class="toolbar-glyph" aria-hidden="true">·</span></button>
      </div>
      <div class="tool-group" aria-label="输入工具">
        <button id="note-tool" class="toolbar-icon" aria-label="音符" title="音符" aria-pressed="true"><span class="toolbar-glyph" aria-hidden="true">♩</span></button>
        <button id="rest-tool" class="toolbar-icon" aria-label="休止符" title="休止符" aria-pressed="false"><span class="toolbar-glyph" aria-hidden="true">𝄽</span></button>
        <button id="spacer-tool" class="toolbar-icon" aria-label="空白符" title="空白符（占用时值，不发声）" aria-pressed="false"><span class="toolbar-glyph" aria-hidden="true">···</span></button>
        <select id="accidental-tool" aria-label="临时升降记号">
          <option value="none">不加记号</option><option value="0">还原号 ♮</option>
          <option value="1">升号 ♯</option>
          <option value="-1">降号 ♭</option>
        </select>
      </div>
      <div class="tool-group" aria-label="编辑操作">
        <button id="remove-note" class="toolbar-icon" aria-label="删除选中的音符或休止符" title="删除" disabled><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div>
      <div class="tool-group" aria-label="乐谱操作">
        <button id="play-score" class="toolbar-icon" aria-label="播放当前乐谱" aria-pressed="false" title="播放当前乐谱"><span id="play-icon" class="toolbar-glyph" aria-hidden="true">▶</span></button>
        <button id="preview-score" class="toolbar-icon" aria-label="预览雕版" title="预览雕版"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button>
        <button id="export-pdf" class="toolbar-icon" aria-label="导出 PDF" title="导出 PDF"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 2.75h8l4 4V12M14 3v5h5M6 13v8h12v-8M12 12v7m-3-3 3 3 3-3"/><path d="M8 5H5v5"/></svg></button>
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
