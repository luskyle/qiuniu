const assert = require("node:assert/strict");
const test = require("node:test");
const { createEmptyScore, serializeScore } = require("../dist/score/score.js");

test("serializes an empty score as a complete LilyPond document", () => {
  assert.equal(
    serializeScore(createEmptyScore()),
    [
      '\\version "2.26.0"',
      "",
      "\\score {",
      "  \\new Staff {",
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
