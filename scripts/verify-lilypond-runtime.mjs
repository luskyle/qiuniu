import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const version = "2.26.0";
const target = process.argv[2];
const expectedTarget = `${process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : process.platform}-${process.arch}`;
if (target !== expectedTarget) {
  throw new Error(
    `Runtime target mismatch: expected ${expectedTarget}, received ${target}.`
  );
}

const extensionDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const executable = path.join(
  extensionDirectory,
  "runtime",
  "lilypond",
  "bin",
  process.platform === "win32" ? "lilypond.exe" : "lilypond"
);
const metadata = JSON.parse(
  await readFile(
    path.join(extensionDirectory, "runtime", "lilypond", "BUNDLE-METADATA.json"),
    "utf8"
  )
);
if (metadata.version !== version || metadata.target !== target) {
  throw new Error(
    `Bundled runtime metadata mismatch: ${JSON.stringify(metadata)}`
  );
}

await access(executable);
const copyrightNotice = path.join(
  extensionDirectory,
  "runtime",
  "lilypond",
  "licenses",
  `lilypond-${version}.COPYING`
);
await access(copyrightNotice);

const executableInfo = await stat(executable);
if (
  process.platform !== "win32" &&
  (executableInfo.mode & 0o111) === 0
) {
  throw new Error(`Bundled LilyPond is not executable: ${executable}`);
}

const { stdout: versionOutput } = await execFileAsync(executable, ["--version"], {
  windowsHide: true,
  timeout: 30_000
});
if (!versionOutput.includes(`GNU LilyPond ${version}`)) {
  throw new Error(
    `Unexpected LilyPond version output: ${versionOutput.split("\n")[0]}`
  );
}

const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), "lilypond-bundle-smoke-")
);
try {
  const sourcePath = path.join(temporaryDirectory, "score.ly");
  const outputPrefix = path.join(temporaryDirectory, "score");
  await writeFile(
    sourcePath,
    [
      '\\version "2.26.0"',
      "",
      "\\score {",
      "  \\new Staff { c'4 d'8 e'8 f'2 }",
      "  \\layout { }",
      "}"
    ].join("\n"),
    "utf8"
  );
  await execFileAsync(
    executable,
    ["--svg", "--output", outputPrefix, sourcePath],
    { cwd: temporaryDirectory, windowsHide: true, timeout: 120_000 }
  );
  const svg = await readFile(`${outputPrefix}.svg`, "utf8");
  if (!/<svg\b/.test(svg)) {
    throw new Error("Bundled LilyPond did not produce a valid SVG score.");
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  `Verified standalone LilyPond ${version} for ${target}: executable, bundled resources, license, and SVG engraving.`
);
