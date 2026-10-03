const assert = require("node:assert/strict");
const { chmod, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CommandLineLilyPondEngine } = require("../dist/engine/lilypondEngine.js");

test(
  "renders in-memory LilyPond source and cleans temporary output on dispose",
  { skip: process.platform === "win32" },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lilypond-engine-test-"));
    const executable = path.join(directory, "fake-lilypond");
    await writeFile(
      executable,
      [
        "#!/bin/sh",
        "set -eu",
        "test -f \"$4\"",
        "grep -q 'generated-score' \"$4\"",
        "printf '<svg>rendered score</svg>' > \"$3.svg\""
      ].join("\n")
    );
    await chmod(executable, 0o755);

    let result;
    try {
      result = await new CommandLineLilyPondEngine().render(
        '\\markup "generated-score"',
        { executable }
      );
      assert.equal(result.pages.length, 1);
      assert.match(await readFile(result.pages[0], "utf8"), /rendered score/);
      const outputDirectory = path.dirname(result.pages[0]);
      await result.dispose();
      await assert.rejects(readFile(result.pages[0]), { code: "ENOENT" });
      await assert.rejects(readFile(outputDirectory), { code: "ENOENT" });
    } finally {
      await result?.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  }
);

test(
  "reports a missing LilyPond executable",
  { skip: process.platform === "win32" },
  async () => {
    await assert.rejects(
      new CommandLineLilyPondEngine().render("c4", {
        executable: path.join(os.tmpdir(), "missing-lilypond-executable")
      }),
      /Could not find LilyPond executable/
    );
  }
);

test(
  "exports a multipage PDF from in-memory LilyPond source",
  { skip: process.platform === "win32" },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lilypond-pdf-test-"));
    const executable = path.join(directory, "fake-lilypond");
    const outputPath = path.join(directory, "score.pdf");
    await writeFile(
      executable,
      [
        "#!/bin/sh",
        "set -eu",
        "test \"$1\" = \"--pdf\"",
        "test \"$2\" = \"--output\"",
        "grep -q 'generated-pdf-score' \"$4\"",
        "printf '%%PDF-1.7\\n/Pages 3\\n' > \"$3.pdf\""
      ].join("\n")
    );
    await chmod(executable, 0o755);
    try {
      await new CommandLineLilyPondEngine().exportPdf(
        '\\markup "generated-pdf-score"',
        outputPath,
        { executable }
      );
      const pdf = await readFile(outputPath, "utf8");
      assert.match(pdf, /^%PDF-1\.7/);
      assert.match(pdf, /\/Pages 3/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);
