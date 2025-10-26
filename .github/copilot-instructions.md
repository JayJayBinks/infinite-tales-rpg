---
description:
globs:
alwaysApply: true
---

<!-- Condensed & Actionable AI Agent Guide (Do not bloat; keep under ~60 lines) -->

THERE IS NOT SINGLE  CHARACTER MODE ANYMORE, ONLY PARTY MODE. ALWAYS HANDLE MULTIPLE CHARACTERS. REMOVE ANY LEGACY SINGLE-CHARACTER LOGIC.

# Infinite Tales RPG – Copilot Runtime Rules

## 1. Stack & Conventions
SvelteKit 2 / Svelte 5 runes ($state/$derived/$effect). Tailwind + DaisyUI only (no ad‑hoc CSS). TypeScript everywhere. All persistent/global state goes through a localStorage wrapper (see `wrap()` / prior `useLocalStorage`). Mutate via `.value` or wrapped setters—never reassign the wrapper variable.

## 2. Core Flow (Authoritative Data Path)
Player Action → GameAgent (streams story + initial JSON) → (post) CombatAgent adds/normalizes `stats_update` → `gameLogic.applyGameActionState()` mutates ONLY: resources, XP, inventory → Derived UI renders → ActionAgent proposes next actions → EventAgent evaluates per‑member events → optional ImagePromptAgent. Never mutate `playerCharactersGameState` / inventory directly; always funnel through a synthetic `GameActionState` + apply.

## 3. Agents (dir: `src/lib/ai/agents/`)
GameAgent (story + structured state), ActionAgent (options), CombatAgent (derive stat diffs), EventAgent (transformations/abilities/restrain), CharacterAgent / CharacterStatsAgent (descriptions & stats), SummaryAgent (history slicing), CampaignAgent (chapters), ImagePromptAgent (scene prompt). Only GameAgent uses streaming.

## 4. Party Model
Party descriptions: `partyState`; stats: `partyStatsState`; runtime per‑member resources: `playerCharactersGameState[technicalId]` (values are `{max_value,current_value,game_ends_when_zero}`). Party members must NEVER appear in `currently_present_npcs`. UI often reflects the active member; caches per‑member actions/events in mapping states (e.g. `characterActionsByMemberState`).

## 5. Resources, XP, Level
Refill via `refillResourcesFully()` creating proper `stats_update`; don’t preseed `current_value` manually except during initial bootstrap. XP is a pseudo resource (`XP`); level ups emit `now_level_X` and deduct XP. Color/render logic downstream depends on consistent `_gained` / `_lost` suffixes.

## 6. Image Prompt + Chapter
After story stream completes: advance chapter first, then build image prompt with trimmed (~1200–1500 chars) recent story + chapter theme + `general_image_prompt`. Exclude future chapters, dice/meta, or unconfirmed transformations. On failure: leave empty string (no retries). Do NOT describe the player’s character appearance—environment + NPC visuals only.

## 7. Prompt Assembly Rules
System instruction arrays: (a) role & guardrails, (b) minimal serialized slices (`stringifyPretty`), (c) JSON schema string prefixed by `jsonRule`. Keep context narrow—pull related history via SummaryAgent instead of dumping entire logs. Always post‑validate: shape, arrays vs objects, remove hallucinated members/resources/abilities.

## 8. Event / Ability Evaluation
Use `EventAgent.evaluatePartyEvents(recentStoryChunks, partyMembers)` → store per‑member results in mapping; mirror the active member into legacy single-character state for existing modals. Each learned ability or transformation flagged with `showEventConfirmationDialog` + `aiProcessingComplete=false` until user confirms.

## 9. Mutation & Rendering
Only mutate gameplay via: `applyGameActionState()` or `applyGameActionStates()` (batch). Inventory adds/removals appear in `inventory_update`. To introduce a manual effect, fabricate a `GameActionState` with just `stats_update` / `inventory_update` and pass it through apply.

## 10. Error Handling
LLM failures: `console.warn` + graceful early return (never crash UI). Truncate `additionalStoryInput` to last 10k chars. Guard all optional arrays before `Object.values/entries` (recent fix). Fallback models when `returnFallbackProperty` present.

## 11. Testing Discipline
Deterministic logic (resource math, level/XP, render mapping, inventory, dice helpers) should use synthetic `GameActionState`s in unit tests (`vitest`). Full flows & regression: Playwright e2e (Gemini mocked in `e2e/utils/geminiMocks.ts`). Run: `npm run test` (unit+e2e), or `npm run test:unit`, `npm run test:e2e`. Type check: `npm run check`.

## 12. Adding A New Status / Resource (Pattern)
1. Extend stats schema (CharacterStatsAgent output) with `{ max_value, start_value, game_ends_when_zero }`.
2. During initialization ensure per‑member resource object created (bootstrap code in `+page.svelte`).
3. Produce diff via CombatAgent or synthetic action: emit `<resource>_gained|_lost` with positive `value.result`.
4. Allow rendering: no custom color? Provide key so `getColorForStatUpdate` can infer (game_ends_when_zero → red else blue).

## 13. DO / AVOID
DO: Use existing helpers (`refillResourcesFully`, `mergeUpdatedGameActions`, `renderStatUpdates`). AVOID: Direct state mutation, dumping entire history into prompts, inserting party members into NPC lists, inventing schema keys. NEVER: Add meta (dice schema, JSON template) into narrative or image prompt.

## 14. Common Scripts
Dev: `npm run dev` | Typecheck: `npm run check` | Unit: `npm run test:unit` | E2E: `npm run test:e2e` | Lint fix: `npm run lint:fix` | Build: `npm run build`.

## 15. When Unsure
Ask for: exact JSON contract, which state wrapper to use, or where to reset new persisted state (new tale reset page). Keep diffs minimal & localized.

---
Feedback welcome: If a pattern here does not match current implementation, request clarification before introducing divergent logic.


