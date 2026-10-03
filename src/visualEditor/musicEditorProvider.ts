import * as vscode from "vscode";
import {
  createEmptyScore,
  parseScore,
  serializeScore,
  serializeScoreFile
} from "../score/score";
import { PreviewPanel } from "../preview/previewPanel";
import { createEditorHtml } from "./visualScoreEditor";

interface ScoreChangedMessage {
  type: "scoreChanged";
  score: unknown;
}

export class MusicEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "lilypond.musicEditor";

  static register(
    context: vscode.ExtensionContext
  ): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      MusicEditorProvider.viewType,
      new MusicEditorProvider(context.extensionUri),
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true }
      }
    );
  }

  static async createNew(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder.uri, "Untitled.music")
      : undefined;
    const selectedUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { "Music score": ["music"] },
      saveLabel: "Create score",
      title: "Create a visual music score"
    });
    if (!selectedUri) {
      return;
    }

    const uri = selectedUri.path.toLowerCase().endsWith(".music")
      ? selectedUri
      : selectedUri.with({ path: `${selectedUri.path}.music` });
    try {
      await vscode.workspace.fs.writeFile(
        uri,
        new TextEncoder().encode(serializeScoreFile(createEmptyScore()))
      );
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        MusicEditorProvider.viewType
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create the score file.";
      await vscode.window.showErrorMessage(message);
    }
  }

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): void {
    const mediaDirectory = vscode.Uri.joinPath(this.extensionUri, "media");
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaDirectory]
    };
    panel.webview.html = createEditorHtml(panel.webview, this.extensionUri);

    let lastSyncedText = document.getText();
    let updateQueue = Promise.resolve();

    const postDocumentScore = async (): Promise<void> => {
      try {
        const score = parseScore(document.getText());
        lastSyncedText = document.getText();
        await panel.webview.postMessage({ type: "loadScore", score });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not read the .music score.";
        lastSyncedText = document.getText();
        await panel.webview.postMessage({
          type: "loadScore",
          error: message
        });
        await vscode.window.showErrorMessage(message);
      }
    };

    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (isReadyMessage(message)) {
        void postDocumentScore();
        return;
      }
      if (isPreviewRequestedMessage(message)) {
        try {
          const source = serializeScore(parseScore(document.getText()));
          PreviewPanel.openGenerated(source, document.uri, this.extensionUri.fsPath);
        } catch (error) {
          const messageText =
            error instanceof Error ? error.message : "Could not preview this score.";
          void vscode.window.showErrorMessage(messageText);
        }
        return;
      }
      if (!isScoreChangedMessage(message)) {
        return;
      }

      updateQueue = updateQueue
        .then(async () => {
          if (document.getText() !== lastSyncedText) {
            await postDocumentScore();
            throw new Error(
              "The .music file changed outside the visual editor. The canvas has been refreshed; retry your edit."
            );
          }

          const scoreSource = JSON.stringify(message.score);
          if (!scoreSource) {
            throw new Error("The visual editor sent an invalid score model.");
          }
          const score = parseScore(scoreSource);
          const source = serializeScoreFile(score);
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(
              document.positionAt(0),
              document.positionAt(document.getText().length)
            ),
            source
          );
          lastSyncedText = source;
          if (!(await vscode.workspace.applyEdit(edit))) {
            lastSyncedText = document.getText();
            throw new Error("Could not save the score changes to the .music file.");
          }
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

    const documentChange = vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        event.document.uri.toString() === document.uri.toString() &&
        event.document.getText() !== lastSyncedText
      ) {
        void postDocumentScore();
      }
    });
    panel.onDidDispose(() => documentChange.dispose());
  }
}

function isReadyMessage(message: unknown): message is { type: "ready" } {
  return isRecord(message) && message.type === "ready";
}

function isScoreChangedMessage(
  message: unknown
): message is ScoreChangedMessage {
  return isRecord(message) && message.type === "scoreChanged";
}

function isPreviewRequestedMessage(
  message: unknown
): message is { type: "previewRequested" } {
  return isRecord(message) && message.type === "previewRequested";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
