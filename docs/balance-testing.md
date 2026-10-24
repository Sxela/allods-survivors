# Balance testing

## Wall of Earth removal follow-up (2026-10-25)

The former five-seed zone-two regression failed on seed 8128 after removing Wall of Earth changed randomized rewards and loot. The fixed-loadout probe was collecting and auto-equipping real items: this seed gained Invisibility from gloves, adding a defensive autocast without learning it. Earlier "empty gear" descriptions mean an empty starting inventory, not a prohibition on later pickups.

Two behavior bugs amplified sustain: short self-buffs bypassed their displayed cooldown by refreshing at duration minus 0.25 seconds, and ranged enemies stopped at firing range even while unable to detect the invisible target. Buffs now wait their real recast interval, and searching ranged enemies approach the last-known position. Nearby detection and item-granted spell levels remain intact. Heal/Shield magnitudes and cast-interval formulas are unchanged.

Normal's later-region pressure was also increased: hit protection is 0.42 seconds (was 0.45), regional damage growth caps at 3x rather than 2.5x, and prolonged-fight new-arrival damage caps at 1.6x rather than 1.35x. Region-one base damage is unchanged and its initial hit protection still starts at 0.65 seconds. Hard uses the same capped 3x regional growth so Normal does not overtake its base per-hit scaling; its 1.1 base damage multiplier, 0.4-second hit protection and other modifiers remain. Easy's preset is unchanged; the shared cooldown and search corrections apply to every difficulty.

The original zone-two assertion and its five seeds remain unchanged: stationary Mage deaths are required, tactical guardian kills must remain possible, and natural XP healing and loot stay active. All five pairs pass. Focused tests also verify cooldown downtime for learned and item-granted buffs and pursuit by projectile enemies and casters.

| Controlled zone-two sample | Stationary guardian kills | Tactical guardian kills |
| --- | ---: | ---: |
| normal | 0/5 | 5/5 |
| heldout | 3/10 | 7/10 |
| easy | 5/5 | 5/5 |
| hard | 0/5 | 1/5 |

Normal uses the original seeds 42, 8128, 1337, 2026 and 9001. The additional sample uses 17, 101, 256, 512, 1024, 2048, 4096, 8192, 12345 and 54321. Before the patch, that additional sample had 4/10 stationary guardian kills and 9/10 tactical kills; afterward it has 3/10 and 7/10. One tactical probe reaches the 240-second horizon without killing the guardian; a horizon stop is not a death or success. These exceptions are retained, not removed from the sample. The moving probe is a bot with a fixed mid-rank build, not a human win-rate estimate.

An additional 12 earned-start Mage runs used two seeds, all difficulties, balanced upgrades and camping/tactical policies. Easy cleared 2/4; Normal and Hard cleared 0/4 each, with Normal deaths in regions two/three. This small sample does not establish satisfactory campaign completion rates and calls for further build/class/human playtesting. It does not justify claiming all stationary builds fail or every moving build can win.

Evidence is private under `.build/zone2-final-*.json`, `.build/zone2-heldout-before.json`, and `.build/balance/sustain-cooldown-earned.json`. `.build/balance/sustain-fix-verification.json` fingerprints the final runtime and recorded reports. Full unit suite: 301 passing tests. Earlier balance tables below are historical and do not validate this version.


The economy/zone-two section below records the current tuning. Subsequent matrices are historical snapshots and do not describe the current presets.

Correctness tests and balance probes answer different questions. `npm test` checks rules and regressions. `npm run test:balance` runs earned-start survival simulations; its outcomes are diagnostic, not human win rates.

Portal follow-up: extraction now places the portal away from the hero/guardian and requires a one-second stationary hold after activation. The full-journey completion tables below predate that placement/entry change; combat/economy values remain unchanged. The balance controller now deliberately stops inside a portal rather than walking through it. Placement across all 202 maps, activation/hold/reset, pause and save behavior have regression coverage.

## Economy, card height and zone-two sustain (2026-10-20)

The earlier stationary test started in region three, leaving the reported region-two safety untested. The harness now includes `settled2`: collect and buy only earned improvements after region one, then stand during combat from region two onward and move for extraction. The previous report is retained below as historical evidence, not a claim that all stationary builds were already fixed.

Current changes:

