Onboarding & Tale Setup:

Quickstart happy path: Save a valid Gemini key, launch Quickstart from Settings, request a four-hero party, accept the generated tale, land on Game page; Expected: Dexie stores tale + four-character party, session.isPartyLoaded true, first story entry renders with active character selector populated.
Quickstart overwrite inputs: Provide custom adventure blurb + party concept before hitting Generate Idea, then Start; Expected: Returned tale honors overwrites, party names align with concept, expected party size respected even when AI suggests fewer slots.
Custom tale generation: From /custom-tale fill subset of fields, run Generate, verify empty inputs auto-filled, press Create Party; Expected: Tale persisted, campaign state reset, navigation to party creator retains tale fields.
Randomize all tale fields: Use Randomize All with blank form; Expected: Each tale key gains non-empty value, loader shows, subsequent page refresh keeps same tale via Dexie.
Campaign entry point: On Settings choose Start Campaign when chapters exist; Expected: Redirect to Campaign Builder with hydrated data, tale preview updates live, no stale quickstart party.
Save import: Import previously exported save JSON; Expected: Dexie snapshot applied, auto reload shows existing tale/party, story log resumes with historical entries intact.
Party Lifecycle:

Manual character add/edit: Add New Character, adjust stats in editor, save; Expected: Party list shows updated card, ID stable, party remains ordered, mobile layout keeps cards centered.
Generated full party fallback: Trigger Generate Full Party without tale description; Expected: AI errors surface via error toast, no partial party persisted, Start Tale stays disabled.
Party size guardrails: Attempt to add fifth manual member; Expected: Add button disabled at four, quickstart scenarios honored for >4 via generator.
Delete & re-add: Remove a character then Add New Character again; Expected: Dexie party array updates, vacated slot replaced with new UUID, story start uses latest roster.
Start Tale gating: With non-empty party press Start Tale; Expected: Loader modal appears, gameLoop.isStarting true, Game page auto-starts tale exactly once even on route re-entry.
Campaign Builder & Chapters:

Campaign AI generation: Fill overwrites, click Generate Campaign; Expected: Spinner covers UI, all chapters populated, current chapter set to 1, tale synced via overwriteTaleWithCampaignSettings.
Single chapter regen: Edit chapter 2 objective, regenerate; Expected: Only targeted chapter mutates, others untouched, overwrites persistence maintained after reload.
Plot point editing: For a chapter edit important NPCs multiline; Expected: Input parsed into array, UI reinflates as separate lines, tale preview reflects change.
New chapter lifecycle: Add chapter, remove same chapter, undo; Expected: Chapter count updates, currentChapterState obeys bounds, tale diff re-applied correctly.
Game Loop Core Actions:

Character action execution: Select character A, submit custom action, wait for stream; Expected: Story log appends rendered HTML, resources updated per response, suggested actions queue refreshed for that character only.
Continue the Tale: Use Static Action “Continue”, ensure no duplicate triggers; Expected: Auto narrative chunk added, gameLoop.isStreaming toggles appropriately, multi-character queue unaffected.
State command: Switch receiver to State Command, send JSON update; Expected: Story log unchanged, state-only toast shows, undo stack tracks change.
Story command override: Submit Story Command to insert GM narration; Expected: Story log adds entry flagged as manual, no AI call, Dexie persist on next tick.
Undo/redo chain: Execute two actions with different actors, invoke undo twice then redo; Expected: Story log and resources revert/restore per snapshot, action availability recalculated for each character.
Character switching: Navigate party carousel via next/prev; Expected: Active resources panel updates, actions list fetched on demand, suppressed auto-generation respected.
Dice & Combat Interactions:

Auto dice modal: Trigger action requiring roll, accept roll with mocked dice result; Expected: Dice modal shows target threshold, resolves to success/failure path, resulting story references outcome and adjusts stats.
Manual dice composer: Use Dice Roll receiver with notation 2d6+1; Expected: SimpleDiceRoller animates, log captures result, no narrative change.
Dice box fallback: Force dice box load failure; Expected: Graceful fallback to simple roller, action blocked until result provided, overlay dismissed cleanly.
Combat state transitions: Enter combat via AI response, perform actions until AI flags combat end; Expected: Combat badge toggles, rest buttons disabled during combat, final log declares combat resolved.
Modals & Aux Interactions:

