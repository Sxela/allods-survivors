# Performance and asset delivery

Run `npm run test:performance` after installing Playwright browsers. The default benchmark uses three repetitions of local, constrained (1.5 Mbit/s down, 256 kbit/s up, 150 ms added latency) and poor (500 kbit/s down, 128 kbit/s up, 300 ms added latency) profiles. These are authored test profiles, not measurements of real mobile networks.

For a focused run: `node tools/performance-playtest.cjs --profiles=local,constrained,poor --samples=1`. Chromium CDP applies a shared connection throughput cap; a pair of concurrent uncached payloads checks the effective rate. Rate settings use bytes per second. Inspect calibration results before treating throttled timing as reliable.

The report and screenshots are `.build/performance/report.json` and `.build/performance/*.png`. Reports include code and manifest fingerprints, profile/cache state, time to menu and first usable scene, initial delivery versus the broader staged workload, transfer bytes, cache responses, image ownership, JS heap where exposed, and frame-time percentiles. Tracked decoded RGBA bytes are not total browser/GPU memory. Transfer bytes use CDP encoded data lengths and may include protocol overhead.

## Scenarios and interpretation

Each repetition uses fresh browser storage for cold entry and retains persistent HTTP caches for a full warm reload. The same actual renderer then runs a synthetic 70-enemy stress scene with granted survival. Those grants are isolated test setup and provide no balance or earned-run evidence. Menu readiness is separate from the first rendered, advancing scene. Individual request and navigation timeouts are allowed to be longer on constrained networks.

Provisional review budgets are 15 seconds to playable locally, 180 seconds constrained, 420 seconds poor, and 50 ms rendered p95. The report retains misses as failures of those budgets; it does not turn them into passes or infer phone performance from desktop/software rendering.

Required-image failure/retry, frozen pre-play state, safe pause, save/reload and scene readiness are additionally checked by `npm run test:browser`. Its screenshots are separate from performance evidence.

## Serving and caching

`node survivors/launcher.cjs --no-open --production` uses the same server policy as the browser checks. Development serving retains revalidation without compression. Production negotiates gzip for larger text/code/metadata, uses content-derived ETags, handles conditional requests and returns coherent updated bytes after changes. Payloads with an exact content-digest `v` query can be immutable; unversioned payloads and the manifest revalidate. Ordinary PNG/WAV payloads are not recompressed blindly.

The server restricts methods, MIME types, paths and symlink targets. Missing assets return errors, not an HTML success response. It is a local serving implementation; deployment TLS/CDN behavior and production infrastructure need their own checks. Electron continues to use its restricted local protocol.

The renderer keeps arbitrary animation-frame access through the existing lossless PNG atlases. No lossy conversion, animation-container substitution, source-pixel edits or atlas repacking was justified in this pass. Region-scoped actor ownership addresses the measured large decoded-memory family before changing asset formats. Item thumbnails use a separate bounded optional cache.

## Validation limits

Record measured results and exact source identity before making performance claims. A one-sample run is a diagnostic, not a distribution or a physical-phone certification. Repeated long sessions, memory plateau, rapid travel/cancellation, updated-index deployment recovery, real Android/iOS devices and deployed hosting remain distinct acceptance scenarios. The current benchmark does not silently claim to cover them.

Keep performance evidence separate from `docs/balance-testing.md`. Changing loading, caching and observation must not change authoritative simulation, costs, rewards or random outcomes. CI runs deterministic rules plus portable browser/menu/grounding checks; it does not publish a performance score from a shared runner or silently dispatch releases.

## Measured technical pass (2026-10-24)

One fixed-seed-42 repetition per profile, actual current resources, desktop Chrome at a 390 x 844 viewport. Each pair includes a cold visit and a full warm reload. The stress scene is synthetic, not earned gameplay. All retained runtime fingerprints match the tested source; the exact harness copy is `.build/performance/runner.cjs`.

| Profile | Cold playable | Warm playable | Cold bytes before playable | Warm bytes before playable |
| --- | --- | --- | --- | --- |
| Local | 0.64 s | 0.36 s | 13,796,376 | 47,552 |
| 1.5 Mbit/s, 150 ms | 75.64 s | 4.78 s | 13,787,057 | 45,794 |
| 500 kbit/s, 300 ms | 224.79 s | 9.76 s | 13,787,057 | 45,794 |

Shared-throughput calibration measured approximately 181,721 bytes/s constrained and 61,303 bytes/s poor, consistent with their configured aggregate caps. Rendered stress p95 was approximately 4.3-8.4 ms on this desktop run; this does not predict real phone performance. Owned decoded image estimates were approximately 79.3 MiB in the exercised stress scene, compared with the earlier all-at-once loader's approximately 307.4 MiB before play. These estimates exclude browser-owned DOM images, audio, GPU and other process memory, and do not establish a long-session plateau.

Cold delivery still transfers about 13.8 MB before play and takes minutes on a poor connection. Passing the provisional budget is not a claim that this delay is ideal. Further transport/image-format optimization needs measured byte/quality comparisons; no lossy conversion or original-pixel replacement was introduced merely to obtain a smaller score. More repetitions, real devices and deployed-server measurements remain open.