- Upgrade/camp cards fit the logical game height with always-visible Choose/Buy controls and scrollable stat bodies. Up to three cards show on desktop; additional offers scroll horizontally. Mobile has one card per swipe, larger portrait text/buttons, and a compact short-landscape layout. Unchanged rows and repeated rank/bonus wording are removed; exact before/after, signed changes and affected DPS remain.
- Shop price scale is `difficulty * (1 + 0.5 * route progress)`: 1 / 1.5 / 3 for Easy / Normal / Hard, rising another 50% along the route. Common upgrades start at 16 / 24 / 48 gold. The same scale applies to rarer camp upgrades, rerolls, equipment and stock refresh. Sale values stay unchanged. Saved camp quotes migrate to current prices without rerolling offers or taking gold.
- Ore base gold increases threefold, from 8-20 to 24-60 per charge. Hard pays 36-90 before Gold Find. Each vein still has two charges, two veins per region, and a three-active-second stationary mining requirement. Difficulty/Gold Find apply once.
- Heal changes from `20 + 12 * rank` to `12 + 6 * rank`; Shield changes from `35 + 16 * rank`, 65% absorption to `30 + 12 * rank`, 55%. Effective item/school/ward ranks still apply, and the spell inspector/offer previews use these exact same formulas. Cast cooldowns and native targeting remain.
- Hard's previous extra health scaling was compensating for abundant cheap upgrades. With the new economy, its base HP/damage multipliers are 1.2 / 1.1 and regional growth factors cap at 1.5 HP / 2.5 damage. Its density 1.3, spawn rate 1.2, speed 1.1, 0.4-second hit protection, stronger prolonged-fight pressure and higher loot/gold rewards remain. Normal/Easy enemy rules are unchanged from the earlier pass.

Controlled zone-two probe (synthetic, not earned runs): Mage starts in the actual second native region with Fire Arrow/Fireball 3, Heal/Shield 3 or 5, 140 HP, 1.2 cast rate, 0.3 HP/s regeneration and empty gear. Native waves, enemy spells and natural XP healing run normally; reward upgrades are skipped. Five paired seeds compare stationary combat with tactical movement, stopping at health death, guardian defeat or 240 seconds.

| Zone-two Mage | Standing: guardian defeats | Moving: guardian defeats |
| --- | --- | --- |
| Easy, Heal/Shield 3 or 5 | 5/5 at each rank | 5/5 at each rank |
| Normal, Heal/Shield 3 | 0/5; health deaths in 26.8-81.4 seconds | 5/5 |
| Normal, Heal/Shield 5 | 0/5; health deaths in 88.1-127.7 seconds | 5/5 |

This checks the specific moderate-rank interaction; it does not prove that every possible item/armor/drain build is unable to stand still. The five-seed rank-five Normal standing/moving comparison is also a regression test, including natural level-up healing.

Earned 12-region campaigns, five seeds (42, 8128, 1337, 2026, 9001):

| Build / controller | Easy clears | Normal clears | Hard clears |
| --- | --- | --- | --- |
| Healing / mostly standing (`camping`) | 5/5 | 0/5 | Earlier candidate only; not a current Hard claim |
| Healing / stationary combat from zone two (`settled2`) | 1/5 | 0/5; all five reach and die in zone two | 0/5; three die in zone two, two in zone one |
| Healing / tactical movement | 5/5 | 0/5 | 1/5 |
| Balanced / tactical movement | Not repeated | 1/5 | 0/5 |
| Balanced / guardian-seeking and native dash | Not repeated | 2/5 | 1/5 |
| Offense / guardian-seeking and native dash | Not repeated | Not repeated | 1/5 |

These outcomes do not estimate human win rates. Heal-only investment performs poorly on Normal, while mixed builds can clear. Hard now has earned clears again after the initial economy/sustain candidates produced none; it remains punishing and needs human testing. The small other-class Hard smoke check has Archer clear 2/2 and Warrior die in regions one/two in 2/2; these are not class win-rate estimates. Neither bots nor the controlled fixture model optimal play, equipment shopping, ore mining or rerolls. Large item/armor/drain combinations and all-202-region endurance remain separate balance questions.

Reports are private under `.build/balance/`: `economy-final-healing.json`, `economy-final-balanced.json`, `economy-final-hard-balanced.json`, `economy-final-hard-offense.json`, `economy-final-hard-healing.json`, `economy-final-class-check.json`, and `economy-zone2-fixture.json`. `economy-verification.json` records exact inputs/outcomes and checks source hashes: 74 applicable earned scenarios and 60 controlled zone-two fights, from 259 earned scenarios across candidates. The Easy/Normal reports precede the final Hard-only preset change; their complete source identity is verified by reconstructing that one historical Hard health-growth value. They are valid for Easy/Normal, not the final Hard preset.

