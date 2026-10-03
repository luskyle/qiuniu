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
const { getAvailableScoreFileName } = require("../dist/visualEditor/scoreFiles.js");
const editorMarkup = readFileSync(
  path.join(__dirname, "..", "src", "visualEditor", "visualScoreEditor.ts"),
  "utf8"
);
const editorScript = readFileSync(
  path.join(__dirname, "..", "media", "visualScoreEditor.js"),
  "utf8"
);
const editorProvider = readFileSync(
  path.join(__dirname, "..", "src", "visualEditor", "musicEditorProvider.ts"),
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
  assert.match(editorMarkup, /height: 297mm/);
  assert.match(editorMarkup, /\.score-title[^}]*text-align: center/);
  assert.match(editorScript, /setAttribute\("aria-label", "乐谱标题"\)/);
  assert.match(editorScript, /pageTitle\.addEventListener\("input"/);
  assert.match(editorScript, /pageTitle\.addEventListener\("change"/);
  assert.match(editorMarkup, /\.score-page[^}]*display: flex/);
  assert.match(editorMarkup, /\.page-systems[^}]*justify-content: space-between/);
  assert.match(editorScript, /while \(\s*currentPage\.height/);
  assert.match(editorScript, /editable: pageIndex === pages\.length - 1/);
  assert.match(editorScript, /system\.dataset\.editable !== "false"/);
  assert.match(editorMarkup, /\.staff-lines[^}]*height: 81px/);
  assert.match(editorMarkup, /\.notehead[^}]*width: 15px; height: 10px/);
  assert.match(editorMarkup, /\.score-item[^}]*width: 26px; height: 16px/);
  assert.match(editorScript, /const staffStep = 10;/);
  assert.match(editorScript, /const minimumMeasureWidth = 145;/);
  assert.match(editorMarkup, /id="play-score"/);
  assert.match(editorMarkup, /\.toolbox[^}]*flex-wrap: nowrap/);
  assert.match(editorMarkup, /\.toolbox[^}]*overflow-x: auto/);
  assert.match(editorMarkup, /class="toolbar-icon"/);
  assert.match(editorMarkup, /\.duration\[aria-pressed="true"\]/);
  assert.match(editorMarkup, /aria-label="预览雕版"/);
  assert.match(editorMarkup, /aria-label="导出 PDF"/);
  assert.match(editorMarkup, /aria-label="音符"/);
  assert.match(editorMarkup, /aria-label="休止符"/);
  assert.match(editorMarkup, /id="spacer-tool"/);
  assert.match(editorMarkup, /aria-label="空白符"/);
  assert.match(editorScript, /spacerTool\.addEventListener\("click"/);
  assert.match(editorScript, /selectedTool === "spacer"/);
  assert.match(editorScript, /function getMidiPitch/);
  assert.match(editorScript, /function playPianoNote/);
  assert.match(editorScript, /duration \* \(0\.92 \/ harmonic \*\* 0\.42\)/);
  assert.match(editorScript, /function startPlayback/);
  assert.match(editorScript, /playIcon\.textContent = "■"/);
  assert.match(editorMarkup, /\.score-item\.playing/);
  assert.match(editorScript, /function updatePlaybackProgress/);
  assert.match(editorScript, /requestAnimationFrame\(\s*updatePlaybackProgress/);
  assert.match(editorScript, /data-note-id="\$\{CSS\.escape\(id\)\}"/);
  assert.match(editorScript, /第 \$\{current\.index \+ 1\}\/\$\{playbackTimeline\.length\}/);
  assert.match(editorScript, /item\.classList\.add\("playing"\)/);
  assert.match(editorScript, /item\.scrollIntoView\(\{ block: "nearest"/);
  assert.match(editorScript, /cancelAnimationFrame\(playbackAnimationFrame\)/);
  assert.match(editorMarkup, /id="export-pdf"/);
  assert.match(editorMarkup, /id="tempo"/);
  assert.match(editorScript, /status\.textContent = `正在播放[^`]*score\.tempo/);
  assert.match(editorScript, /score\.tempo/);
  assert.match(editorScript, /exportPdfRequested/);
});

test("creates distinct default names for multiple empty score files", () => {
  assert.equal(getAvailableScoreFileName([]), "Untitled.music");
  assert.equal(
    getAvailableScoreFileName(["Untitled.music", "Untitled 2.music"]),
    "Untitled 3.music"
  );
  assert.equal(
    getAvailableScoreFileName(["untitled.music", "notes.music"]),
    "Untitled 2.music"
  );
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
      "    \\tempo 4 = 100",
      "    ",
      "  }",
      "  \\layout { }",
      "}"
    ].join("\n")
  );
});

test("persists score titles and emits safely escaped LilyPond title metadata", () => {
  const score = createEmptyScore();
  score.title = '夏日 "微风"';
  const source = serializeScore(score);
  assert.match(source, /\\header \{\s+title = "夏日 \\"微风\\""\s+\}/);
  assert.equal(parseScore(serializeScoreFile(score)).title, score.title);
  assert.equal(
    parseScore('{"schemaVersion":1,"notes":[]}').title,
    ""
  );
  assert.throws(
    () => parseScore('{"schemaVersion":1,"title":false,"notes":[]}'),
    /title must be a string/
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
    title: "",
    tempo: 100,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: [{ id: "note-1", diatonicStep: 0, duration: 4 }]
  });
  const legacyScore = parseScore(
    '{"schemaVersion":1,"notes":[{"id":"note-1","diatonicStep":0,"duration":4}]}'
  );
  assert.equal(legacyScore.tempo, 100);
  assert.throws(() => parseScore("{"), /Invalid \.music file/);
  assert.throws(
    () => parseScore('{"schemaVersion":1,"notes":[{"id":"","diatonicStep":0,"duration":4}]}'),
    /has no ID/
  );
  assert.throws(
    () =>
      parseScore(
        '{"schemaVersion":1,"tempo":241,"notes":[]}'
      ),
    /tempo must be an integer/
  );
});

