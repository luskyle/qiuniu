import * as vscode from "vscode";
import { createEmptyScore, ScoreModel, serializeScore } from "../score/score";

interface ScoreUpdateMessage {
  type: "scoreChanged";
  notes: ScoreModel["notes"];
}

export class VisualScoreEditor {
  static async open(extensionUri: vscode.Uri): Promise<void> {
    const sourceDocument = await vscode.workspace.openTextDocument({
      language: "lilypond",
      content: serializeScore(createEmptyScore())
    });
    const mediaDirectory = vscode.Uri.joinPath(extensionUri, "media");
    const panel = vscode.window.createWebviewPanel(
      "lilypondVisualScore",
      "LilyPond Visual Score",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [mediaDirectory]
      }
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(mediaDirectory, "visualScoreEditor.js")
    );
    panel.webview.html = createEditorHtml(panel.webview, scriptUri);

    await vscode.window.showTextDocument(
      sourceDocument,
      vscode.ViewColumn.Beside,
      true
    );

    let updateQueue = Promise.resolve();
    let lastGeneratedSource = sourceDocument.getText();
    let syncBlocked = false;
    panel.webview.onDidReceiveMessage((message: ScoreUpdateMessage) => {
      if (message.type !== "scoreChanged" || syncBlocked) {
        return;
      }

      updateQueue = updateQueue
        .then(async () => {
          if (sourceDocument.getText() !== lastGeneratedSource) {
            syncBlocked = true;
            throw new Error(
              "The generated LilyPond source was edited outside the visual editor. Reopen a new visual score to continue editing."
            );
          }
          const source = serializeScore({
            schemaVersion: 1,
            notes: message.notes
          });
          const edit = new vscode.WorkspaceEdit();
          const range = new vscode.Range(
            sourceDocument.positionAt(0),
            sourceDocument.positionAt(sourceDocument.getText().length)
          );
          edit.replace(sourceDocument.uri, range, source);
          if (!(await vscode.workspace.applyEdit(edit))) {
            throw new Error("Could not update the generated LilyPond source.");
          }
          lastGeneratedSource = source;
        })
        .catch(async (error: unknown) => {
          const messageText =
            error instanceof Error ? error.message : "Unknown score update error.";
          await panel.webview.postMessage({
            type: "scoreSyncError",
            message: messageText
          });
          await vscode.window.showErrorMessage(messageText);
        });
    });
  }
}

function createEditorHtml(
  webview: vscode.Webview,
  scriptUri: vscode.Uri
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src 'unsafe-inline';">
  <title>LilyPond Visual Score</title>
  <style>
    body { margin: 0; padding: 20px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    h1 { margin: 0 0 6px; font-size: 1.25rem; }
    .hint { margin: 0 0 16px; opacity: .75; }
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    button { min-width: 42px; padding: 6px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button[aria-pressed="true"] { outline: 2px solid var(--vscode-focusBorder); }
    .separator { width: 1px; height: 26px; margin: 0 4px; background: var(--vscode-editorWidget-border); }
    .staff-scroll { overflow-x: auto; padding: 20px 0; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); }
    #staff { position: relative; min-width: 860px; height: 340px; overflow: hidden; touch-action: none; user-select: none; }
    .staff-lines { position: absolute; left: 90px; right: 25px; top: 100px; height: 101px; pointer-events: none; background: repeating-linear-gradient(to bottom, var(--vscode-editor-foreground) 0 1.5px, transparent 1.5px 25px); }
    .clef { position: absolute; left: 20px; top: 150px; font: 76px/1 serif; pointer-events: none; }
    .note { position: absolute; width: 30px; height: 18px; padding: 0; min-width: 0; border: 0; color: var(--vscode-editor-foreground); background: transparent; cursor: ns-resize; touch-action: none; }
    .note:active { cursor: grabbing; }
    .note::before { content: ""; position: absolute; left: 2px; top: 2px; width: 18px; height: 13px; border: 1.7px solid currentColor; border-radius: 50%; background: var(--vscode-editorWidget-background); transform: rotate(-18deg); }
    .note[data-duration="4"]::before, .note[data-duration="8"]::before, .note[data-duration="16"]::before { background: currentColor; }
    .note-stem { position: absolute; left: 19px; top: -34px; height: 40px; border-left: 1.6px solid currentColor; }
    .note[data-duration="1"] .note-stem { display: none; }
    .note-flag { position: absolute; left: 19px; top: -34px; width: 13px; height: 18px; border-right: 2px solid currentColor; border-radius: 0 0 60% 0; transform: skewY(25deg); }
    .note[data-duration="4"] .note-flag, .note[data-duration="2"] .note-flag, .note[data-duration="1"] .note-flag { display: none; }
    .note[data-duration="16"] .note-flag::after { content: ""; position: absolute; top: 8px; right: -2px; height: 18px; border-right: 2px solid currentColor; }
    .note.selected::before { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
    .ledger-line { position: absolute; left: -4px; width: 27px; border-top: 1.5px solid currentColor; pointer-events: none; }
    .status { min-height: 1.5em; margin-top: 10px; opacity: .8; }
    .source-hint { margin-top: 18px; padding: 10px 12px; border-left: 3px solid var(--vscode-focusBorder); background: var(--vscode-textBlockQuote-background); }
    kbd { padding: 1px 5px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Visual score</h1>
  <p class="hint">The staff below is the editor. Place and move notes directly on it; changes are mirrored as LilyPond source in the adjacent editor pane.</p>
  <div class="toolbar" aria-label="Note tools">
    <button class="duration" data-duration="1" draggable="true" aria-label="Whole note" title="Whole note">𝅝</button>
    <button class="duration" data-duration="2" draggable="true" aria-label="Half note" title="Half note">𝅗𝅥</button>
    <button class="duration" data-duration="4" draggable="true" aria-label="Quarter note" title="Quarter note">♩</button>
    <button class="duration" data-duration="8" draggable="true" aria-label="Eighth note" title="Eighth note">♪</button>
    <button class="duration" data-duration="16" draggable="true" aria-label="Sixteenth note" title="Sixteenth note">𝅘𝅥𝅯</button>
    <span class="separator"></span>
    <button id="remove-note" title="Delete selected note" disabled>Delete note</button>
  </div>
  <div class="staff-scroll">
    <div id="staff" role="application" aria-label="Interactive treble-clef staff"></div>
  </div>
  <div id="status" class="status" role="status" aria-live="polite"></div>
  <p class="source-hint">This is a native HTML5 editing surface, not a rendered score image. Select a note and use <kbd>↑</kbd>/<kbd>↓</kbd> to change its pitch, or <kbd>Delete</kbd> to remove it. LilyPond remains the source format and final engraving engine.</p>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
