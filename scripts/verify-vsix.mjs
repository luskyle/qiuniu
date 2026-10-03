import { readFile } from "node:fs/promises";
import path from "node:path";

const [vsixPath, target] = process.argv.slice(2);
if (!vsixPath || !target) {
  throw new Error(
    "Usage: node scripts/verify-vsix.mjs <extension.vsix> <platform-target>"
  );
}

const archive = await readFile(vsixPath);
const endOfCentralDirectorySignature = 0x06054b50;
let endOfCentralDirectory = -1;
for (
  let offset = archive.length - 22;
  offset >= Math.max(0, archive.length - 65_557);
  offset--
) {
  if (archive.readUInt32LE(offset) === endOfCentralDirectorySignature) {
    endOfCentralDirectory = offset;
    break;
  }
}
if (endOfCentralDirectory < 0) {
  throw new Error("VSIX is not a valid ZIP archive.");
}

const entries = archive.readUInt16LE(endOfCentralDirectory + 10);
let offset = archive.readUInt32LE(endOfCentralDirectory + 16);
const fileNames = new Set();
for (let index = 0; index < entries; index++) {
  if (archive.readUInt32LE(offset) !== 0x02014b50) {
    throw new Error(`Invalid ZIP central directory entry ${index}.`);
  }
  const nameLength = archive.readUInt16LE(offset + 28);
  const extraLength = archive.readUInt16LE(offset + 30);
  const commentLength = archive.readUInt16LE(offset + 32);
  const name = archive.toString(
    "utf8",
    offset + 46,
    offset + 46 + nameLength
  );
  fileNames.add(name);
  offset += 46 + nameLength + extraLength + commentLength;
}

const executable =
  target === "win32-x64" ? "lilypond.exe" : "lilypond";
const requiredFiles = [
  "extension/THIRD-PARTY-NOTICES.txt",
  "extension/runtime/lilypond/BUNDLE-METADATA.json",
  `extension/runtime/lilypond/bin/${executable}`,
  "extension/runtime/lilypond/licenses/lilypond-2.26.0.COPYING",
  "extension/media/visualScoreEditor.js"
];
const missing = requiredFiles.filter((file) => !fileNames.has(file));
if (missing.length > 0) {
  throw new Error(
    `VSIX is missing bundled runtime or editor files: ${missing.join(", ")}`
  );
}

const metadataName = "extension/runtime/lilypond/BUNDLE-METADATA.json";
if (!fileNames.has(metadataName)) {
  throw new Error("VSIX is missing the runtime provenance manifest.");
}

console.log(
  `Verified ${path.basename(vsixPath)} contains the ${target} LilyPond runtime, license notices, and HTML5 editor.`
);
