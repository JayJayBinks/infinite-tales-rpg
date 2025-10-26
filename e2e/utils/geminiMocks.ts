import type { Page, Route } from '@playwright/test';
import {
  generateStoryResponse,
  generateCharacterResponse,
  generateCharacterStatsResponse,
  generateCampaignResponse,
  generateGameActionResponse,
  generateActionResponse,
  generateCombatStatsUpdateResponse,
  generateEventResponse,
  generateNPCResponse,
  generateLevelUpResponse,
  generateImagePromptResponse
} from './mocks';

type AgentType =
  | 'storyAgent'
  | 'characterAgent'
  | 'characterStatsAgent'
  | 'gameAgent'
  | 'actionAgent'
  | 'campaignAgent'
  | 'combatAgent'
  | 'eventAgent'
  | 'imagePromptAgent'
  | 'summaryAgent'
  | 'levelUpAgent'
  | 'npcAgent'
  | 'unknown';

function detectAgentType(systemInstruction: string, userMessage: string): AgentType {
  const sys = systemInstruction.toLowerCase();
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('create a new randomized story') || sys.includes('story agent')) return 'storyAgent';
  if (sys.includes('rpg character agent') || sys.includes('character descriptions')) return 'characterAgent';
  if (sys.includes('character stats agent') || sys.includes('generate stats')) return 'characterStatsAgent';
  if (sys.includes('campaign agent') || msg.includes('generate a campaign')) return 'campaignAgent';
  if (sys.includes('combat agent') || sys.includes('stats update agent') || sys.includes('determine stats_update')) return 'combatAgent';
  if (sys.includes('image prompt agent') || msg.includes('generate an image prompt')) return 'imagePromptAgent';
  if (sys.includes('action agent') || msg.includes('suggest specific actions')) return 'actionAgent';
  if (sys.includes('summary agent') || msg.includes('summarize')) return 'summaryAgent';
  if (msg.includes('leveled up') || msg.includes('level up')) return 'levelUpAgent';
  if (msg.includes('generate the following npcs') || sys.includes('npc stats agent')) return 'npcAgent';
  if (sys.includes('game master') || sys.includes('game master agent') || msg.includes('begin the story') || msg.includes('continue the tale')) return 'gameAgent';
  if (sys.includes('you are an rpg event evaluation agent') || msg.includes('evaluate the events') || msg.includes('become restrained')) return 'eventAgent';
  
  return 'unknown';
}

function extractRequestContext(userMessage: string, systemInstruction: string) {
  const context: any = {};
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('custom') || msg.includes('custom adventure blurb')) context.isCustom = true;
  
  const partySizeMatch = userMessage.match(/party of (\d+)|(\d+).*party members?/i);
  if (partySizeMatch) context.partySize = parseInt(partySizeMatch[1] || partySizeMatch[2], 10);
  
  if (msg.includes('combat') || msg.includes('attack') || msg.includes('enemy')) context.isCombat = true;
  if (msg.includes('rest') || msg.includes('recover')) context.isRest = true;
  if (msg.includes('find') && (msg.includes('item') || msg.includes('potion'))) context.isItem = true;
  if (msg.includes('continue the tale') || msg.match(/continue( the)? story/)) context.isContinue = true;
  if (msg.includes('restrained') || msg.includes('become restrained') || msg.includes('magical bonds')) context.isRestrained = true;
  // Detect state-only command by system prompt or explicit placeholder phrasing
  const sys = systemInstruction.toLowerCase();
  if (sys.includes('only apply the mentioned state updates') || sys.includes('state command')) {
    context.isStateCommand = true;
  }
  // Fallback detection for state command generation (generateStateOnlyNoStory):
  // These requests embed the statsUpdatePromptObject directly and do not include typical
  // game master storytelling markers. The distinguishing constant fragment is the
  // guidance comment from statsUpdatePromptObject: "You must include one update for each ACTIVE action".
  // We treat such a request as a state command ONLY when it is not a normal story continuation/combat
  // (no continue/combat keywords) and the user message indicates a direct resource modification.
  if (!context.isStateCommand &&
      sys.includes('one update for each active action') &&
      !context.isContinue &&
      !context.isCombat) {
    const lowerMsg = msg;
    if (/\b(gain|lose|lost|heal|healed|restore|restored)\b/.test(lowerMsg) && /\bhp\b/.test(lowerMsg)) {
      context.isStateCommand = true;
    }
  }
  
  const chapterMatch = userMessage.match(/chapter (\d+)/i);
  if (chapterMatch) context.chapterNumber = parseInt(chapterMatch[1], 10);
  
  context.userMessage = userMessage;
  context.systemInstruction = systemInstruction;
  
  return context;
}

