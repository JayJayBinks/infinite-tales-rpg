## Infinite Tales RPG E2E Test Plan (Party System Refactored)

This updated plan aligns tests with the current multi‑party architecture, streaming GameAgent, post‑narration CombatAgent stats updates, EventAgent party evaluation, and authoritative state mutation only via `applyGameActionState` / merged GameActionStates.

Legend (Priority): C = Critical, H = High, M = Medium, L = Low

---
### 1. Onboarding & Tale Setup
1.1 Quickstart happy path (C)
  Action: Save Gemini key → Quickstart (Settings) → request four‑hero party → accept tale.
  Expected: localStorage (useLocalStorage wrappers) holds tale & party (`party.members.length === 4`), `activeCharacterId` set to first member, first streamed story chunk appears, active selector populated, no party members in `currently_present_npcs`.
1.2 Quickstart with overwrites (H)
  Provide custom adventure blurb + party concept; Expected: Overwrites present in generated tale; all party names reflect concept; requested party size respected even if model suggests fewer.
1.3 Custom tale generation minimal input (H)
  Partial form → Generate → Create Party. Expected: Empty fields auto-filled; campaign state reset; party creation view rehydrates tale fields.
1.4 Randomize all (M)
  Blank form → Randomize All. Expected: Every tale key non-empty; refresh persists via localStorage.
1.5 Campaign entry guard (M)
  Start Campaign only when chapters exist. Expected: Redirect to Campaign Builder; no stale quickstart party leakage.
1.6 Save import (C)
  Import exported save. Expected: Full snapshot applied; story log + party context restored; per-member resources accurate.

### 2. Party Lifecycle
2.1 Manual add/edit (H) – Update stats & description → card reflects changes; ID stable (`player_character_N`).
2.2 Generate full party fallback w/o tale description (M) – Expect error toast, no partial persist, Start Tale disabled.
2.3 Party size cap (H) – Manual add 5th member blocked (button disabled). (Generator may exceed 4 only if explicit future design; currently enforce 4.)
2.4 Delete & re-add (H) – Remove member then add new; Expected: `members` array length consistent; new unique ID assigned at tail; id/name map updated.
2.5 Start Tale gating (C) – Start only once; re-enter route does not duplicate initial state.
2.6 Active member switch (C) – Carousel next/prev updates: active resources panel, suggested actions request (only for new active member), event evaluation legacy mirror state updated.

### 3. Campaign Builder & Chapters
3.1 Generate full campaign (H) – Spinner, all chapters populated, `currentChapter === 1`.
3.2 Single chapter regeneration (M) – Regenerate chapter 2: only that chapter mutates.
3.3 Plot point multi-line NPC editing (M) – Multi-line input splits into array, persists.
3.4 Chapter add/remove/undo (M) – Bounds respected; undo restores previous count & ordering.
3.5 Chapter advance + image prompt sequencing (H) – When story triggers advancement: chapter state updated BEFORE new `image_prompt` generated; prompt uses new chapter theme; excludes future seeds.

### 4. Game Loop Core Actions
4.1 Character action execution (C) – Submit custom action for active member; streamed story chunks accumulate; after completion: CombatAgent stats_update applied; only that member’s suggested actions refreshed.
4.2 Continue the Tale static action (H) – No duplicate triggers; `gameLoop.isStreaming` toggles as expected.
4.3 State command (M) – JSON state update produces merged GameActionState (state-only append) via `mergeUpdatedGameActions`; story log unchanged; undo stack includes diff.
4.4 Story command override/manual narration (M) – Entry flagged manual; persists next tick; no LLM call.
4.5 Undo/redo multi-member (H) – Two actions (different members) → undo twice → redo twice; per-member resources revert/apply correctly; no cross-member bleed.
4.6 Additional story input truncation (L) – Provide >10k chars supplemental text; ensure only last ~10k chars used (if truncation util present) and no crash.
4.7 Truth Oracle simulation persistence (M) – After action invoking simulation, verify appended simulation context appears in subsequent action’s history (not in story text) and doesn’t duplicate.