Reproduce earned zone-two checks:

```sh
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=easy,normal --build=healing --policies=camping,settled2,tactical --max-wall-ms=60000 --out=.build/balance/economy-healing-current.json
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=hard --build=balanced --policies=tactical,skilled --max-wall-ms=60000 --out=.build/balance/economy-hard-current.json
```

Validation: **286 unit tests**, **8 export-policy tests**, campaign browser checks, and knowledge/offer browser checks. Offer geometry is checked at desktop 640x536 and 1024x480, portrait 320x568 and 390x640, and mobile landscape 844x390, including the long offer that changes eight spells. Buttons and camp actions remain inside the game, stat bodies keep at least 60 logical pixels of height, and a real touch swipe inside the stat body browses to another offer. Lengthy stat rows scroll within their cards.

## Historical first sustain/difficulty pass (2026-10-20)

Goal: Easy permits mostly-standing combat; Normal (medium) requires movement and a planned build; Hard is a demanding survival run with meaningful upgrade choices. These are design targets, not guaranteed outcomes for every seed/build.

The reported Mage issue was reproduced with earned upgrades: a Normal healing-priority Mage cleared all 12 regions on seeds 42 and 1337 while standing during combat from region three onward. On seed 42, region three lasted 163.6 seconds with only 1.3 seconds moving for extraction; Heal rank 4.5 and Shield rank 3.5 supported 639.8 damage healed and 1,166 shield absorption. Region four similarly healed all 857.6 incoming HP damage while moving only 1.3 seconds. Broken Shield's 1.5-second early recharge, flat regional enemy damage and global 0.65-second hit protection made mature sustain too safe.

Implemented changes:

- Broken campaign Shield now waits for its remaining cast cooldown. Near-expiry ward maintenance remains. Heal retains its original amount, rank scaling and interval on all difficulties.
- Easy enemy health/damage/speed multipliers are 0.5 / 0.35 / 0.85, with 0.8-second hit protection and no additional regional/prolonged-fight pressure.
- Normal keeps its opening enemy multipliers. Hit protection is 0.45 seconds, with additional regional health/damage factors growing to 1.5 / 2.5 by region five.
- Hard keeps 1.45 health, 1.4 damage and 1.1 speed opening multipliers. Hit protection is 0.4 seconds, with additional regional health/damage factors growing to 3 / 3 by region five. Higher rewards remain: +50% gold, +25% equipment stat power and improved magic/rare odds.
- Normal/Hard first-region hit protection smoothly ramps from 0.65 seconds over 120 active seconds. New arrivals also strengthen during prolonged fights from seconds 60 to 210: maximum additional health/damage factors are 1.2 / 1.35 on Normal and 1.35 / 1.6 on Hard. These two pressure factors cap independently of route length. Enemy spell damage and bestiary previews share the spawning helper. Existing enemies keep their spawned stats.

Across baseline, three candidates, held-out checks and final verification, **318 scenarios** were scheduled. They reuse paired seeds and policies; they are not independent playtesters. The final **60 Mage scenarios** use the exact current runtime, harness and policy hashes. All use earned 12-region campaigns, empty starting equipment and zero money, real XP, drops, autoequipment and affordable camp purchases. No free test build or extraction teleport is used. The half-second background arrivals between swarms are included.

Final full-journey clears out of five seeds (42, 8128, 1337, 2026, 9001):

| Build / movement | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Balanced / mostly standing (`camping`) | 4/5 | 1/5 | 0/5, one horizon |
| Balanced / tactical movement | 4/5 | 4/5 | 1/5 |
| Balanced / guardian-seeking movement and dash (`skilled`) | 4/5 | 2/5 | 1/5, one horizon |
| Healing priority / stand during combat from region three (`settled`) | Not repeated in final matrix | 0/5; all health deaths in region three | Not repeated in final matrix |
| Random upgrades / same guardian-seeking movement and dash | Not tested | 0/5 | 0/5 |

The final balanced Easy camping runs move only about 22-23% of active time. Earlier held-out healing-priority Easy camping checks cleared 5/5 across the same seeds; Easy rules are unchanged from that candidate. Mostly standing still requires collecting rewards and reaching exits. Random means uniformly choosing offered level-up cards using a separate seeded RNG, then purchasing the first affordable generated camp offer; it is not a uniform sampler of whole builds.