GM question flow: Open GM Question modal, submit query, receive structured answer; Expected: Answer card shows rules applied, pendingActionAdditions cleared, party context unaffected.
Suggested actions: Open suggestions for character, wait for AI; Expected: Modal lists actions with resource costs, selecting one triggers progress flow, closing resets suggestion state.
Inventory management: Launch Inventory modal, inspect items, use item when available; Expected: Item consumption updates inventory and story, resource changes appear with deltas.
Use items modal gating: Attempt to use item with zero quantity; Expected: Action disabled, modal displays feedback, no API call.
Target selection: Invoke ability requiring target; Expected: Target modal lists NPCs + party, chosen target passed to agent, story references target technical ID mapping to display name.
Utility modal: Open short rest from Utility, confirm; Expected: Rest action queued with correct descriptive text, resources regenerate per rules, multi-character unaffected.
Progression & Events:

Level up via XP threshold: Accumulate XP to reach cost, open Level Up modal, accept suggestion; Expected: Modal displays XP cost, applying suggestion updates stats + abilities, XP deducted.
Manual level up: Reject suggestion, use manual controls; Expected: Manual panel opens, submitting updates resources and level fields, validation prevents empty changes.
Abilities learned event: Simulate AI awarding ability; Expected: Abilities modal lists new abilities with resource costs, accept adds to character, duplicates filtered.
Transformation confirmation: Receive character_changed event, confirm; Expected: Character sheet updates via applyCharacterChange, modal closes, history mentions new form.
Persistence & Recovery:

Auto-save after action: Perform action, reload app; Expected: Story log and resources restored, active character index preserved, pending overlays cleared.
Partial offline mode: Disconnect network before next action; Expected: Action fails gracefully, error modal shows, no corrupted story log.
Export + re-import regression: Export save mid-combat, re-import; Expected: Combat state resumes correctly, pending dice preserved or cleared per design.
Session resume without party: Clear Dexie party manually, visit Game page; Expected: Redirect to party creation or blocking message, no crash.
Settings & Output Controls:

Game settings modal: Adjust narration length, save; Expected: Confirmation feedback, subsequent AI calls use new parameter (verified via mocked request payload).
AI game settings: Toggle fallback chain, inject temperature; Expected: Settings persisted, subsequent provideLLM uses overrides.
System prompts editing: Add custom prompt, ensure clearing resets to defaults; Expected: Stored via Dexie, future agent calls include injection, reset button clears.
Output features toggles: Enable/disable imagery or TTS, verify impact on Game page controls; Expected: Buttons appear/disappear, settings stored.
UI/UX & Accessibility:

Mobile viewport layout: Run Game page at 375px; Expected: Bottom nav visible, panels stacked, story legible, modals centered.
Keyboard navigation: Tab through ActionComposer and modals; Expected: Focus order logical, ESC closes dialog, no trap.
Screen reader semantics: Inspect ARIA landmarks on Game page; Expected: Story entries labeled, buttons have accessible names, dice results announced.
Color contrast & status cues: Verify alerts, badges, resource deltas meet contrast guidelines, animations respect reduced motion.
Error & Resilience:

LLM timeout: Force agent timeout; Expected: Loading overlay hides, error modal surfaces with retry guidance, state rolls back.
Dexie failure: Simulate quota exceeded on save; Expected: Warning surfaced, fallback in-memory state continues, tests assert graceful degradation.
Invalid input rejection: Submit empty GM question or malformed state command; Expected: Validation messaging, no API call.
Party removal edge case: Delete active character during pending action; Expected: Action cancels, UI selects next character, no orphaned state.
Next steps: 1) Define deterministic LLM fixtures for Playwright to keep scenarios repeatable. 2) Prioritize automation order based on flakiness risk (game loop, inventory, campaign). 3) Align QA sign-off checklist with this plan to ensure nothing regresses before release.