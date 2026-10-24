# Technical asset parity

This audit checks resource integrity and presentation coverage without changing combat rules, stats, rewards, equipment automation or difficulty. It does not certify that a reconstruction exactly reproduces the original engine.

Run `npm run audit:assets`. The machine-readable result is `.build/asset-parity/report.json`, including the asset-manifest digest, identity/role rows, PNG dimensions and atlas frame bounds. The report checks nested item appearances and paperdoll resources as well as ordinary sprite/VFX references. Missing payloads, unsafe paths, invalid PNG signatures and frames outside their atlas fail the command.

The current catalog audit covers 42 monster identities and 23 spells. Per-role statuses deliberately distinguish a mapped atlas from reviewed movement, native death/corpse behavior, status feedback and audible event fidelity. A successful file load does not establish those latter properties.

`npm run audit:assets:preview` decodes every manifest PNG (including nested equipment/UI variants), records failures in `browser-decode.json`, and generates light/dark contact sheets for all 42 actors and 34 VFX atlases under `.build/asset-parity`. These are sampled frames, not a full lifecycle playback test. The reviewed arrow/crossbow samples contain saturated magenta/blue strokes; compare their native palette/transparency and intended appearance before calling projectile visual parity verified. No source pixels were changed to hide that uncertainty. The parity pass also caught two delivery issues: summon aliases now select the same canonical skeleton/zombie atlases as the renderer, and trimmed actor metadata retains the renderer?s `Z` grounding flag alongside corpse-donor IDs. These preserve presentation rather than change combat rules.

## Presentation checks

`npm run test:browser` runs the actual game in desktop, portrait and landscape layouts, verifies required-image failure/retry, safe readiness, pause, save/continue and menu geometry. It also exercises eighteen fresh/saved menu layouts and 48 actual hero draw/alpha foot-contact checks across three heroes, eight facings, idle/walk and native hill terrain. Browser binaries are installed explicitly; unavailable browsers fail rather than silently skipping.

Install dependencies with `npm ci`, then `npx playwright install --with-deps chromium webkit`. The default runtime checks cover both engines; the menu and grounding probes use Chromium. For an explicitly narrower local check with installed Chrome, set `ALLODS_BROWSER_CHANNEL=chrome` and `ALLODS_BROWSERS=chromium`. This is browser emulation, not a physical iOS/Android session.

Screenshots and results stay under `.build/runtime-browser`, `.build/menu-fit` and `.build/shadow-fix`. Inspect the pictures alongside assertions. They verify the current renderer, not a matched original-engine reference recording.

## Loading preserves the existing rules

- Menu/common resources are decoded first. Large actor/scenery sheets are selected from the current native region, its complete roster, relevant corpse donors and actual live/summoned/restored entities. Legacy skeleton/zombie summon names resolve to the renderer?s canonical atlases, including in trimmed packages. Final-guardian art is included where required. The non-campaign fallback retains its broader actor set.
- Required scene loads stop simulation stepping and release held input. They do not call a replacement simulation, consume gameplay RNG, change a spawn plan, or grant transition healing. A scene is not drawn with missing required actor resources.
- A new scene replaces retained actor artwork only after its resources decode successfully. Old scene references are released; transient overlap during preparation remains possible. All common spell effects stay available, including equipment-granted spells.
- Floor-item thumbnails load on demand, using the existing loot-bag art while pending. Their decoded cache is bounded to 64 entries and 24 MiB; oversize individual images are not retained. HTML inventory/shop images use normal browser loading. This does not change pickup, comparison, equipment or sale behavior.
- Group loads deduplicate physical URLs, bound concurrency to eight and report completed decoded resources. Unknown transfer totals are not presented as invented byte percentages. Failures retain a retry action and cannot start combat over absent resources.

## Parity gaps kept explicit

| Area | Current evidence and remaining review |
| --- | --- |
| Actor animation | Catalog/action/frame mappings and current motion/grounding checks exist. A native per-identity attack/hit/death/corpse comparison is still needed to establish full original fidelity. |
| Spell stages | Primary VFX mappings are checked. Source-derived versus authored placement, repeated particles, impact/status lifetime and every stage-specific sound need individual evidence. |
| Sound | Shared element/event playback exists. The audit does not label generic category sounds as verified native sounds for every creature or spell. |
| Worn equipment | Inventory/menu layers exist. Battlefield wearable-variant parity needs source capability/mapping investigation; no new wardrobe system was added in this technical pass. |
| Transparency and world depth | Original PNG payloads remain unchanged. Frame bounds and contextual grounding checks do not prove every semitransparent edge, prop occlusion or slope has been visually compared with the original. |

These are review tasks, not reasons to invent replacement behavior or alter balance. The large source installation and private inspection records are not prerequisites for running the portable runtime tests. Distribution permission remains separate from technical integrity and privacy checks.

Windows package verification uses `npm run desktop:pack`, followed by `node tests/electron-smoke.cjs --packaged --clean`. The latter launches a fresh isolated copy of the built package with its own profile and checks resource loading, movement, inventory/shop and save export/import. One isolated artifact remains under `.build/clean-package-*` for inspection. This local check does not establish that Linux binaries ran or that a source installation/extractor has been independently validated.
