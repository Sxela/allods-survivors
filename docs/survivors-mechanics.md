# Allods Survivors mechanics profile

This records the implemented survival rules. Original catalogs retain game identities and artwork; encounter timing, prices, promotion, upgrades and arena selection are authored survival adaptations.

## Native regions and the run loop

The [Allods2.eu map pack](https://allods2.eu/files/maps_all.zip) contains 216 ALM files. The importer currently accepts **202**, including original server/map variants. Four additional valid variants were recovered by supporting both documented section markers. Fourteen files have no sufficiently broad connected crop under the current suitability rules; they are recorded in the private extraction audit rather than replaced with invented maps.

Every accepted file contributes an original region of at most **48 x 40 native 32-pixel cells** (1536 x 1280 world units). The selector also tries 40 x 32 and 32 x 28 crops. It requires at least 80% connected walkable floor and at least 400 broad-clearance cell samples. All selected regions currently contain supported native hostile creature placements inside the crop. Their original tile IDs, transition artwork, signed heights, source coordinates and source digest remain identifiable. This is a native terrain crop, not a generated biome with a source-map label.

Normal journeys sample **12 map files**, seeded and ordered using the existing creature-tier estimates. The menu also offers **All 202 regions**. All-map mode visits every accepted file once, including source variants; it is intentionally a long journey. The old five procedural biome textures remain a fallback, not the route limit. Source-map monster identities are recovered; native server HP/damage records are not used as if they were survival-balanced constants.

The loop is fight/collect -> character improvement and periodic learning -> guardian -> loot/extraction -> safe camp -> next region. A guardian arrives after 120 active seconds in each region. Waves continue through its fight. Death opens a portal on reachable ground at least 128 world units from both the player and guardian, preferably about 160 from the guardian, without interrupting movement with a purchase modal. Flying guardians cannot strand the exit over water. It arms after one second; standing still inside its 32-unit radius for a further uninterrupted second starts camp. Moving or leaving resets that hold; pauses freeze it. A progress bar shows the hold. A visible 30-active-second deadline begins immediately on the kill. Missing it loses the run. The final region also requires extraction, then completing camp wins.

Original terrain is bounded visibly. Mountains/water and the selected connected floor constrain walking. Player collision, spawn candidates, enemy pursuit, summons, teleports and reward landing use the same region. Flying enemies can cross natural barriers while remaining inside the crop. Drops from inaccessible flying positions land on reachable ground. Temporary stone walls clear when an exit opens. Source scenery is a sparse decorative layer, deliberately passable: at most 64 props, including at most ten recognized native buildings. Original scenario scripts, quests, factions, interiors, bridge simulation and multi-floor building rules are not executed or claimed to be reconstructed.

Ground and actor projection use native heights. Spawns account for actual sprite bounds, elevation, viewport and zoom. Candidates favor a random point around the current camera perimeter, rather than a remote map edge or the same nearest side. Planned positions are consumed once. When the entire small arena is visible, a distant spawn uses a 0.8-second arrival effect and cannot attack or take damage during arrival. It does not silently spawn in contact. Normal waves begin at 25-40 creatures, chosen with seeded randomness every 24 seconds. Every two waves add five creatures, capped at +25 within the area; normalized route progress adds up to 20 more. Thus late prolonged fights reach at most 70-85 per wave before difficulty, independent of whether the route has 12 or 202 regions. Extraction shortens the interval by 1.5 times. These are bursts, not an alive-population cap. Ordinary gold and vein yields use bounded route progress too. Between burst queues, one additional local-roster monster arrives every 0.5 seconds on Normal, scaled by difficulty spawn rate (about 0.59 seconds on Easy and 0.42 seconds on Hard). The background clock pauses during swarm creation, blocked requests, level-up, inventory, pause and camp; it saves its remaining delay and resets on area entry. It also continues during the guardian and extraction fights. These arrivals are ordinary monsters, without extra guaranteed leaders. Enemy creation is budgeted at four queued requests per frame. Blocked requests remain queued; no population cap silently discards equipment leaders.

## Difficulty and sustain pressure

Easy is intended to support mostly-standing combat, while still requiring collection and extraction. Normal (the medium setting) rewards movement and deliberate upgrades. Hard retains its higher gold and equipment quality rewards, with stronger early-region progression to challenge earned defensive builds.

Campaign post-hit protection is 0.8 seconds on Easy, 0.45 on Normal and 0.4 on Hard. Normal/Hard start the first region at 0.65 seconds and smoothly approach their regular value over its first 120 active seconds. Easy uses 50% base enemy health, 35% damage and 85% speed. Normal retains its original opening enemy multipliers; Hard uses 120% health, 110% damage and 110% speed. Its higher density, shorter spawn interval and stronger prolonged-fight pressure remain. The former extra Hard health growth was reduced to account for fewer purchasable improvements.

Across regions one through five, additional health scales from 1 to 1.5 on both Normal and Hard; additional damage scales from 1 to 2.5 on both. These factors cap independently of route length. New arrivals in prolonged fights gain a separate pressure factor from 60 to 210 active seconds, capped at 1.2 health / 1.35 damage on Normal and 1.35 health / 1.6 damage on Hard. Existing enemies are not retroactively strengthened. Easy has neither extra pressure factor. The shared spawning/bestiary calculation applies the same damage scaling to enemy spells.

A broken campaign Shield waits for its remaining cast cooldown; it no longer gets the old 1.5-second early refresh. Active self-wards still use maintained near-expiry scheduling. Heal now restores `12 + 6 * effective rank` HP (formerly `20 + 12 * rank`). Shield has `30 + 12 * effective rank` capacity and absorbs 55% of each incoming hit (formerly `35 + 16 * rank` and 65%). Cooldowns and near-expiry maintenance are unchanged. These are shared combat/inspection values on every difficulty; healing items and spell-level bonuses keep their mechanics. See [balance testing](balance-testing.md) for earned-run results and remaining strong-build exceptions.

## Cooldown combat, with health as the only resource

**Mana is removed.** There is no player or enemy mana capacity, cost, recovery or cast gate. Actual autocasting is governed by cooldown and useful targeting. Pauses freeze cooldowns. Successful casts still report their real cooldown duration for the radial spell overlay.

Maximum mana, mana regeneration, Spirit and their affixes are removed from active loot definitions, base item stats, authored uniques, comparisons, prices, shop stock, HUD and spell inspection. Existing inventory/equipment/stock is sanitized even when already at the current item-balance version. Supported item properties, identities and art are preserved; unsupported fields do not retain sale/comparison value. Original immutable source metadata may still describe native resources, but it does not participate in the playable rules.

Older active runs remove resource fields from actors and base-stat pools. Paid mana-efficiency improvements become effective ward-rank improvements once. The old Efficient Ward behavior becomes Mobile Ward. Repeated restoration does not apply the conversion twice. Old unbounded five-area runs receive a deterministic native route and are rebased into its valid floor. New native saves retain their actual route and region beyond area five.

| Class | Immediate role | Crowd identity |
| --- | --- | --- |
| Mage | Fire Arrow + Fireball | Fields, beams and control |
| Warrior | Physical weapon and Shield | Sweeping attack, 85 units plus weapon reach |
| Archer | Bow and Poison Cloud | Arrows penetrate three targets |

Body, Agility and Mind retain real derived consumers. Physical absorption, Defense/evasion, Fire/Water/Air/Earth resistance, regeneration, attack ratings/ranges, spell/weapon mastery, Magic Find and Gold Find remain active. Unknown stats are filtered out. `STAT_DEFINITIONS` records each active stat's unit, zero-bonus baseline, limit, eligible families, stacking and consumer.

Incoming physical damage passes evasion, flat absorption, bounded resistance and shield absorption. The strongest readied melee contact wins a shared contact window, preventing weak creatures from masking boss hits. Enemy casters mark a fixed ground point for 0.7 seconds: moving more than 55 units dodges direct marked beams/drain, missiles travel toward the mark without homing, and fields resolve at the mark. Petrification and casting range still matter.

Spell identities, icons, effects and original-behavior implementations remain in their catalog. Heal requires a wounded recipient; corpse animation requires a corpse; summons own real HP, damage and TTL. Stone Wall retains a minimum safe casting distance. The original native VFX and clothed player/paperdolls remain.

## Learning, improvements and arithmetic

Ordinary character levels give three usable draws across owned spells and hero passives, including a hero alternative when available. Every fifth level separately queues learning: three unlearned spells and Keep current spells. A full category permits deliberate replacement. Maximum learned capacity remains five offense and three defense. Replacing clears individual improvements, behavior choices, active status and cooldown for the removed spell; shared/equipment bonuses remain. Equipment-only spell grants do not become learned or eligible for individual purchases.

Magic Find improves equipment and upgrade **quality**, never equipment occurrence or choice count. Ordinary equipment chance stays 0.4%; captains/elites/guardians guarantee equipment. Existing type-specific affixes, discrete +1 to +3 spell levels, dramatic bounded rolls, automatic clear upgrades and dominance-only autosell remain. Health item bonuses retain the existing 60-point cap.

| Rarity | Rank increment / passive multiplier | Base camp price |
| --- | --- | --- |
| Common | 1.0 | 16 |
| Uncommon | 1.25 | 22 |
| Rare | 1.5 | 30 |
| Epic | 2.0 | 44 |
| Legendary | 3.0 | 64 |

Learned rank caps at eight. Capped active spells can improve individual cast speed; capped self-buffs can improve effective ward rank, each up to +50%. Effective rank includes gear and school mastery, then behavior, capped at 30. This improves native rank scaling; it is not mislabeled as a flat percentage of total damage.

Five successful individual purchases queue a free two-option behavior reward. Rarity does not multiply purchase count. Active spell choices trade cast speed against effective rank. Greater Ward gives +20% effective rank with -10% movement while active; Mobile Ward gives +12% movement while active with -10% effective rank. These replace mana-efficiency choices with real effects. At most two behavior choices belong to one spell. Pending milestones persist and do not spend another ordinary reward.

Bonuses add within documented pools. Movement adds against immutable class speed instead of repeatedly multiplying current speed. Cast interval is `baseCooldown / (haste * individualTempo * behaviorTempo * (1 + effectiveRank * 0.035))`; rate divides interval. Intervals stop at 20% of the configured base cooldown (at most five times its base cast rate), and capped individual tempo is excluded from offers. Equipment recomputes from bases on equip/unequip. Rank and behavior layers multiply intentionally. Radius, wall length, duration and tick interval remain separate units. Simulation retains full precision; displays round separately. Once every legal improvement is mastered, a level converts to ten gold rather than opening an empty menu; an exhausted camp cannot charge for a meaningless reroll.

## Economy, safe camp and persistence

Camp offers five improvements with exact rarity, price, wallet and affordability. A purchase validates the offer and live target, applies once, debits once and removes only the purchased offer. Stale/capped/invalid/unaffordable purchases spend nothing. Exhausted useful stock refills; base rerolls cost 8, 16, 24... within that camp. Camp improvements, camp rerolls, equipment purchases and stock refresh all apply the same price scale: `difficulty * (1 + 0.5 * normalized route progress)`, rounded up to whole gold; difficulty is 1 on Easy, 1.5 on Normal and 3 on Hard. Common improvements start at 16 / 24 / 48 gold, and grow to 24 / 36 / 72 at the last region. Equipment resale values are unchanged. Existing saved camp quotes are repriced on restoration/preparation without changing their rarity, upgrades or wallet. Buy/Choose buttons are explicit. Reward/camp activation clears held movement and rejects activation for the first 300 ms, including keyboard and touch.

Equipment trading retains the inventory shop, including while combat is paused, as an intentional convenience. Camp improvement purchases begin only after extraction. Two optional finite gold veins per region reward standing within 44 units for three active seconds. Movement/leave resets progress. Each has two charges worth `24 + round(36 * route-progress)` base gold, modified once by Gold Find and difficulty. This is three times the previous base yield: 24-60 gold per charge on Easy/Normal, 36-90 on Hard before Gold Find. They retain depletion on Continue and provide no paused or remote income. Their placement is snapped to reachable floor.

| Transition | Progress | Health and timers | Preferences |
| --- | --- | --- | --- |
| New run | Empty gear, class starting spell, zero run gold | Class health; new cooldowns | Retained |
| Continue | Exact route, region, inventory, skills, purchases, RNG and pending choices | Restore health, cooldowns, exit deadline and deposits | Retained |
| Next region | Keep build/gold; clear old enemies/drops | No free heal or cooldown reset | Retained |
| Death / failed exit | Clear active progress and legacy | Terminal; fresh next start | Retained |
| Victory | Record result; no active Continue | Terminal | Retained |
| New session | Clear profile/run after confirmation | Fresh next start | Retained |

Autosave runs every two active seconds, after rewards/purchases, on pause and visibility changes. Native import/export preserves the active snapshot. Old item sanitization and ward conversion are idempotent. Tile/render caches rebuild around the saved map and position; the full source pack is never embedded in a save. Run-record UI replaces obsolete permanent-upgrade purchases.

The left gear provides world zoom, full-screen touch/optional joystick, saved audio volume and current build inspection. Mana bars and mana information are absent. Spell-value and interval helpers are shared by inspection/combat, including utility effects. HUD spell inspection opens on hover, keyboard focus, Enter/Space or tap; it does not pause combat and includes live cooldown/ward state. Self-buff configured cooldowns are labeled separately from maintained near-expiry refresh behavior. The full-width mobile XP bar remains above the eight spell slots. Source fonts, inventory art, clothed dolls and burgundy buttons remain.

## Evidence and verification

The map pack URL above and primary-source [AllodsMap reader](https://github.com/jewalky/UnityAllods/blob/master/Assets/Data/AllodsMap.cs), [terrain decoding](https://github.com/jewalky/UnityAllods/blob/master/Assets/MapLogic/MapLogic.cs), and [ALM specification](https://github.com/madwareru/orom-file-formats/blob/master/KSY/rom_alm.ksy) establish the file layout. The private importer validates the actual shipped bytes, handles varying section order and markers, records source digests/exclusions, and exports only bounded data and referenced artwork. Authors/contact fields, scripts and original ALM archives stay outside the public/runtime payload.

`tests/native-arenas.test.mjs` checks every accepted crop's grids, source bounds, connected floor, original IDs, body clearance, projected offscreen spawning (desktop/portrait/zoom), all-map coverage, deterministic selection and saves beyond area five. `tests/mana-removal.test.mjs` checks generation, legacy inventory/stock/run migration, idempotence, real ward effects and mastered-build fallback. Existing campaign tests cover extraction/deadlines, safe purchases, learning/replacement, milestones, RNG and class attacks. Browser checks cover native portals, camp/inventory return, guarded rewards, Continue and mobile controls.

`tools/balance-campaign.mjs` records all runtime module hashes and earned-start matrices across classes/difficulties, using native floor navigation for collection and exits. It grants no free gear, XP, money or healing, and omits mining, equipment-shop purchases and rerolls. Five-seed comparisons distinguish collection, stationary, mostly-standing, settled-from-region-three, tactical and guardian-seeking/dash steering, with starter, healing, balanced, damage and random-upgrade profiles. Successful idle combat and a missed-exit death are recorded separately; computational aborts never count as clears or combat deaths. See [balance testing](balance-testing.md) for commands, measured results, confirmed reach/exit fixes and limits. Real phone frame-time profiles and human-earned routes still need playtesting.

## Readable offers and creature knowledge

Every level, learning, replacement, behavior and paid improvement card previews a cloned build through `applyGift`, effective-rank, equipment, interval and potency helpers. Rarity-dependent fixed strings are not used as the displayed value. HP states flat HP and no free heal; movement names px/s and class base; regeneration keeps enough decimals for 0.15 HP/s. Replacement cards include the loss/reset of the selected spell while item grants and shared bonuses remain.

Current stats are under the left gear, grouped into Hero, Damage, Defense, Attributes and Spells. The view explains class base, equipment, Body/Agility/Mind derivation, character-level upgrades, camp improvements and active effects. Contributions from older saves are labeled Earlier improvements when their purchase origin cannot be reconstructed. The new level/camp ledger persists; it does not change combat totals. Resistance and damage layers show multiplication and caps explicitly. Recovery is continuous; there is no invented post-hit delay. Actual weapon attack timing/reach and per-spell targeting, cooldown, potency and item/school levels remain visible.

The gear also opens a paused, searchable, paged bestiary. Default filtering uses the current native roster plus live/special guardians; the full catalog exposes other appearances. It renders original sprite pixels and lists native identity, appearance siblings, source regions, flight, scaled health/damage/speed, attack type/range, spell families, and current statuses. Ordinary/captain/guardian previews use the same `monsterCombat` helper as spawning. Native server HP/damage/resistances were not recovered and are not invented: base enemy resistances are zero in this survival simulation, with shields/statuses handled separately.

`tests/knowledge-inspection.test.mjs` verifies preview purity and applied values across rarities and every original spell, source reconciliation/save migration, item-only spell semantics, bestiary scaling and the wave queue. `tests/browser-knowledge.cjs` checks desktop/mobile hover/focus/tap, exact offers, scrolling, bestiary art/search/paging and camp previews. Larger-wave balance reports supersede earlier thin-wave measurements; see the balance-testing record.

Fresh campaign Mages begin with the original Fire Arrow and Fireball at rank one, giving them focused and area tools alongside the other classes' weapon-plus-spell starts. Their base damage, cast rate and spell behavior are unchanged. Existing saves retain their learned loadout; no spell is injected during Continue.

Grounded units align each frame to its visible opaque foot edge instead of the padded atlas-cell bottom. Contact shadows use local terrain tangents and the visible body width, including on slopes. Native flying units retain their original hover offset.

Damaging spell upgrade previews, including camp and behavior tradeoffs, show before/after estimated sustained DPS per target at the live cast interval. Direct spells use damage per hit divided by the interval; persistent fields include their full-contact tick count per cast and can overlap. Values include damage, item/school rank and cast-speed bonuses before target defenses. Field estimates depend on contact and final-tick timing; Poison Cloud excludes its separate lingering poison status. Area/beam targets are not multiplied into the per-target number. Current spell details use the same estimate; utility and summon spells do not invent direct DPS.


Upgrade/camp cards use the available logical viewport height. The action stays visible while long stat lists scroll inside the card. Desktop shows up to three cards across; extra cards scroll horizontally, and mobile uses one card per swipe. Short landscape hides decorative icons/header text to preserve usable space. Only changed upgrade rows are shown, including DPS changes; exact before/after and signed deltas remain. Repeated rank/bonus descriptions and unchanged duration/tick rows are removed. Learning cards retain the spell's effect description. Preview assumptions remain available in full spell inspection and condensed on the cards.

Gold veins render at twice their former width and height (48 x 48), with labels lifted above the larger sprite. Ordinary gold drops retain their existing size.
