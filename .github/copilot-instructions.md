---
description:
globs:
alwaysApply: true
---

<!-- Updated AI / Copilot Instructions: Project-Specific Engineering Guide -->

# Infinite Tales RPG – AI Coding Agent Guide

Concise, opinionated rules so an AI can contribute productively without rediscovering architecture. Keep answers ACTIONABLE, project‑specific, and use existing patterns.

## Tech + Framework Essentials
SvelteKit 2 / Svelte 5 with runes ($state, $derived, $effect). Tailwind + DaisyUI (no ad‑hoc CSS unless unavoidable). TypeScript everywhere. Vite build.

## Core Game Architecture (Data Flow)
Player Action -> GameAgent (story + structured JSON) -> gameActionsState[] -> CombatAgent (post story stats_update) -> gameLogic.applyGameActionState (mutates resources, XP, inventory) -> UI renders via derived runes.
AI Sub‑agents live in `src/lib/ai/agents/`: 
- GameAgent: primary story progression & JSON game state.
- ActionAgent: proposes next actions; single vs batch.
- CombatAgent: derives stats_update after narration (post-processing).
- EventAgent: detects transformations & new abilities (now party‑aware).
- CharacterAgent / CharacterStatsAgent: descriptions + stats & level-ups.
- SummaryAgent: history condensation.
- CampaignAgent: chapter progression.
- ImagePromptAgent: scene image prompt.

## Party System Principles
- Party state: `partyState` (descriptions) & `partyStatsState` (stats) plus per-member resources in `playerCharactersGameState` keyed by technical id (e.g. player_character_1).
- Active character drives immediate UI; per-member caches: actions (`characterActionsByMemberState`), event evaluations (`eventEvaluationByMemberState`), combat selections, skill progression.
- Never treat party members as NPCs; they are excluded from `currently_present_npcs`.

## Persistent State Pattern
All global/persistent game state uses `useLocalStorage<T>(key, initial)` wrappers; mutate through `.value`; when switching members, load that member’s slice into the single-character compatibility state (e.g. `eventEvaluationState`).

When introducing new state make sure to reset it at new tale at src\routes\game\settings\ai\+page.svelte !

## Stats & Resources
- Resources structure: { max_value, start_value, current_value?, game_ends_when_zero } -> runtime state adds current_value under `playerCharactersGameState`.
- Refill logic: use `refillResourcesFully()` – don’t pre‑mutate playerCharactersGameState manually; let helper produce stats_update diff.
- XP: always on a pseudo resource `XP`; level ups produce `now_level_X` stats_update & deduct XP.

## Applying Updates
- Only authoritative mutation path for combat/story changes: `gameLogic.applyGameActionState` (or its batch variant). Don’t hand-edit resources elsewhere; instead generate a synthetic GameActionState if needed.

## Event & Ability Evaluation
Use new `EventAgent.evaluatePartyEvents` passing recent story slices + per-member known abilities; store per-member evaluations; reflect active member into legacy single view to keep existing modals working.

## Prompt / LLM Interaction Conventions
- Every agent builds a systemInstruction array: high‑level role, contextual state snapshots (stringifyPretty), then a JSON schema prefixed by `jsonRule`.
- Streaming only for GameAgent story (generateContentStream with chunk callbacks); others synchronous.
- Always guard model outputs: array vs object vs null; map & normalize (e.g., ensure ability resource_cost shape).

## UI Conventions
- Use semantic buttons with Tailwind + DaisyUI; long action lists injected dynamically (see addActionButton).
- Keep transformations & abilities confirmation modal gating via flags: `showEventConfirmationDialog`, `aiProcessingComplete`.

## Error / Resilience Patterns
- LLM failures -> console.warn + early return (do not crash UI). Use fallback model when `returnFallbackProperty` provided.
- Large additionalStoryInput truncated to last 10k chars to protect prompt size.

## Adding New Agent Logic
1. Define data contract (JSON schema string) + run through `jsonRule`.
2. Provide minimal, explicit context slices (avoid dumping whole history—use SummaryAgent for trimming).
3. Post-validate: strip unknown members/resources, no hallucinated keys.
4. Route side effects ONLY through gameActionsState or dedicated per-member mapping state.

## Testing Focus Areas
- Deterministic post-processors (mappers, resource math, level logic) are testable without LLM.
- Favor constructing synthetic `GameActionState` objects in tests for edge cases (multi-target damage, resource depletion, party wipe conditions).

## Common Pitfalls to Avoid
- Don’t mix party members into NPC arrays.
- Don’t mutate playerCharactersGameState shape (must stay ResourcesWithCurrentValue objects).
- Don’t bypass applyGameActionState for resource/XP changes.
- Don’t assume single character mode; every new feature must degrade gracefully to solo play.

## Example: Adding a Party-Wide Status Effect
1. Detect in story via CombatAgent extension (new status keyword).
2. Emit one stats_update per affected member (no grouped names).
3. Apply through applyGameActionState (color coding derives automatically in rendering).

## Svelte 5 Runes Basics (Project Use)
Use $state for mutable local store, $derived for computed, $effect for side effects; import from 'svelte'. Event handlers are plain DOM attributes (onclick=...). No legacy `on:` directives.

---
Need clarification or missing pattern? Ask for: data contract (JSON shape), prompt inclusion rules, or state persistence key naming.

## Image Prompt & Campaign Chapter Interaction
Flow:
1. Story streaming completes (use the final concatenated story text; ignore partial chunks).
2. Run chapter advancement check (`advanceChapterIfApplicable`). If the chapter changes, commit new chapter state BEFORE building the image prompt.
3. Build image prompt with: (a) trimmed recent story slice, (b) current chapter theme + active GM notes, (c) optional persistent general image style (`storyState.general_image_prompt`).
4. Call `ImagePromptAgent` (non‑streaming) in parallel with stats update generation.

Guardrails:
- Never include future (not yet advanced) chapter seeds, dice roll mechanics, JSON schemas, or unconfirmed transformation/ability scaffolding.
- Truncate story context for the prompt (target ~1200–1500 chars) to keep salient visual cues and protect token budget.
- Deduplicate repeated adjectives; keep one canonical character name + 1–2 distinctive traits per party member (no long bios).
- If multiple events (e.g., transformation + chapter advance) occur, use the POST‑advance chapter but exclude unconfirmed character form changes until confirmed.

Error Handling:
- On image prompt failure, leave `image_prompt` empty; UI should gracefully omit image.
- Do not auto‑retry more than once; allow manual user regeneration if added later.

Why it matters:
- Prevents visual drift or spoilers from future chapters.
- Preserves model tokens for narrative quality.
- Keeps prompts stable and non‑hallucinatory by banning meta / system artifacts.


