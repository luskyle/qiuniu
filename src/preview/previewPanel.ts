import * as vscode from "vscode";
import { compileScore, removeCompiledScore } from "../compiler/lilypond";

export class PreviewPanel implements vscode.Disposable {
  private static readonly panels = new Map<string, PreviewPanel>();

  static open(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      void existing.render();
      return;
    }

    const instance = new PreviewPanel(document);
    this.panels.set(key, instance);
    instance.panel.reveal(vscode.ViewColumn.Beside);
    void instance.render();
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private outputDirectory?: string;
  private renderVersion = 0;
  private disposed = false;

  private constructor(private readonly document: vscode.TextDocument) {
    this.panel = vscode.window.createWebviewPanel(
      "lilypondScorePreview",
      `Score: ${document.uri.fsPath.split(/[\\/]/).pop() ?? "Untitled"}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        localResourceRoots: []
      }
    );
    this.panel.webview.html = this.createMessagePage(
      "Compiling LilyPond score…"
    );
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((savedDocument) => {
        if (savedDocument.uri.toString() === this.document.uri.toString()) {
          void this.render();
        }
      }),
      this.panel.onDidDispose(() => this.dispose())
    );
  }

  private async render(): Promise<void> {
    const version = ++this.renderVersion;
    this.panel.webview.html = this.createMessagePage(
      "Compiling LilyPond score…"
    );

    let outputDirectory: string | undefined;
    try {
      const executable = vscode.workspace
        .getConfiguration("lilypond")
        .get<string>("executable", "lilypond");
      const result = await compileScore(this.document.uri.fsPath, executable);
      outputDirectory = result.outputDirectory;

      if (this.disposed || version !== this.renderVersion) {
        await removeCompiledScore(outputDirectory);
        return;
      }

      this.panel.webview.options = {
        enableScripts: false,
        localResourceRoots: [vscode.Uri.file(outputDirectory)]
      };
      const previousOutput = this.outputDirectory;
      this.outputDirectory = outputDirectory;
      outputDirectory = undefined;

      this.panel.webview.html = this.createScorePage(result.pages);
      if (previousOutput) {
        await removeCompiledScore(previousOutput);
      }
    } catch (error) {
      if (!this.disposed && version === this.renderVersion) {
        const message =
          error instanceof Error ? error.message : "Unknown compilation error.";
        this.panel.webview.html = this.createMessagePage(message);
      }
    } finally {
      if (outputDirectory) {
        await removeCompiledScore(outputDirectory);
      }
    }
  }

  private createScorePage(pages: string[]): string {
    const images = pages
      .map((page, index) => {
        const imageUri = this.panel.webview.asWebviewUri(
          vscode.Uri.file(page)
        );
        return `<figure><img src="${escapeHtml(imageUri.toString())}" alt="Score page ${index + 1}"><figcaption>Page ${index + 1}</figcaption></figure>`;
      })
      .join("\n");

    return this.createPage(`<main class="scores">${images}</main>`);
  }

  private createMessagePage(message: string): string {
    return this.createPage(
      `<main class="message">${escapeHtml(message)}</main>`
    );
  }

  private createPage(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.panel.webview.cspSource} data:; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LilyPond Score Preview</title>
  <style>
    body { margin: 0; padding: 24px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .scores { display: grid; gap: 24px; justify-items: center; }
    figure { margin: 0; max-width: 100%; text-align: center; }
    img { display: block; max-width: 100%; height: auto; background: white; }
    figcaption { margin-top: 8px; opacity: 0.7; }
    .message { white-space: pre-wrap; }
  </style>
</head>
<body>${content}</body>
</html>`;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderVersion++;
    PreviewPanel.panels.delete(this.document.uri.toString());
    this.disposables.forEach((disposable) => disposable.dispose());
    if (this.outputDirectory) {
      void removeCompiledScore(this.outputDirectory).catch((error: unknown) => {
        console.error("Failed to clean up LilyPond preview output.", error);
      });
      this.outputDirectory = undefined;
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
