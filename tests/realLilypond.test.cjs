const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFile, readdir } = require("node:fs/promises");
const test = require("node:test");
const {
  createEmptyScore,
  parseScore,
  serializeScore
} = require("../dist/score/score.js");
const {
  CommandLineLilyPondEngine
} = require("../dist/engine/lilypondEngine.js");
const {
  resolveLilyPondExecutable
} = require("../dist/engine/lilypondEngine.js");

const path = require("node:path");
const extensionRoot = path.resolve(__dirname, "..");
const configuredExecutable = process.env.LILYPOND_EXECUTABLE;
const executable =
  configuredExecutable ||
  path.join(
    extensionRoot,
    "runtime",
    "lilypond",
    "bin",
    process.platform === "win32" ? "lilypond.exe" : "lilypond"
  );
const availability = spawnSync(executable, ["--version"], { encoding: "utf8" });
const skip = availability.error
  ? "LilyPond is not installed and no bundled runtime has been staged."
  : false;

test(
  "serializes a visual score and engraves it to SVG with real LilyPond",
  { skip },
  async () => {
    const score = createEmptyScore();
    score.notes.push(
      { id: "middle-c", diatonicStep: -2, duration: 4 },
      { id: "middle-e", diatonicStep: 0, duration: 8 },
      { id: "upper-c", diatonicStep: 5, duration: 2 }
    );
    const rendered = await new CommandLineLilyPondEngine().render(
      serializeScore(score),
      {
        executable: configuredExecutable,
        extensionPath: extensionRoot
      }
    );

    try {
      assert.equal(rendered.pages.length, 1);
      const svg = await readFile(rendered.pages[0], "utf8");
      assert.match(svg, /<svg\b/);
      assert.match(svg, /LilyPond/);
    } finally {
      await rendered.dispose();
    }
  }
);

test(
  "engraves rests, dotted values, accidentals, and score settings",
  { skip },
  async () => {
    const rendered = await new CommandLineLilyPondEngine().render(
      serializeScore({
        schemaVersion: 1,
        timeSignature: "3/4",
        keySignature: "Bb major",
        title: "Rest and spacer engraving",
        notes: [
          {
            id: "sharp-c",
            diatonicStep: -2,
            accidental: 1,
            duration: 4,
            dotted: true
          },
          {
            id: "dotted-quarter-rest",
            type: "rest",
            duration: 4,
            dotted: true
          },
          {
            id: "flat-d",
            diatonicStep: -1,
            accidental: -1,
            duration: 4,
            dotted: true
          },
          { id: "natural-b", diatonicStep: 4, accidental: 0, duration: 4 },
          { id: "silent-spacer", type: "spacer", duration: 8 }
        ]
      }),
      {
        executable: configuredExecutable,
        extensionPath: extensionRoot
      }
    );

    try {
      assert.equal(rendered.pages.length, 1);
      assert.match(await readFile(rendered.pages[0], "utf8"), /<svg\b/);
    } finally {
      await rendered.dispose();
    }
  }
);

test(
  "exports a multipage score as a real PDF",
  { skip },
  async () => {
    const score = createEmptyScore();
    score.title = 'A "quoted" summer score';
    score.notes = Array.from({ length: 320 }, (_, index) => ({
      id: `note-${index + 1}`,
      diatonicStep: (index % 7) - 2,
      duration: 4
    }));
    const outputPath = path.join(
      extensionRoot,
      `qiuniu-multipage-test-${process.pid}.pdf`
    );
    try {
      await new CommandLineLilyPondEngine().exportPdf(
        serializeScore(score),
        outputPath,
        {
          executable: configuredExecutable,
          extensionPath: extensionRoot
        }
      );
      const pdf = await readFile(outputPath);
      assert.match(pdf.toString("utf8", 0, 8), /^%PDF-/);
      const pageCount = pdf
        .toString("latin1")
        .match(/\/Type\s*\/Page\b/g)?.length;
      assert.ok(pageCount && pageCount > 1, "The export should contain multiple pages.");
    } finally {
      await require("node:fs/promises").rm(outputPath, { force: true });
    }
  }
);

test(
  "engraves every example score with the bundled LilyPond runtime",
  { skip },
  async () => {
    const examplesDirectory = path.join(extensionRoot, "examples");
    const exampleFiles = (await readdir(examplesDirectory))
      .filter((file) => file.endsWith(".music"))
      .sort();
    assert.ok(exampleFiles.length > 0);

    for (const file of exampleFiles) {
      const score = parseScore(
        await readFile(path.join(examplesDirectory, file), "utf8")
      );
      const rendered = await new CommandLineLilyPondEngine().render(
        serializeScore(score),
        {
        executable: configuredExecutable,
        extensionPath: extensionRoot
        }
      );

      try {
        assert.ok(rendered.pages.length > 0, `${file} should render at least one page.`);
        const svg = await readFile(rendered.pages[0], "utf8");
        assert.match(svg, /<svg\b/, `${file} should render a score SVG.`);
      } finally {
        await rendered.dispose();
      }
    }
  }
);
