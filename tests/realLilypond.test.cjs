const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFile } = require("node:fs/promises");
const test = require("node:test");
const {
  createEmptyScore,
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
