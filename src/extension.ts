import * as vscode from "vscode";
import { PreviewPanel } from "./preview/previewPanel";

export function activate(context: vscode.ExtensionContext): void {
  const openPreview = vscode.commands.registerCommand(
    "lilypond.openPreview",
    async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || document.languageId !== "lilypond") {
        await vscode.window.showErrorMessage(
          "Open a LilyPond (.ly) file before starting the score preview."
        );
        return;
      }

      if (document.isUntitled || document.uri.scheme !== "file") {
        await vscode.window.showErrorMessage(
          "Save the LilyPond file to disk before starting the score preview."
        );
        return;
      }

      PreviewPanel.open(document);
    }
  );

  context.subscriptions.push(openPreview);
}

export function deactivate(): void {}
