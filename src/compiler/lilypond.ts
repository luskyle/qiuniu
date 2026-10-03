import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface CompiledScore {
  outputDirectory: string;
  pages: string[];
}

export async function compileScore(
  sourcePath: string,
  executable: string,
  workingDirectory = path.dirname(sourcePath)
): Promise<CompiledScore> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "lilypond-preview-"));
  const outputPrefix = path.join(outputDirectory, "score");

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        executable,
        ["--svg", "--output", outputPrefix, sourcePath],
        {
          cwd: workingDirectory,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        },
        (error, _stdout, stderr) => {
          if (error) {
            if ("code" in error && error.code === "ENOENT") {
              reject(
                new Error(
                  `Could not find LilyPond executable "${executable}". Set lilypond.executable to its path.`
                )
              );
              return;
            }
            const details = stderr.trim();
            reject(
              new Error(
                details
                  ? `LilyPond compilation failed:\n${details}`
                  : `LilyPond compilation failed: ${error.message}`
              )
            );
            return;
          }
          resolve();
        }
      );
    });

    const pages = (await readdir(outputDirectory))
      .filter((file) => /^score(?:-\d+)?\.svg$/.test(file))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      )
      .map((file) => path.join(outputDirectory, file));

    if (pages.length === 0) {
      throw new Error("LilyPond finished without producing an SVG score.");
    }

    return { outputDirectory, pages };
  } catch (error) {
    await rm(outputDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function removeCompiledScore(
  outputDirectory: string
): Promise<void> {
  await rm(outputDirectory, { recursive: true, force: true });
}

export async function compileScoreToPdf(
  sourcePath: string,
  executable: string,
  outputPath: string,
  workingDirectory = path.dirname(sourcePath)
): Promise<void> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "qiuniu-pdf-"));
  const outputPrefix = path.join(outputDirectory, "score");
  const generatedPdf = `${outputPrefix}.pdf`;

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        executable,
        ["--pdf", "--output", outputPrefix, sourcePath],
        {
          cwd: workingDirectory,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        },
        (error, _stdout, stderr) => {
          if (error) {
            if ("code" in error && error.code === "ENOENT") {
              reject(
                new Error(
                  `Could not find LilyPond executable "${executable}". Set lilypond.executable to its path.`
                )
              );
              return;
            }
            const details = stderr.trim();
            reject(
              new Error(
                details
                  ? `LilyPond PDF export failed:\n${details}`
                  : `LilyPond PDF export failed: ${error.message}`
              )
            );
            return;
          }
          resolve();
        }
      );
    });

    const generatedFile = await stat(generatedPdf);
    if (!generatedFile.isFile() || generatedFile.size === 0) {
      throw new Error("LilyPond finished without producing a PDF document.");
    }
    await copyFile(generatedPdf, outputPath);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}
