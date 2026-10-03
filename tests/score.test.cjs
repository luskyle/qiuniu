const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const {
  createEmptyScore,
  parseScore,
  serializeScore,
  serializeScoreFile
} = require("../dist/score/score.js");
const examplesDirectory = path.join(__dirname, "..", "examples");
const editorMarkup = readFileSync(
  path.join(__dirname, "..", "src", "visualEditor", "visualScoreEditor.ts"),
  "utf8"
);
const editorScript = readFileSync(
  path.join(__dirname, "..", "media", "visualScoreEditor.js"),
  "utf8"
);

test("uses the Qiuniu Score Editor product identity", () => {
  assert.equal(manifest.name, "score-editor");
  assert.equal(manifest.publisher, "qiuniu");
  assert.equal(manifest.displayName, "Qiuniu Score Editor");
});

test(".music files open with the visual score editor by default", () => {
  assert.ok(
    manifest.contributes.customEditors.some(
      (editor) =>
        editor.viewType === "lilypond.musicEditor" &&
        editor.priority === "default" &&
        editor.selector.some(
          (selector) => selector.filenamePattern === "*.music"
        )
    )
  );
});

test("provides A4 score pages and piano playback controls", () => {
  assert.match(editorMarkup, /width: min\(100%, 210mm\)/);
  assert.match(editorMarkup, /min-height: 297mm/);
  assert.match(editorMarkup, /id="play-score"/);
  assert.match(editorScript, /function getMidiPitch/);
  assert.match(editorScript, /function playPianoNote/);
  assert.match(editorScript, /function startPlayback/);
});

test("serializes an empty score as a complete LilyPond document", () => {
  assert.equal(
    serializeScore(createEmptyScore()),
    [
      '\\version "2.26.0"',
      "",
      "\\score {",
      "  \\new Staff {",
      "    \\key c \\major",
      "    \\time 4/4",
      "    ",
      "  }",
      "  \\layout { }",
      "}"
    ].join("\n")
  );
});

test("serializes pitches and durations deterministically", () => {
  const source = serializeScore({
    schemaVersion: 1,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: [
      { id: "middle-e", diatonicStep: 0, duration: 4 },
      { id: "middle-c", diatonicStep: -2, duration: 8 },
      { id: "low-c", diatonicStep: -9, duration: 16 },
      { id: "high-e", diatonicStep: 14, duration: 2 }
    ]
  });

  assert.match(source, /e'4 c'8 c16 e'''2/);
});

test("rejects unsupported score versions and staff positions", () => {
  assert.throws(
    () => serializeScore({ schemaVersion: 2, notes: [] }),
    /Unsupported score model version/
  );
  assert.throws(
    () =>
      serializeScore({
        schemaVersion: 1,
        notes: [{ id: "bad-pitch", diatonicStep: 15, duration: 4 }]
      }),
    /Unsupported staff position/
  );
});

test("rejects unsupported durations", () => {
  assert.throws(
    () =>
      serializeScore({
        schemaVersion: 1,
        notes: [{ id: "bad-duration", diatonicStep: 0, duration: 3 }]
      }),
    /Unsupported note duration/
  );
});

test("parses valid .music files and rejects invalid score data", () => {
  const source = serializeScoreFile({
    schemaVersion: 1,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: [{ id: "note-1", diatonicStep: 0, duration: 4 }]
  });
  assert.deepEqual(parseScore(source), {
    schemaVersion: 1,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: [{ id: "note-1", diatonicStep: 0, duration: 4 }]
  });
  assert.throws(() => parseScore("{"), /Invalid \.music file/);
  assert.throws(
    () => parseScore('{"schemaVersion":1,"notes":[{"id":"","diatonicStep":0,"duration":4}]}'),
    /has no ID/
  );
});

test("serializes rests, accidentals, dotted notes, keys, time, and barlines", () => {
  const source = serializeScore({
    schemaVersion: 1,
    timeSignature: "3/4",
    keySignature: "Bb major",
    notes: [
      {
        id: "sharp-c",
        diatonicStep: -2,
        accidental: 1,
        duration: 4,
        dotted: true
      },
      { id: "dotted-quarter-rest", type: "rest", duration: 4, dotted: true },
      {
        id: "flat-d",
        diatonicStep: -1,
        accidental: -1,
        duration: 4,
        dotted: true
      }
    ]
  });
  assert.match(source, /\\key bes \\major/);
  assert.match(source, /\\time 3\/4/);
  assert.match(source, /cis'4\. r4\. \| des'4\./);
});

test("preserves explicit naturals separately from key-signature defaults", () => {
  const source = serializeScore({
    schemaVersion: 1,
    timeSignature: "4/4",
    keySignature: "Bb major",
    notes: [
      { id: "natural-b", diatonicStep: 4, accidental: 0, duration: 4 },
      { id: "key-signature-b", diatonicStep: 4, duration: 4 }
    ]
  });
  assert.match(source, /b'!4 b'4/);
});

test(".music examples round-trip through the visual score model", () => {
  const exampleFiles = readdirSync(examplesDirectory)
    .filter((file) => file.endsWith(".music"))
    .sort();
  assert.equal(exampleFiles.length, 3, "Expected three famous melody scores.");

  for (const file of exampleFiles) {
    const source = readFileSync(path.join(examplesDirectory, file), "utf8");
    const score = parseScore(source);
    assert.ok(score.notes.length > 0, `${file} should contain notes.`);
    assert.equal(
      serializeScoreFile(score),
      source,
      `${file} should round-trip through the .music file format.`
    );
    assert.doesNotThrow(() => serializeScore(score), `${file} should serialize to LilyPond.`);
    assert.ok(
      score.notes.every((note) => note.diatonicStep >= -9 && note.diatonicStep <= 14),
      `${file} should match the visual editor's LilyPond serializer.`
    );
  }
});