The dash policy is a separate diagnostic, not a claim of optimal play. It seeks guardians with a class-dependent standoff, prioritizes armed exits and uses only the actual dash action/cooldown. It sometimes performs worse than the original tactical policy. The two Hard horizon cases survive 2,400 active seconds without completing (camping reaches region six; guardian-seeking reaches region eleven). They count as neither clears nor combat deaths. Missed extraction is reported separately; one final Easy guardian-seeking run and one Hard tactical run failed extraction.

Remaining exceptions matter: balanced Normal camping still clears one seed, and the final-combat two-seed Warrior/Archer Hard check still has one mostly-standing clear for each class. The other Warrior camping case now dies in region three. Strong shield/field/drain builds and repeated earned camp purchases can still snowball; this patch does not establish that every mature build must keep moving. Hard is substantially more punishing for Mage than those two classes. Human desktop/touch runs and more seeds are needed before treating the settings as settled, and all-202-region endurance/equipment-shop/mining economy were not rebalanced here.

Reproduce the exact-source final reports:

```sh
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=easy,normal,hard --build=balanced --policies=camping,skilled --max-wall-ms=60000 --out=.build/balance/sustain-final-balanced.json
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=easy,normal,hard --build=balanced --policies=tactical --max-wall-ms=60000 --out=.build/balance/sustain-final-tactical.json
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=normal --build=healing --policies=settled --max-wall-ms=60000 --out=.build/balance/sustain-final-idle-heal.json
node tools/balance-campaign.mjs --seeds=42,8128,1337,2026,9001 --heroes=mage --difficulties=normal,hard --build=random --policies=skilled --max-wall-ms=60000 --out=.build/balance/sustain-final-random.json
```

Private evidence is retained under `.build/balance/sustain-*.json`; `sustain-verification.json` inventories the 318 scenarios, checks final source/report hashes and records verification. `sustain-candidate3-hard-classes.json` contains the final-combat Warrior/Archer checks; a subsequent policy edit only clarifies conditional-expression spacing. The final regression suite passes **282 tests**, with **8 export-policy tests** and campaign/knowledge desktop/mobile browser checks. New regression coverage checks hit-protection ramping, bounded regional/prolonged pressure, spell/bestiary scaling, Shield recovery, unchanged Heal values, saved-run continuation and harness diagnostics/dash cooldown gating.

## Historical larger-wave and knowledge update

Current Normal pacing starts with a seeded 25-40 enemy burst every 24 seconds, adds five every two waves within the area (up to +25), and up to 20 over normalized route progress. Difficulty scales counts and interval; extraction accelerates interval by 1.5 times. Spawns favor randomly selected camera-perimeter directions with native clearance/elevation. Four requests per simulation frame are created; blocked requests remain queued. There is no hidden alive-population cap.

The entry-density hypothesis is roughly 1.0-1.7 arrivals/s at baseline and 8-25 visible enemies for an entry build. Measurements below use **earned upgrades**, so they measure the evolving game rather than holding the hero at entry power. Strong area builds can clear between bursts. Do not equate a 40-enemy burst with 40 enemies continuously visible.

The original Fire-Arrow-only Mage failed every Hard case in the initial five-seed dense-wave matrix. Fresh campaign Mages now start with original Fire Arrow plus Fireball; both spells keep their existing damage, targeting, homing/impact behavior and cooldowns. No starting cast-speed bonus was retained. Existing saved loadouts stay unchanged.

Final earned 12-region matrix: **45 clears / 45 scenarios**, with the five default seeds, all three classes and difficulties, collection steering and starter-spell upgrade priority. This is not a player win-rate estimate. There were no blocked rewards, horizons or CPU aborts in this matrix. A separate 180-second Hard opening probe reached region two in 9/10 Mage runs, including five held-out seeds; the other run died in region one. A horizon in that probe is explicitly not a full campaign clear.

| Class | Easy clears | Normal clears | Hard clears | Normal visible mean / peak, first-region seconds 30-90 |
| --- | --- | --- | --- | --- |
| Mage | 5/5 | 5/5 | 5/5 | 5.4 / 28 |
| Warrior | 5/5 | 5/5 | 5/5 | 8.7 / 36 |
| Archer | 5/5 | 5/5 | 5/5 | 4.4 / 28 |

These are screen-intersection counts using native height projection and sprite bounds, excluding arrival grace. Low means for area builds remain a human feel/playtesting question; the visible burst peaks are substantially larger than the earlier thin-wave setup. This matrix does not establish challenge balance, actual phone rendering performance or the current all-202-region endurance mode.

Reproduce the final matrix:

