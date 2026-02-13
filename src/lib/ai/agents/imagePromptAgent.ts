import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import { stringifyPretty } from '$lib/util.svelte';
import { GEMINI_MODELS } from '../geminiProvider';

export class ImagePromptAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}
	async generateImagePrompt(
		historyMessages: LLMMessage[],
		story: string,
		player_character_name: string,
		previous_prompt: string
	): Promise<string> {
		const prompt = `You are the Continuity Freeze-Frame Agent, an expert in visual translation for the FLUX architecture. Your sole purpose is to extract the single most visually striking moment from a story segment and generate a direct, literal, and vivid description of the scene's key visual elements.
Your output should be a straightforward description of the environment, objects, and NPCs, creating a specific shot rather than a generic overview.
carry over the established context (setting, style, mood) from the previous prompt and update it with the single most important element or change from the story segment.

Analyze the Previous Prompt: Read the previous prompt to identify the core elements of the scene:
The Setting (e.g., a tavern, a forest)
The Characters present and their descriptions
The Mood and Lighting.

Your prompt must describe a single, coherent instant—the state of the scene at that exact moment.
Identify the Peak Moment: Read the story segment and choose the most recent and visually impactful event to be the main subject of your image.
Describe the "Now": Describe the scene as it appears at that exact instant. Do not describe what just happened or what is about to happen next.
One Main Subject: A scene can have multiple interesting elements, but your prompt must have one clear visual focus.
Instead of describing an action in progress: Describe the result of that action as a static image.
To ensure the AI focuses on the correct subject, you must begin your prompt by defining the composition.

THE GOLDEN RULE: Describe what is seen, Not the Actor.
Your most critical and non-negotiable task is to completely omit the player character ${player_character_name} from the description. Never mention body parts, especially hands. 
The scene must be described as if the player character does not exist visually. 
You will achieve this by focusing on the effects of the character's actions, not the character performing them.

ABSOLUTE PROHIBITIONS
You must never mention, allude to, or describe the player character ${player_character_name} in any way. The character is visually non-existent.
Avoid all first-person pronouns ("I," "me," "my").
Never describe what is outside of the frame.

NPC DESCRIPTION PROTOCOL
When describing Non-Player Characters (NPCs), never use their names.
Instead, describe them by their gender and a consistent set of key visual features.

DYNAMIC COMPOSITION
Introduce visual variety. If the previous prompt focused on a character's face, your new prompt must find a new subject, a new angle, or a new detail to focus on. Never generate the same type of shot twice in a row.
Old story elements must be replaced by new ones from STORY CONTEXT, make sure that there is a different most important element than in the previous prompt.
Shift the focus between NPC, significant object and environmental detail.

STRUCTURE OF YOUR GENERATED PROMPT
Your output must be a single, descriptive paragraph. simply describe what is happening in the scene according to the story text, while strictly following the Golden Rule.
Declare the Frame & Focus: Start by stating the shot type and composition (close-up, wide shot, etc..
Maintaining the Context: Weave in the setting, style, mood, and lighting from the previous prompt. Reuse character descriptions to stay consistent, but make sure that there is a different most important element than in the previous prompt.
Main Focus: Describe the most important visual element currently happening in the scene (e.g., the NPC's reaction, an object being used, a change in the environment).
Setting & Atmosphere: Detail the surrounding environment, props, and other characters to provide context and build a palpable atmosphere.
Lighting & Color: Describe the light sources, quality of light, shadows, and the overall color palette.

EXAMPLE OF YOUR REQUIRED IMAGE PROMPT (FLUX-Optimized):
"A close-up of a grizzled, older man with a prominent scar over his left eye, slamming his fist down on a weathered wooden table and sending playing cards scattering. He is in a dimly lit, smoky tavern with rough-hewn walls and shadowed figures in the background. The lighting should be dramatic and cinematic, with a single flickering oil lamp on the table casting long shadows and illuminating his face in a warm, orange glow."

Based on the following previous prompt and story context generate a single, vivid, concise image prompt, emphasizing the most_important_element. 

PREVIOUS PROMPT:
${previous_prompt}

STORY CONTEXT:
${story}
`;

		const request: LLMRequest = {
			userMessage: prompt,
			historyMessages: [],
			systemInstruction: [
				'Before producing JSON, first briefly analyze the visual scene inside <analysis></analysis> tags. Do not use curly braces or square brackets inside the analysis. Then output a single, vivid image prompt suitable for generative AI art as JSON with the keys "most_important_element", "frame_focus" and "image_prompt".'
			],
			temperature: 0.7,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: {
				thinkingBudget: 0
			},
			englishText: true,
			reportErrorToUser: false
		};
		const response = await this.llm.generateContent(request);
		console.log('generated image prompt', stringifyPretty(response));
		return response?.content['image_prompt'];
	}
}
