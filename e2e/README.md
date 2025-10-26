# Infinite Tales RPG - E2E Test Suite

This directory contains end-to-end tests for Infinite Tales RPG, implemented with Playwright.

## Overview

The test suite covers all critical and high-priority game flows from `TESTPLAN.md`, organized into feature-specific test files.

## Test Files

### 01-onboarding.spec.ts
**Tale Creation & Setup**
- ✅ Quickstart happy path (party creation, tale start)
- ✅ Quickstart with custom overwrites
- ✅ Custom tale generation with minimal input
- ✅ Randomize all fields
- ✅ Save import/export

### 02-party-lifecycle.spec.ts
**Party Management**
- ✅ Manual add/edit party members
- ✅ Party size cap (max 4 members)
- ✅ Delete & re-add party members
- ✅ Active member switching

### 03-campaign.spec.ts
**Campaign & Chapters**
- ✅ Full campaign generation
- ✅ Single chapter regeneration
- ✅ Chapter advance + image prompt sequencing

### 04-game-loop.spec.ts
**Core Game Actions**
- ✅ Character action execution (streaming story + stats)
- ✅ Continue the Tale static action
- ✅ Undo/redo multi-member
- ✅ State command (JSON state update)

### 05-combat-inventory-rest.spec.ts
**Combat, Items & Rest**
- ✅ Combat lifecycle (enter/exit)
- ✅ NPC multi-action handling
- ✅ Multi-target damage
- ✅ Item consumption
- ✅ Add item via story
- ✅ Short Rest resource refill
- ✅ Long Rest full refill

### 08-progression-events.spec.ts
**Character Progression & Events**
- ✅ XP threshold level up
- ✅ Abilities learned event
- ✅ Transformation confirmation gating
- ✅ Party-wide event evaluation
- ✅ Restraining state actions
- ✅ Auto-save after action
- ✅ Export/import mid-combat

### 09-targeting-validation.spec.ts
**Abilities & Data Integrity**
- ✅ Target modal population
- ✅ Ability resource cost enforcement
- ✅ Ability cost normalization
- ✅ No direct resource mutation
- ✅ No party members in NPC list

## Running Tests

### Prerequisites
```bash
npm install
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npx playwright test e2e/01-onboarding.spec.ts
```

### Run in Headed Mode (with browser UI)
```bash
npx playwright test --headed
```

### Run with Debug
```bash
npx playwright test --debug
```

## Test Infrastructure

### Mocking Strategy
All Gemini API calls are mocked using `utils/geminiMocks.ts`:
- Intercepts `generativelanguage.googleapis.com` requests
- Returns deterministic responses based on prompt content
- Supports all agent types (GameAgent, CharacterAgent, CombatAgent, etc.)
- No actual API key needed for testing

### Helper Utilities (`utils/testHelpers.ts`)
Common operations:
- `setupApiKey()` - Set mock API key
- `quickstartWithParty()` - Quick tale setup with party
- `clearGameState()` - Reset localStorage
- `getLocalStorageItem()` / `setLocalStorageItem()` - State inspection
- `executeAction()` - Submit character actions
- `switchPartyMember()` - Change active character
- `waitForModal()` - Modal interaction helpers
- And more...

### Configuration (`playwright.config.ts`)
- Uses system chromium browser
- Runs preview server on port 4173
- 60s timeout per test
- Web server starts automatically

## Mock Response Types

The mock system supports these response types:
- **tale** - Story/tale generation
- **party** - Party character descriptions
- **party-stats** - Party member stats
- **campaign** - Campaign with chapters
- **game-action** - Standard action responses
- **combat-start/end** - Combat state changes
- **item-add/use** - Inventory management
- **rest** - Resource recovery
- **level-up** - Character progression
- **abilities-learned** - New ability acquisition
- **character-transform-description/stats** - Transformations
- **image-prompt** - Scene image generation

## Writing New Tests

1. Import test utilities:
```typescript
import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import { setupApiKey, quickstartWithParty, clearGameState } from './utils/testHelpers';
```

2. Set up test hooks:
```typescript
test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('my test case', async ({ page }) => {
    await quickstartWithParty(page);
    // ... test logic
  });
});
```

3. Access localStorage state:
```typescript
const storyState = await getLocalStorageItem(page, 'storyState');
expect(storyState).toBeTruthy();
```

## Debugging Tips

### View Test Output
```bash
npx playwright test --reporter=list
```

### Generate Test Report
```bash
npx playwright test --reporter=html
npx playwright show-report
```

### Trace Viewer
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Common Issues

**localStorage not accessible:**
- Ensure `clearGameState()` navigates to app first
- Tests must visit a page before accessing localStorage

**Timeouts:**
- Increase timeout in test: `test.setTimeout(120000)`
- Or in config: `timeout: 120000`

**Mocks not working:**
- Verify `installGeminiApiMocks()` is called in `beforeEach`
- Check console for "classified as:" logs to see mock routing

**Elements not found:**
- Use `page.pause()` to inspect the page
- Check if element selectors match actual UI
- Verify page has loaded: `await page.waitForTimeout(1000)`

## Coverage

This test suite implements:
- **40+ test cases**
- **All 8 Critical priority tests** from TESTPLAN.md
- **All 22 High priority tests** from TESTPLAN.md
- **6 selected Medium priority tests**

For the complete test plan, see `/e2e/TESTPLAN.md`.
