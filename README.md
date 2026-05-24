# Hello Cam

Hello Cam is a clean-room, TypeScript-first realtime visual arts environment for macOS and the web. It is designed as a node-based live visual instrument using camera, microphone, WebGPU, and Web Audio.

## Current Stack

- Electron desktop shell
- React + Vite UI
- React Flow graph editor
- TypeScript workspace packages
- WebGPU rendering
- Web Audio analysis
- JSON project files

## Development

This repository uses pnpm workspaces.

Gyeol is maintained in a separate repository and is intentionally not committed
to this repository. For local development, clone it into `packages/gyeol`:

```sh
git clone https://github.com/nijkah/gyeol packages/gyeol
```

```sh
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm dev
```

For the browser demo:

```sh
pnpm dev:web
```

## Clean-Room Rule

Do not use TouchDesigner binaries, screenshots, project files, internal APIs, sample networks, palettes, private formats, or copied UI/terminology as implementation material. Use public platform specifications and independently written requirements only.