### 5. Dice & Combat
5.1 Dice modal gating (H) – Action with difficulty requiring roll triggers modal; success/failure path changes stats_update set.
5.2 Manual dice notation (M) – 2d6+1 accepted; log result; no forced narrative branch.
5.3 Dice box fallback (M) – Force visual dice failure to fallback component; action blocked until resolution; graceful dismissal.
5.4 Combat lifecycle (C) – Enter combat via story; while `is_character_in_combat` true: rest/utility actions disabled; exit flagged by AI sets badge off; final story declares resolution.
5.5 NPC multi-action + dead filtering (H) – Multiple NPC actions generated; dead NPCs excluded from subsequent additional story input.
5.6 Multi-target damage (H) – Stats updates sorted per target; party pronoun rendering uses third-person (“Aria gains...”); color mapping correct.
5.7 Random events handling modes (M) – `randomEventsHandling = probability`: simulate seeded Math.random producing/omitting interrupt; `ai_decides`: rely on probability explanation not random.

### 6. Inventory & Items
6.1 Item consumption (H) – Use item; inventory_update remove applied; narrative references effect; resource delta rendered.
6.2 Add item via story (M) – Starting story adds random items; verify `add_item` entries create inventory entries.
6.3 Invalid add (L) – Force inventory_update with missing `item_added`; console error logged; no crash.
6.4 Crafting flow (L) – If crafting prompt invoked: success adds new item & removes ingredients; partial failure retains; failure removes only (per agent schema rules).

### 7. Utility / Rest Mechanics
7.1 Short Rest resource refill (H) – Produces stats_update objects (no direct mutation). Each non-XP resource gained = min(max_value/start_value delta); values capped.
7.2 Long Rest (M) – Full refill using `GameAgent.getRefillResourcesUpdateObject` semantics; XP unchanged.

### 8. Progression & Events
8.1 XP threshold level up (H) – Accept suggested level up: emits `now_level_X` + XP deduction; abilities may update.
8.2 Manual level up override (M) – Reject suggestion, perform manual stat changes; validation prevents empty or net-zero change.
8.3 Abilities learned event (H) – New abilities list excludes duplicates; accept merges and sets confirmation flags false.
8.4 Transformation confirmation gating (H) – Pre-confirmation: character sheet unchanged; image prompt excludes transformation; post-confirmation: character updated + history mention.
8.5 Party-wide event evaluation (C) – Trigger EventAgent party evaluation; ensure per-member `restrained_state_explanation` only when justified; active member legacy state mirrors selected member.
8.6 Restraining state actions (H) – Active member under restraining state: ActionAgent suggestions restricted (no impossible actions); remove state → broader actions appear.

### 9. Targeting & Abilities
9.1 Target modal population (H) – Ability requiring target lists NPCs + party (excluding active duplication); selection passes correct technical ID.
9.2 Ability resource cost enforcement (H) – Attempt action with insufficient resources returns disabled state; sufficient case decrements via stats_update cost path.
9.3 Ability cost normalization (M) – Mixed case resource key in cost resolves to correct resource.

### 10. Persistence & Recovery
10.1 Auto-save after action (C) – Reload preserves: story log, per-member resources, activeCharacterId, per-member cached actions (if design caches) or lazy regenerate.
10.2 Offline failure (H) – Simulate network drop; action fails gracefully, error modal appears, no partial GameActionState applied.
10.3 Export/import mid-combat (H) – Re-import recreates combat flag and pending dice requirements.
10.4 Session resume missing party (M) – Manually clear party keys; navigate Game → redirect/gate without crash.
10.5 localStorage quota failure (L) – Simulate quota error; warning logged; in-memory continuation.

### 11. Settings & Output Controls
11.1 Narration length toggle (M) – Toggle detailed length off; subsequent story <160 words (approx) per configured limit.
11.2 Random events mode toggle (M) – Change mode persists; verify subsequent action behavior.
11.3 System prompts custom injection (H) – Add custom instruction; ensure included in systemInstruction array; clearing restores defaults.
11.4 Imagery toggle (M) – Disable imagery: subsequent GameAgent story sets empty `image_prompt` or UI skips request; enable regenerates.
11.5 TTS toggle (L) – Disable removes playback controls.

### 12. UI/UX & Accessibility
12.1 Mobile layout 375px (M) – Panels stack; action composer accessible; bottom nav visible.
12.2 Keyboard navigation (M) – Tab order logical; ESC closes modals; no trap.
12.3 Screen reader labels (M) – Story entries have ARIA labels; dice results announced.
12.4 Contrast & reduced motion (L) – Resource deltas readable; animations respect reduced motion preference.