export function generateMockResponse(agentType: AgentType, context: any): any {
  switch (agentType) {
    case 'storyAgent': return generateStoryResponse(context);
    case 'characterAgent': return generateCharacterResponse(context);
    case 'characterStatsAgent': return generateCharacterStatsResponse(context);
    case 'campaignAgent': return generateCampaignResponse(context);
    case 'gameAgent': return generateGameActionResponse(context);
    case 'actionAgent': return generateActionResponse(context);
    case 'combatAgent': return generateCombatStatsUpdateResponse(context);
    case 'eventAgent': return generateEventResponse(context);
    case 'imagePromptAgent': return generateImagePromptResponse(context);
    case 'levelUpAgent': return generateLevelUpResponse(context);
    case 'npcAgent': return generateNPCResponse(context);
    case 'summaryAgent': return { story: 'A summary of recent events in the adventure.' };
    default: return { message: 'Mock response for unknown agent type' };
  }
}

export async function installGeminiApiMocks(page: Page) {
  await page.addInitScript(() => { (window as any).__isE2ETest = true; });
  
  const geminiRegex = /https:\/\/generativelanguage\.googleapis\.com\/.*$/;

  await page.route(geminiRegex, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    if (method !== 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Mock non-POST Gemini call' }) });
    }

    let endpoint: 'countTokens' | 'generateContent' | 'other' = 'other';
    if (url.includes(':countTokens')) endpoint = 'countTokens';
    else if (url.includes(':generateContent')) endpoint = 'generateContent';

    try {
      const postData = safePostDataJSON(route);
      const systemInstruction = Array.isArray(postData?.systemInstruction?.parts)
        ? postData.systemInstruction.parts.map((p: any) => p.text).join('\n')
        : postData?.systemInstruction?.parts?.[0]?.text || '';
      const contents = postData?.contents || [];
      const lastContent = contents[contents.length - 1];
      const userMessage = lastContent?.parts?.[0]?.text || '';

      const agentType = detectAgentType(systemInstruction, userMessage);
      const ctx = extractRequestContext(userMessage, systemInstruction);
      console.log(`[Gemini Mock] Detected agentType=${agentType} for systemInstruction="${systemInstruction}..." and userMessage="${userMessage.substring(0, 50)}..."`);

      let bodyPayload: any;
      if (endpoint === 'countTokens') {
        bodyPayload = { totalTokens: 100 };
      } else if (endpoint === 'generateContent') {
        const mockData = generateMockResponse(agentType, ctx);
        bodyPayload = {
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockData) }], role: 'model' }, finishReason: 'STOP', index: 0 }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30, totalTokenCount: 80 }
        };
      } else {
        bodyPayload = { message: 'Unhandled Gemini endpoint mocked generically.' };
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bodyPayload) });
    } catch (e) {
      console.error('[Gemini Mock] Handler error', e);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{\"message\":\"fallback\"}' }], role: 'model' } }] }) });
    }
  });

  await page.route(/https:\/\/image\.pollinations\.ai\/.*/, async (route: Route) => {
    const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
  });
}

function safePostDataJSON(route: Route): any | undefined {
  try {
    if (route.request().method() === 'POST') return route.request().postDataJSON();
  } catch (e) {
    console.warn('[Gemini Mock] Could not parse postDataJSON()', e);
  }
  return undefined;
}
