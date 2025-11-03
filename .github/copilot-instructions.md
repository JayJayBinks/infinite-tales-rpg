---
description:
globs:
alwaysApply: true
---

<!-- Condensed & Actionable AI Agent Guide (Do not bloat; keep under ~60 lines) -->

THERE IS NO SINGLE CHARACTER MODE ANYMORE, ONLY PARTY MODE. ALWAYS HANDLE MULTIPLE CHARACTERS. REMOVE ANY LEGACY SINGLE-CHARACTER LOGIC.

# Infinite Tales RPG – Copilot Guide

## Stack & Style
- SvelteKit 2 with Svelte 5 runes (`$state/$derived/$effect`); import runes from `svelte`.
- TypeScript everywhere; prefer consts and descriptive names; AI types live under `$lib/ai`.
- Tailwind + DaisyUI only; no ad-hoc CSS; event handlers use `onclick`.
- Persisted state flows through rune-backed store classes (`src/lib/state/stores`); mutate via setters/`.value`, never touch raw localStorage.

## Architecture Map
- `src/routes/+page.svelte` renders the shell; delegates AI work to services and UI to `$lib/components`.
- `AIService` (`src/lib/services/AIService.ts`) is the sole entry for Gemini-facing agents.
- `ActionProcessingService` (`src/lib/services/ActionProcessingService.ts`) validates costs, caches per-member actions, and ultimately calls `gameLogic.applyGameActionState`.

## Authoritative Flow
- Player input → `GameAgent` streams story/JSON → `CombatAgent` normalizes `stats_update` → `gameLogic.applyGameActionState()` mutates resources/XP/inventory → UI renders → `ActionAgent` proposes options → `EventAgent` evaluates per-member events → optional `ImagePromptAgent`.
- Never mutate `playerCharactersGameState`, inventory, or NPC maps directly; craft a `GameActionState` and run `applyGameActionState`/`applyGameActionStates`.

## Party System
- `partyState` / `partyStatsState` own member descriptions + stats; runtime resources live in `gameState.progression.playerCharactersGame[technicalId]`.
- Party members must not appear in `currently_present_npcs`; switching members mirrors into legacy stores via `$effect` in `src/routes/game/+page.svelte`.
- Cache per-member actions/events in `characterActionsByMemberState`, `eventEvaluationByMemberState`, etc.; wipe caches with provided setters when state changes.

## Prompt Assembly
- Build system prompts as arrays: guardrails, minimal serialized slices via `stringifyPretty`, and a schema string prefixed with `jsonRule`.
- Use `SummaryAgent` to pull scoped history; trim `additionalStoryInput` to the latest 10k chars.
- Post-validate agent JSON: enforce shapes, drop unknown party members/resources/abilities before applying.

## Chapters & Imagery
- After GameAgent streaming completes, advance the chapter (`CampaignState`) before assembling image prompts.
- Image prompts (~1.2–1.5k chars) combine recent story, chapter theme, and `general_image_prompt`; omit spoilers, dice/meta, and player character appearance. On failure, return an empty string without retrying.

## Resources, XP, Leveling
- Use `refillResourcesFully()` to produce valid `stats_update`; never hand-edit resource objects.
- XP is a pseudo-resource; expect paired `xp_gained` and `now_level_X` events to spend XP automatically.
- UI coloring relies on `_gained/_lost` suffixes and `game_ends_when_zero`; keep keys consistent.

## Testing & Tooling
- Type check: `npm run check`; unit tests: `npm run test:unit`; e2e (Playwright + Gemini mocks in `e2e/utils/geminiMocks.ts`): `npm run test:e2e`; full sweep: `npm run test`.
- Gemini mocks classify prompts into deterministic fixtures; extend `e2e/utils/mocks` when adding agent behaviours.
- Cover deterministic helpers (`gameLogic`, resource math) with vitest before leaning on Playwright for flow regressions.

## Pitfalls & Safeguards
- Guard optional arrays before `Object.values/entries`; prefer early returns with helpful warnings.
- Do not insert party members into NPC lists, mutate localStorage keys ad hoc, or bypass store setters.
- Handle LLM failures with `console.warn` and graceful fallbacks; never crash the UI.

---
Feedback welcome—call out any workflows or patterns that still feel underspecified.


