# LilyPond Score Editor

A Visual Studio Code extension foundation for editing LilyPond scores and previewing compiled sheet music.

## Requirements

- Visual Studio Code 1.85 or later
- LilyPond installed and available as `lilypond`, or set `lilypond.executable` to its executable path
- Node.js and npm for extension development

## Development

```sh
npm install
npm run compile
```

Open this folder in VS Code and press **F5** to launch an Extension Development Host. Open a `.ly` file and run **LilyPond: Open Score Preview** from the Command Palette. The preview is refreshed whenever the score is saved.

## CI and releases

GitHub Actions checks types, compiles, and packages the extension for pushes to `main`, pull requests targeting `main`, and manual runs. The generated VSIX is uploaded as a workflow artifact. Push a version tag such as `v0.1.0` to run the same checks and publish a GitHub Release with the VSIX attached:

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Project structure

- `src/extension.ts` — extension activation and command registration
- `src/compiler/` — LilyPond process integration and temporary SVG output
- `src/preview/` — preview webview and its lifecycle
- `syntaxes/` — initial TextMate grammar for LilyPond
- `3rd/lilypond/` — upstream LilyPond source submodule

The preview uses the locally installed LilyPond executable. The shallow source submodule in `3rd/lilypond` is not built automatically or bundled with the extension. Initialize it in a fresh checkout with:

```sh
git submodule update --init --depth 1
```

## LilyPond source

The upstream source is available at [lilypond/lilypond on GitLab](https://gitlab.com/lilypond/lilypond). Its license and contribution terms are included in `3rd/lilypond`; the extension's root license applies to this extension code.
