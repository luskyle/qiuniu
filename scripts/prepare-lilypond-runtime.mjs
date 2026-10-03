import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const version = "2.26.0";
const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const runtimeDirectory = path.join(rootDirectory, "runtime", "lilypond");

const assets = {
  "linux-x64": {
    file: `lilypond-${version}-linux-x86_64.tar.gz`,
    sha256: "cd8a097a9f52cb2b9f4e7914774786f203f4fc61fcd299afcbb63c23fa5c6b24",
    format: "tar.gz",
    executable: "bin/lilypond"
  },
  "win32-x64": {
    file: `lilypond-${version}-mingw-x86_64.zip`,
    sha256: "14ddddc233b469ef60d4ffc1c7f35520f15ac6b58e38cab458c60bdcc3af650c",
    format: "zip",
    executable: "bin/lilypond.exe"
  },
  "darwin-x64": {
    file: `lilypond-${version}-darwin-x86_64.tar.gz`,
    sha256: "6dcbca34b13ad6d4ba3606a0b48edd02688284fcd52e9c00141242df1996a148",
    format: "tar.gz",
    executable: "bin/lilypond"
  },
  "darwin-arm64": {
    file: `lilypond-${version}-darwin-arm64.tar.gz`,
    sha256: "18ffc454fef3753c26a015d95a3c232f89b22f052b897c046e0198740a1221be",
    format: "tar.gz",
    executable: "bin/lilypond"
  }
};

const target = process.argv[2];
const asset = assets[target];
if (!asset) {
  throw new Error(
    `Unsupported LilyPond runtime target "${target}". Supported targets: ${Object.keys(assets).join(", ")}`
  );
}

const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), "lilypond-runtime-")
);
const archivePath = path.join(temporaryDirectory, asset.file);
const extractionDirectory = path.join(temporaryDirectory, "extracted");
const archiveUrl = `https://gitlab.com/lilypond/lilypond/-/releases/v${version}/downloads/${asset.file}`;

try {
  const response = await fetch(archiveUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(
      `Could not download LilyPond ${version} for ${target}: HTTP ${response.status}.`
    );
  }
  await pipeline(response.body, createWriteStream(archivePath));

  const archive = await readFile(archivePath);
  const actualHash = createHash("sha256").update(archive).digest("hex");
  if (actualHash !== asset.sha256) {
    throw new Error(
      `LilyPond archive checksum mismatch for ${target}: expected ${asset.sha256}, received ${actualHash}.`
    );
  }

  await mkdir(extractionDirectory);
  if (asset.format === "tar.gz") {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", extractionDirectory]);
  } else if (process.platform === "win32") {
    const quotePowerShellLiteral = (value) =>
      `'${value.replaceAll("'", "''")}'`;
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath ${quotePowerShellLiteral(archivePath)} -DestinationPath ${quotePowerShellLiteral(extractionDirectory)}`
    ]);
  } else {
    await execFileAsync("unzip", ["-q", archivePath, "-d", extractionDirectory]);
  }

  const extractedRoot = path.join(extractionDirectory, `lilypond-${version}`);
  const executablePath = path.join(extractedRoot, asset.executable);
  const licenseDirectory = path.join(extractedRoot, "licenses");
  const licenseFiles = await readdir(licenseDirectory);
  const executableInfo = await stat(executablePath);
  if (
    !executableInfo.isFile() ||
    (asset.format === "tar.gz" &&
      process.platform !== "win32" &&
      (executableInfo.mode & 0o111) === 0) ||
    licenseFiles.length === 0
  ) {
    throw new Error(
      `LilyPond archive for ${target} is missing its executable or third-party license notices.`
    );
  }

  await rm(runtimeDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(runtimeDirectory), { recursive: true });
  await cp(extractedRoot, runtimeDirectory, {
    recursive: true,
    force: true,
    preserveTimestamps: true
  });
  await writeFile(
    path.join(runtimeDirectory, "BUNDLE-METADATA.json"),
    `${JSON.stringify(
      {
        version,
        target,
        archive: archiveUrl,
        sha256: asset.sha256,
        source: `https://gitlab.com/lilypond/lilypond/-/archive/v${version}/lilypond-v${version}.tar.gz`
      },
      null,
      2
    )}\n`
  );
  console.log(
    `Prepared LilyPond ${version} for ${target} at ${path.relative(rootDirectory, runtimeDirectory)} (${licenseFiles.length} license files).`
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
