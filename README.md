# LilyPond Score Editor

A Visual Studio Code extension for interactively editing LilyPond scores.

## Requirements

- Visual Studio Code 1.85 or later
- Node.js and npm for extension development

## Development

```sh
npm install
npm run prepare:lilypond -- linux-x64
npm run compile
npm test
```

Replace `linux-x64` with `win32-x64`, `darwin-x64`, or `darwin-arm64` on the corresponding platform. The packaging workflow stages LilyPond 2.26.0 automatically for the target VSIX. Set `lilypond.executable` only to override the bundled executable. The real engraving integration test runs when the bundled runtime has been staged or `LILYPOND_EXECUTABLE` is set; otherwise that test is skipped.

Open this folder in VS Code and press **F5** to launch an Extension Development Host. Run **LilyPond: New Visual Score** to open an HTML5 interactive treble staff. The staff and notes are native, editable web elements—not a LilyPond-rendered image. Drag a note value onto the staff (or select a value and click), then drag notes vertically to change pitch. Generated LilyPond source is shown in the adjacent text editor as you compose. Save the generated untitled `.ly` file to keep it.

To preview an existing `.ly` file, open it and run **LilyPond: Open Score Preview**. That preview refreshes when the file is saved.

The initial visual editor supports one treble-clef staff, natural notes from C3 to E6, and whole through sixteenth note values. It does not yet import arbitrary LilyPond source, or model rests, meter, accidentals, chords, or multiple voices. LilyPond remains a separate backend for compiling the generated notation to publication-quality output. See [the architecture plan](./docs/architecture/visual-editor-and-lilypond-runtime.md) for the engine API and native runtime roadmap.

## CI and releases

GitHub Actions checks types, compiles, and packages the extension for pushes to `main`, pull requests targeting `main`, and manual runs. The generated VSIX is uploaded as a workflow artifact. Push a version tag such as `v0.1.0` to run the same checks and publish a GitHub Release with the VSIX attached:

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Project structure

- `src/extension.ts` — extension activation and command registration
- `src/score/` — structured score model and LilyPond source generation
- `src/engine/` — replaceable LilyPond rendering API
- `src/compiler/` — CLI adapter and temporary SVG output
- `src/preview/` — preview webview and its lifecycle
- `src/visualEditor/` and `media/` — HTML5 interactive score editor and staff renderer
- `syntaxes/` — initial TextMate grammar for LilyPond
- `3rd/lilypond/` — upstream LilyPond source submodule

The tagged release contains platform-specific VSIX packages (Linux x64, Windows x64, macOS x64 and arm64). Each VSIX embeds the complete corresponding LilyPond standalone distribution, including its engraving resources, fonts, Guile runtime, bundled libraries and third-party license notices. The matching LilyPond source archive is published alongside the VSIX packages. Each platform package is approximately 40–45 MB compressed. Users do not need to install LilyPond separately; Linux still uses the host OS glibc (the official x64 binary requires glibc 2.28 or newer), as well as the normal system loader.

Prepare the local Linux x64 runtime and run the real engraving test with:

```sh
npm run prepare:lilypond -- linux-x64
npm test
```

The shallow source submodule in `3rd/lilypond` is kept as a development checkout and is not the version bundled with the extension. Initialize it in a fresh checkout with:

```sh
git submodule update --init --depth 1
```

## LilyPond source

The upstream source is available at [lilypond/lilypond on GitLab](https://gitlab.com/lilypond/lilypond). Its license and contribution terms are included in `3rd/lilypond`; the extension's root license applies to this extension code.
