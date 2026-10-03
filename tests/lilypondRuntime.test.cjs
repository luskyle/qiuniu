const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  resolveLilyPondExecutable
} = require("../dist/engine/lilypondEngine.js");

test("uses the explicitly configured LilyPond executable as an override", async () => {
  assert.equal(
    await resolveLilyPondExecutable("/extension", "/custom/lilypond"),
    "/custom/lilypond"
  );
});

test("resolves the executable from the platform runtime shipped in the extension", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lilypond-bundle-test-"));
  const executable = path.join(
    directory,
    "runtime",
    "lilypond",
    "bin",
    process.platform === "win32" ? "lilypond.exe" : "lilypond"
  );
  try {
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, "");
    assert.equal(await resolveLilyPondExecutable(directory), executable);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fails clearly when a platform runtime is absent", async () => {
  await assert.rejects(
    resolveLilyPondExecutable(path.join(os.tmpdir(), "missing-lilypond-vsix")),
    /bundled LilyPond runtime is missing/
  );
});