```sh
node tools/balance-campaign.mjs --policies=collect --build=starter --out=.build/balance/knowledge-campaign-final.json
```

Private reports: `.build/balance/knowledge-campaign-final.json`, `dense-mage-area-openings.json` and `knowledge-verification.json`. The campaign report's simulation dependency hashes match the final combat code. Two subsequent read-only stats/rendering modules are identified separately in the verification record and checked by browser tests; their formatting changes do not alter the simulation.

The current UI tests additionally check cloned offer previews against applied combat values across every spell/rarity, ledger/save migrations, item-granted spells, bestiary values against spawning, and the wave queue. Browser checks cover desktop/mobile hover, keyboard focus/activation, tap, source breakdowns, bestiary art/search/paging, paid camp and replacement previews.

## Reproduce a matrix

```sh
npm run test:balance
node tools/balance-campaign.mjs --seeds=8128,42 --heroes=mage,warrior --difficulties=normal,hard --policies=collect,tactical --out=.build/balance/focused.json
node tools/balance-campaign.mjs --heroes=mage --build=starter --policies=collect,stationary,tactical --out=.build/balance/mage-starter.json
node tools/balance-campaign.mjs --seeds=8128 --heroes=ranger --difficulties=normal --policies=collect --areas=all --max-wall-ms=120000 --out=.build/balance/endurance.json
```

Defaults are five paired seeds (8128, 42, 1337, 2026, 9001), all three classes and difficulties, and a 12-region route. The npm command includes all three policies (135 scenarios). Reports go into ignored `.build/balance/`; `--out` keeps before/after reports separate. `--max-seconds` limits active simulation time for short diagnostics. Invalid arguments fail rather than quietly testing a fallback.

`--build=healing`, `balanced` and `damage` add sustain, mixed and offense priorities. `random` selects random level-up cards with its own seeded RNG and buys the first affordable camp offer. `--build=legacy` (the default) preserves the original fixed upgrade priorities. `--build=starter` prioritizes the class starting spell above them, using only real offered/affordable upgrades. In particular, the legacy priority map under-invests in Fire Arrow; compare both builds before treating Mage failures as damage-balance evidence. Each policy within a build shares its upgrade priorities.

Each report records hashes for every runtime MJS module, the harness and the tactical policy, plus scenario configuration. Keep these with comparisons: a stale report is not evidence for a changed build. Source hashes identify the simulation inputs; assets, platform and renderer performance require separate checks.

## Policies and evidence

- **collect** follows floor routes to pickups and exits with simple local repulsion. Warrior pursues enemies directly. This intentionally preserves the initial diagnostic policy for paired comparisons.
- **tactical** uses the same reward priorities but tries local steering directions, keeps a melee standoff, and avoids nearby contacts, projectiles and marked areas. It still has incomplete navigation and decision-making.
- **camping** collects for five seconds out of each 24-second cycle, stands for the other nineteen, and moves to exits.
- **settled** collects in the first two regions, then stands during combat and moves only for extraction. **settled2** begins stationary combat in region two, after collecting in region one.
- **skilled** adds guardian-seeking, stronger exit priority and native dash requests to tactical steering; cooldowns remain enforced by the game.
- **stationary** sends no movement. It still chooses upgrades and spends earned gold in camp, and can accidentally extract if a portal is underfoot. A missed-exit death is not proof that idle combat itself was lethal.

All policies start with the normal class spell, empty equipment and zero money. They earn XP, collect real drops and buy affordable camp offers. No test gear, invulnerability, extra healing or extraction teleport is granted. Mining, equipment-shop purchases and rerolls are omitted. Only `skilled` uses dash. Bots know simulation positions, including offscreen targets, and use simple fixed upgrade priorities; they are not models of player perception, build skill or human win rate.

Diagnostics include 30-second checkpoints, per-region damage/healing and earned/spent gold, guardian HP and kill time, damage by element, the last ten successful hits, peak enemy population and time spent attempting movement without moving. Guardian kill time starts at spawn and includes approach time. Render FPS is not measured by simulation CPU timings.

Terminal results are explicit: `won`, `dead`, `horizon`, a CPU-budget abort or a blocked reward. Health loss and missed extraction are separate death causes. An incomplete/aborted run never counts as a clear or a combat death. Wall-clock budgets depend on machine load; compare completed outcomes and inspect aborts separately.

## Findings and fixes

The five-seed collection baseline cleared Normal in 1/5 Mage, 4/5 Warrior and 5/5 Archer runs. One seed had exaggerated the apparent Warrior problem. Several later failures were missed extraction after a successful guardian kill, rather than insufficient damage or healing.

