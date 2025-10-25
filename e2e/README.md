# E2E Test Suite

This directory contains end-to-end (E2E) tests for the Infinite Tales RPG application, implemented using Playwright. These tests are based on the comprehensive test plan documented in `TESTPLAN.md`.

## Test Coverage

### Implemented Test Files

1. **quickstart.spec.ts** - Onboarding & Tale Setup
   - Quickstart happy path: Save API key, generate party, start tale
   - Custom overwrites for adventure and party concepts
   - API key validation

2. **party.spec.ts** - Party Lifecycle
   - Manual character creation, editing, and saving
   - Party size validation (max 4 characters)
   - Character deletion and re-addition
   - Start Tale gating (requires non-empty party)

3. **campaign.spec.ts** - Campaign Builder & Chapters
   - AI-powered campaign generation
   - Single chapter regeneration
   - Plot point and NPC editing
   - Chapter lifecycle (add/remove/undo)

4. **game.spec.ts** - Game Loop Core Actions & Dice/Combat
   - Character action execution with AI response
   - "Continue the Tale" static action
   - Character switching in party carousel
   - Undo/redo functionality
   - Manual dice rolling with notation
   - Combat state detection

5. **import-export.spec.ts** - Persistence & Recovery
   - Export save game to JSON
   - Import save from JSON file
   - Auto-save persistence across page reloads
   - Session resume validation
   - Clear data functionality

6. **modals.spec.ts** - Modals & Auxiliary Interactions
   - GM Question modal workflow
   - Suggested actions generation
   - Inventory management
   - Utility actions (rest, recovery)
   - Modal keyboard navigation (ESC to close)
   - Level up progression
   - New abilities confirmation

7. **ui-ux.spec.ts** - UI/UX & Accessibility
   - Mobile viewport layout (375px width)
   - Keyboard navigation and focus management
   - ARIA landmarks and semantic HTML
   - Button accessible names
   - Color contrast verification
   - Responsive layout across breakpoints
   - Bottom navigation functionality
   - Loading and error states
   - Game settings configuration
   - AI settings and output toggles

8. **settings.spec.ts** - Settings Page (existing)
   - API key entry and validation
   - Settings persistence

9. **daisyui.spec.ts** - Theme Integration (existing)
   - DaisyUI theme application

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium --with-deps
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/quickstart.spec.ts
```

### Run in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run with Debug Mode

```bash
npx playwright test --debug
```

## Test Configuration

- **Browser**: Chromium (mobile Chrome viewport - Pixel 5)
- **Base URL**: `http://localhost:5173` (default Vite dev server)
- **Retries**: 2 retries in CI, 0 locally
- **Workers**: 1 in CI, parallel locally

Configuration can be found in `playwright.config.ts`.

## Mock Infrastructure

### Gemini API Mocks

The tests use deterministic mock responses for the Gemini AI API to ensure consistent, fast, and reliable test execution. Mock implementation is in `e2e/utils/geminiMocks.ts`.

Mock responses include:
- Tale generation (default and custom)
- Party generation (4 heroes)
- Character stats
- Game actions and narration
- Level up suggestions
- NPC generation
- Abilities

## Test Patterns

### Common Test Structure

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await installGeminiApiMocks(page);
    await page.goto('/game/settings');
  });

  test('specific scenario', async ({ page }) => {
    // Test implementation
  });
});
```

### Accessibility-First Selectors

Tests prioritize accessible selectors in this order:
1. `getByRole()` - Most semantic (buttons, links, headings)
2. `getByLabel()` - For form inputs
3. `getByText()` - For visible text content
4. `locator()` with data-testid or class names - Last resort

### Graceful Degradation

Tests are designed to handle features that may not be fully implemented:
- Use `.isVisible().catch(() => false)` for optional elements
- Skip portions that aren't available
- Focus on testing what exists rather than failing on missing features

## Mapping to TESTPLAN.md

| TESTPLAN Section | Test File | Coverage |
|-----------------|-----------|----------|
| Onboarding & Tale Setup | quickstart.spec.ts | Lines 1-8 |
| Party Lifecycle | party.spec.ts | Lines 9-15 |
| Campaign Builder & Chapters | campaign.spec.ts | Lines 16-21 |
| Game Loop Core Actions | game.spec.ts | Lines 22-29 |
| Dice & Combat Interactions | game.spec.ts | Lines 30-35 |
| Modals & Aux Interactions | modals.spec.ts | Lines 36-43 |
| Progression & Events | modals.spec.ts | Lines 44-49 |
| Persistence & Recovery | import-export.spec.ts | Lines 50-55 |
| Settings & Output Controls | ui-ux.spec.ts | Lines 56-61 |
| UI/UX & Accessibility | ui-ux.spec.ts | Lines 62-67 |
| Error & Resilience | Partial coverage across all files |

## Future Enhancements

Based on TESTPLAN.md, additional test scenarios to consider:

1. **Randomize tale fields** - Test "Randomize All" functionality
2. **Generated party fallback** - Error handling when generation fails
3. **State command** - JSON state updates without narrative
4. **Story command** - Manual GM narration insertion
5. **Auto dice modal** - Dice roll requirements during actions
6. **Target selection** - Ability targeting for NPCs and party members
7. **LLM timeout** - Error handling for API timeouts
8. **Invalid input rejection** - Form validation edge cases
9. **Network offline mode** - Graceful degradation without connectivity

## Contributing

When adding new tests:
1. Follow existing patterns and naming conventions
2. Use accessible selectors (`getByRole`, `getByLabel`)
3. Install mocks with `installGeminiApiMocks(page)`
4. Handle optional features gracefully
5. Add appropriate waits for async operations
6. Document complex test scenarios
7. Ensure tests pass linting: `npm run lint`

## Troubleshooting

### Tests fail with "No party created" error
This is expected on the home page (`/`). Tests navigate to Settings first to set up API keys and create parties.

### Timeouts on CI
The configuration includes 2 retries in CI mode. Increase timeout values if tests are consistently flaky.

### Browser not installed
Run: `npx playwright install chromium --with-deps`

### Port 5173 already in use
Ensure the dev server is running: `npm run dev`
Or update `baseURL` in `playwright.config.ts` if using a different port.
