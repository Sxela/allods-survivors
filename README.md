# Allods Survivors

A standalone autocast survival game with original Allods artwork, spells, equipment, enemy casters and terrain.

Allods 2 reference used for this project: [Allods2.eu: About](https://www.allods2.eu/en/about/).

Move with WASD or the arrow keys. Spells cast automatically. Space dashes, I opens inventory, and Escape pauses. Survive the siege and defeat Urd. Death resets progression. Compatible equipment fills empty slots and clear upgrades equip automatically; items with stat tradeoffs remain in the backpack.

## Run and build

Install a current Node.js LTS release, then run:

```sh
npm ci
npm test
npm run desktop
```

For the browser version, run `node survivors/launcher.cjs` or use `Start-Survivors-Browser.cmd` on Windows. The browser launcher serves the game on localhost.

Build a Windows x64 portable executable:

```sh
npm run desktop:dist
```

The executable is written to `dist/Allods-Survivors-win-x64.exe`. Its game payload is restricted to referenced runtime assets and audited after packaging. The portable executable includes Electron and requires no Node.js installation on the player's machine.

## Project layout

- `survivors/`: editable game source and selected runtime assets.
- `desktop/`: sandboxed Electron window and local asset protocol.
- `tools/`: runtime staging, desktop build and package audit.
- `tests/`: self-contained gameplay and rendering-model tests.
- `PUBLIC-EXPORT-MANIFEST.json`: relative paths and hashes from the latest source export.

Game data is already prepared; an original installation or extraction tools are not needed to run or build this tree. Survival balance and reconstructed rendering behavior are project-specific. Allods artwork, audio and font retain their original ownership; this repository does not assign a new license to those assets.