Two reproduced defects were fixed before the final matrix:

- Warrior's campaign sweep reached 85 units but its trigger searched only 70. Trigger and sweep now use the same reach, including equipment reach bonuses. The legacy non-campaign profile retains its old reach.
- A flying guardian could leave an exit over water. Exit placement now uses reachable ground, as its loot already did.

## Historical post-fix measurements

Completed **180 twelve-region scenarios** (135 with legacy priorities, 45 Mage starter-priority comparisons), plus **three all-region probes**. These reuse five paired seeds; they are correlated diagnostics, not 183 independent route samples. No general damage or difficulty multiplier was changed to make a bot pass.

Collection policy, legacy build priorities; clears out of five scheduled runs:

| Class | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Mage | 5/5 | 1/5 | 2/5 |
| Warrior | 5/5 | 4/5 | 2/5 |
| Archer | 5/5 | 5/5 | 4/5 |

Tactical steering, the same legacy build priorities:

| Class | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Mage | 4/5 | 2/5 | 1/5 |
| Warrior | 4/5 | 4/5 | 3/5 |
| Archer | 3/5 | 3/5 | 3/5, one CPU abort |

The alternate policy is sometimes worse, especially on Archer. It can avoid useful collection or extraction movement and is not an optimal-play benchmark. Steering results must not be used to claim a human win rate.

Prioritizing Mage's starting Fire Arrow, with no gameplay stat changes:

| Policy | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Collection | 5/5 | 3/5 | 4/5 |
| Tactical | 3/5 | 3/5 | 1/5 |

All 60 post-fix stationary scenarios ended in death, including missed exits; this does not establish that stationary combat itself is impossible. One tactical Archer run hit its CPU budget. There were no blocked rewards or active-time horizon outcomes in the final matrices. Hard can clear where Normal fails under the same bot/seed: higher rewards and divergent builds complicate difficulty ordering, and five seeds are too few for a win-probability estimate.

All-202-region mode, seed 8128, Normal, collection policy, legacy upgrade priorities:

| Class | Outcome | Active time | Camp purchases | Final wallet | Final guardian kill time |
| --- | --- | --- | --- | --- | --- |
| Mage | Health death in region 1 | 91.2 s | 0 | 29 | Not reached |
| Warrior | Cleared 202 | 25,311.0 s | 173 | 28,503 | 3.0 s |
| Archer | Cleared 202 | 25,849.9 s | 182 | 17,038 | 4.1 s |

These are real earned runs, not skipped or teleported region checks. Guardian timing includes approach. The final Warrior and Archer regions dealt zero damage to those builds. Their large remaining wallets also reflect that these bots never buy equipment. Thus full-route progression works for these cases, but late endurance challenge and gold sinks are not established as balanced. Early Mage viability remains sensitive to starting map and build choices.

## Follow-up priorities

1. Human earned runs on desktop and touch, especially Mage openings and Warrior fights against flying/ranged guardians. Compare starter-rank, cast-speed and defensive choices.
2. Endurance pressure after builds mature. Measure several late-region fights before choosing guardian scaling, wave pacing or upgrade-price changes; do not infer challenge from route length alone.
3. Equipment-shop spending and mining policies, more held-out seeds, and real phone rendering profiles. The current results cannot establish those systems' balance.

Raw JSON reports and source hashes are retained privately in `.build/balance/`: `multi-seed-baseline.json`, `tactical-baseline.json`, `multi-seed-final.json`, `mage-starter-final.json`, and `all-regions-final.json`. Runtime hashes of all post-fix reports match the tested gameplay sources; harness hashes distinguish the added build-selection option. The full 259-test regression suite and campaign/mobile browser checks passed; the local Electron build was rebuilt and its packaged smoke check passed.

## Remaining playtesting

These probes do not validate human play. Check earned desktop and touch runs, readable telegraphs, melee access to flying guardians, skill/gear variety, early map variance and guardian fights. Test rendering on actual phones separately. All-region endurance needs its own earned run, economy/cap inspection and explicit completion status; a short all-region smoke test checks configuration only.

The half-second background arrivals added between swarms increase sustained enemy pressure beyond the earlier burst-only reports. The sustain matrix above includes this combined pacing; earlier burst-only reports do not validate it; the new cadence, queue blocking, difficulty scaling, pause behavior and save continuation have dedicated regression tests in `tests/campaign-trickle.test.mjs`.
