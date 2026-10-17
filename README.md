# Allods Survivors

A standalone autocast survival game with original Allods artwork, spells, equipment, enemy casters and terrain.

**Unofficial fan project.** Allods 2 / Rage of Mages II: Necromancer was developed by [Nival Interactive](https://www.gog.com/en/game/rage_of_mages_ii_necromancer). All rights to the original game and its artwork, characters, interface, audio, fonts and other assets belong to their original creators and respective rights holders. No ownership of those assets is claimed. This project is not affiliated with or endorsed by Nival Interactive or the original game's publishers.

The forest menu backdrop, gold panel frame and burgundy button are generated artwork. Menu text, class selection, stats and cooldowns remain live UI; character dolls, equipment and spell icons use original Allods assets. Base outfits are presentation only and grant no equipment or stats.

Allods 2 reference used for this project: [Allods2.eu: About](https://www.allods2.eu/en/about/).

## Screenshots

| Elemental combat and spell loadouts | Equipment and the original character doll |
| --- | --- |
| ![Autocasting elemental spells with defensive buffs and the original HUD](docs/screenshots/combat.png) | ![Inventory with wearable gear and a fully dressed character doll](docs/screenshots/inventory.png) |
| **Side-by-side item comparisons** | **Buy and sell in the inventory shop** |
| ![Hover comparison showing stat gains, losses and spell-level bonuses](docs/screenshots/item-comparison.png) | ![The inventory shop with equipment offers and gold prices](docs/screenshots/shop.png) |

**Steep grassy hills**

![A steep grassy hill with a raised crest and shaded slope in the Shattered Grove](docs/screenshots/terrain.png)

**Boss encounters**

![Urd fully inside the arena, with the boss health bar visible](docs/screenshots/boss.png)

Move with WASD or the arrow keys. Spells cast automatically. Space dashes, I opens inventory, and Escape pauses. Survive the siege and defeat Urd. Death resets progression. Compatible equipment fills empty slots and clear upgrades equip automatically; items with stat tradeoffs remain in the backpack.

## Building the Electron app

Build on Windows x64 with Node.js LTS and npm installed (Node.js 24 is used for development). Open a terminal in the repository root, where `package.json` is located. The first dependency install and packaging run need internet access to download Electron and build tools. The game assets are already included; no original Allods installation or asset extraction is required.

Install the exact dependencies from the lockfile:

```powershell
npm ci
```

Run the desktop app during development:

```powershell
npm run desktop
```

This stages the current game source and referenced assets, then launches Electron. Stop and rerun the command after changing source files; it does not start a watch process.

Build a portable Windows x64 executable:

```powershell
npm run desktop:dist
```

Distribute **`dist/Allods-Survivors-win-x64.exe`** as a single file. Players do not need Node.js, Electron, an installer, or the source repository.

For an unpacked desktop build instead:

```powershell
npm run desktop:pack
```

Run `dist/win-unpacked/Allods Survivors.exe`. Distributing this version requires the entire `dist/win-unpacked/` folder, including its supporting files.

Both packaging commands stage only the referenced runtime files and assets, then audit the packaged application. The audit report is written to `dist/asset-report.json`. To stage the game payload without launching or packaging Electron, run `npm run desktop:stage`.

## Browser version and tests

For the browser version, run `node survivors/launcher.cjs` or use `Start-Survivors-Browser.cmd` on Windows. The browser launcher serves the game on localhost.

Run the self-contained gameplay tests after installing dependencies:

```powershell
npm test
```

## GitHub Actions releases

The **Tests** workflow runs gameplay, release tooling and package-audit tests on Windows and Linux for pushes and pull requests, and checks runtime staging.

To publish binaries, open **Actions > Release binaries > Run workflow** in GitHub. Select the branch containing the release source and enter a version such as `1.2.3` or `1.2.3-beta.1` (a leading `v` is optional). The workflow validates the version, runs tests, then builds and audits Windows x64 and Linux x64 packages on their respective runners. Only when both builds pass does it create the `v<VERSION>` GitHub release at the selected source commit and upload:

- `Allods-Survivors-win-x64.exe`: portable Windows executable.
- `Allods-Survivors-linux-x64.AppImage`: portable Linux executable; run `chmod +x` on it before launching.
- `Allods-Survivors-linux-x64.tar.gz`: Linux app folder; extract it and run `allods-survivors` with the supporting files beside it.
- Per-platform asset audit reports and `SHA256SUMS.txt` checksums.

Prerelease versions create GitHub prereleases. Choose a new version for each release; an existing release is not overwritten. The workflow sets package versions only in the build job and creates no source commits. It uses the built-in GitHub token, with release write permission limited to the publishing job; no personal token is needed.

For a local Linux build, use Node.js LTS on Linux and run `npm ci`, then `npm run desktop:dist -- --linux`. To build an unpacked Linux folder, use `npm run desktop:pack -- --linux`.

## Project layout

- `survivors/`: editable game source and selected runtime assets.
- `desktop/`: sandboxed Electron window and local asset protocol.
- `tools/`: runtime staging, desktop build and package audit.
- `tests/`: self-contained gameplay and rendering-model tests.
- `PUBLIC-EXPORT-MANIFEST.json`: relative paths and hashes from the latest source export.

Game data is already prepared; an original installation or extraction tools are not needed to run or build this tree. Survival balance and reconstructed rendering behavior are project-specific. Allods artwork, audio and font retain their original ownership; this repository does not assign a new license to those assets.