### 13. Error & Resilience
13.1 LLM timeout handling (H) – Force timeout; overlay dismissed; error surfaced; no partial state apply.
13.2 Fallback model invocation (M) – Simulate primary model failure; fallback path used; state still valid.
13.3 JSON schema repair (M) – Inject malformed stats_update; jsonFixingInterceptor produces valid structure; silently corrected.
13.4 Party removal during streaming (H) – Delete non-active member mid-stream: unaffected; delete active member mid-stream: stream aborts gracefully, next member auto-selected.
13.5 Invalid GM question / empty input (L) – Validation prevents request.

### 14. Rendering & Presentation
14.1 Stats update rendering (H) – Party pronoun mode uses third-person; colors per resource mapping (`XP` green, `HP` red, etc.).
14.2 Inventory update rendering (M) – Add/remove items produce yellow text entries; unknown type logs debug fallback.
14.3 Merged state-only updates (M) – Two sequential state-only JSON commands merge into last action (no duplicate action entries).

### 15. Image Prompt Generation
15.1 Chapter advance ordering (H) – Confirm chapter increment occurs before new image prompt used.
15.2 Unconfirmed transformations excluded (H) – Image prompt omits not-yet-confirmed character form changes.
15.3 Prompt length & dedupe (M) – Prompt trimmed < ~1500 chars, no duplicated adjective spam.
15.4 Failure fallback (L) – Simulate provider failure → blank prompt; UI hides image seamlessly.

### 16. Security / Data Integrity (Optional Manual)
16.1 No direct resource mutation (H) – Confirm UI rest, level-up, and action flows only change via stats_update → applyGameActionState (spy/assert path).
16.2 No party members in NPC list (C) – Force scenario with similar names; ensure `currently_present_npcs` excludes party.

---
### Outdated / Adjusted Original Scenarios
- Old references to Dexie removed (localStorage now canonical via wrapper).
- Single-character assumptions replaced with per-member validations (undo/redo, action suggestions, event evaluation).
- Rest actions now validated through stats_update objects instead of direct resource mutation.
- Image prompt sequencing added (chapter timing & transformation gating).
- Party event evaluation consolidated (EventAgent party-wide call) – supersedes per-character event evaluation test.

### New Additions Summary
Party evaluation, restraining state handling, simulation/truth oracle persistence, random event probability modes, mergeUpdatedGameActions behavior, pronoun/resource rendering for party, transformation gating, ability cost normalization, fallback model handling, JSON repair, image prompt ordering/constraints.

---
### Automation & Tooling Strategy
LLM Determinism:
  - Provide fixture layer returning canned JSON/story for each agent (GameAgent streaming: supply chunk array + final state).
  - Tag tests requiring streaming with @stream to allow parallelism off when unstable.
Locators:
  - Semantic locators for all elements to validate accessibility aswell.
Network Layer:
  - Intercept LLM fetch; route by request body containing agent discriminator (game|combat|action|event|image|campaign|summary).
Undo/Redo Verification:
  - Snapshot serialized minimal state (story length, per-member resource tuple) before/after operations.
Accessibility:
  - Use axe-core integration in Playwright for a11y assertions on key pages.
Tagging / Prioritization:
  - smoke (C set), regression (H+), extended (M/L), streaming, offline, combat, campaign.
Parallelization:
  - Isolate storage per test via unique localStorage key prefix.
Failure Artifacts:
  - On failure capture story log HTML + current serialized game state JSON.

---
### QA Sign-off Checklist (High-Level)
- [ ] All Critical & High scenarios automated and green.
- [ ] Streaming stability: no orphan overlays beyond timeout threshold.
- [ ] No party member leakage into NPC arrays across 10 randomized runs.
- [ ] Resource mutations only via stats_update path (instrumentation assertions).
- [ ] Image prompts excluded when disabled & safe when failures injected.
- [ ] Level-up and rest flows produce expected stats_update diffs.

---
### Future Enhancements (Not Yet Implemented Tests)
- Initiative / action order modeling when introduced.
- Persistent per-member skill progression UI surfacing & decay rules (if added).
- Multi-round status effect expiry validation.
- Party formation reordering drag & drop (if feature lands).

---