test("serializes rests, accidentals, dotted notes, keys, time, and barlines", () => {
  const source = serializeScore({
    schemaVersion: 1,
    tempo: 100,
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
  assert.match(source, /\\tempo 4 = 100/);
  assert.match(source, /cis'4\. r4\. \| des'4\./);
});

test("serializes and preserves silent spacer events as LilyPond skips", () => {
  const score = createEmptyScore();
  score.notes = [
    { id: "note-before-space", diatonicStep: 0, duration: 4 },
    { id: "silent-space", type: "spacer", duration: 8 },
    { id: "visible-rest", type: "rest", duration: 8 }
  ];
  const source = serializeScore(score);
  assert.match(source, /e'4 s8 r8/);
  assert.deepEqual(parseScore(serializeScoreFile(score)).notes, score.notes);
  assert.match(editorScript, /if \(!event\.type \|\| event\.type === "note"\)/);
  assert.match(editorScript, /widthPerMeasure \* \(\(eventIndex \+ 0\.5\) \/ measure\.events\.length\)/);
  assert.match(editorScript, /systemMeasures\.push\(\{ events: \[\]/);
  assert.match(editorScript, /appendSpacerEvents\(ticksToAdd\)/);
});

test("preserves explicit naturals separately from key-signature defaults", () => {
  const source = serializeScore({
    schemaVersion: 1,
    tempo: 132,
    timeSignature: "4/4",
    keySignature: "Bb major",
    notes: [
      { id: "natural-b", diatonicStep: 4, accidental: 0, duration: 4 },
      { id: "key-signature-b", diatonicStep: 4, duration: 4 }
    ]
  });
  assert.match(source, /b'!4 b'4/);
  assert.match(source, /\\tempo 4 = 132/);
});

test("supports multi-page single score files and PDF export through LilyPond", () => {
  assert.match(editorScript, /systems\.forEach/);
  assert.match(editorScript, /scoreSheet\.append\(nextPage\)/);
  assert.match(editorScript, /pageSystemsHeight/);
  assert.match(editorScript, /const pageCount = scoreSheet\.querySelectorAll/);
  assert.match(
    editorScript,
    /vscode\.postMessage\(\{ type: "scoreChanged", score \}\);\s+vscode\.postMessage\(\{ type: "exportPdfRequested" \}\)/
  );
  const longScore = createEmptyScore();
  longScore.notes = Array.from({ length: 65 }, (_, index) => ({
    id: `note-${index}`,
    diatonicStep: 0,
    duration: 4
  }));
  assert.match(serializeScore(longScore), /\\pageBreak/);
  assert.match(editorProvider, /lilyPondEngine\.exportPdf\(source/);
  assert.match(editorMarkup, /break-after: page/);
});

test(".music examples round-trip through the visual score model", () => {
  const exampleFiles = readdirSync(examplesDirectory)
    .filter((file) => file.endsWith(".music"))
    .sort();
  assert.equal(exampleFiles.length, 6, "Expected four public-domain melodies and two original scores.");

  for (const file of exampleFiles) {
    const source = readFileSync(path.join(examplesDirectory, file), "utf8");
    const score = parseScore(source);
    assert.ok(score.notes.length > 0, `${file} should contain notes.`);
    assert.deepEqual(
      JSON.parse(serializeScoreFile(score)),
      JSON.parse(source),
      `${file} should round-trip through the .music file format.`
    );
    assert.equal(score.tempo, JSON.parse(source).tempo);
    assert.equal(score.title, JSON.parse(source).title);
    assert.doesNotThrow(() => serializeScore(score), `${file} should serialize to LilyPond.`);
    assert.ok(
      score.notes.every((note) => note.diatonicStep >= -9 && note.diatonicStep <= 14),
      `${file} should match the visual editor's LilyPond serializer.`
    );
    if (
      file === "04-summer-breeze.music" ||
      file === "05-morning-stream.music"
    ) {
      const totalTicks = score.notes.reduce(
        (ticks, event) => ticks + 16 / event.duration,
        0
      );
      assert.equal(totalTicks, 16 * 16, `${file} should contain a complete 16-bar piece.`);
    }
    if (file === "06-fur-elise.music") {
      assert.equal(score.tempo, 112, "Für Elise should play at a brisk, clear tempo.");
      assert.deepEqual(
        score.notes.slice(0, 9).map(({ diatonicStep, accidental }) => [
          diatonicStep,
          accidental
        ]),
        [
          [7, undefined],
          [6, 1],
          [7, undefined],
          [6, 1],
          [7, undefined],
          [4, undefined],
          [6, undefined],
          [5, undefined],
          [3, undefined]
        ],
        "The opening motif should include B4 and natural D5 in the right places."
      );
      const totalTicks = score.notes.reduce(
        (ticks, event) => ticks + 16 / event.duration,
        0
      );
      assert.equal(totalTicks, 24 * 12, "The simplified arrangement should contain 24 complete 3/4 bars.");
      assert.ok(
        score.notes.some((event) => event.diatonicStep === 6 && event.accidental === 1),
        "The opening E-D-sharp-E motif should be present."
      );
    }
  }
});
