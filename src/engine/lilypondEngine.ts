import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileScore, removeCompiledScore } from "../compiler/lilypond";

export interface RenderOptions {
  executable?: string;
  baseDirectory?: string;
  extensionPath?: string;
}

export interface RenderedScore {
  pages: string[];
  dispose(): Promise<void>;
}

export interface LilyPondEngine {
  render(source: string, options?: RenderOptions): Promise<RenderedScore>;
}

export class CommandLineLilyPondEngine implements LilyPondEngine {
  async render(
    source: string,
    options: RenderOptions = {}
  ): Promise<RenderedScore> {
    const inputDirectory = await mkdtemp(
      path.join(os.tmpdir(), "lilypond-source-")
    );
    const sourcePath = path.join(inputDirectory, "score.ly");

    try {
      await writeFile(sourcePath, source, "utf8");
      const result = await compileScore(
        sourcePath,
        await resolveLilyPondExecutable(
          options.extensionPath,
          options.executable
        ),
        options.baseDirectory ?? inputDirectory
      );
      let disposed = false;
      return {
        pages: result.pages,
        async dispose(): Promise<void> {
          if (disposed) {
            return;
          }
          disposed = true;
          await Promise.all([
            removeCompiledScore(result.outputDirectory),
            rm(inputDirectory, { recursive: true, force: true })
          ]);
        }
      };
    } catch (error) {
      await rm(inputDirectory, { recursive: true, force: true });
      throw error;
    }
  }
}

export async function resolveLilyPondExecutable(
  extensionPath?: string,
  configuredExecutable?: string
): Promise<string> {
  if (configuredExecutable?.trim()) {
    return configuredExecutable.trim();
  }
  if (!extensionPath) {
    return "lilypond";
  }

  const executableName =
    process.platform === "win32" ? "lilypond.exe" : "lilypond";
  const executable = path.join(
    extensionPath,
    "runtime",
    "lilypond",
    "bin",
    executableName
  );
  try {
    await access(executable);
    return executable;
  } catch {
    throw new Error(
      `The bundled LilyPond runtime is missing for ${process.platform}-${process.arch}. Reinstall the matching platform VSIX or set lilypond.executable to a local LilyPond executable.`
    );
  }
}

export const lilyPondEngine: LilyPondEngine =
  new CommandLineLilyPondEngine();
