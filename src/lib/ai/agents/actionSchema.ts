import { ActionDifficulty } from '../../../routes/game/gameLogic';
import type { LLMResponseJsonSchema } from '$lib/ai/llm';

const actionTypes = [
	'Misc',
	'Attack',
	'Spell',
	'Conversation',
	'Social_Manipulation',
	'Investigation',
	'Travel',
	'Crafting'
];
const interruptProbabilityValues = ['NEVER', 'LOW', 'MEDIUM', 'HIGH', 'ALWAYS'];

function reasonedEnumSchema(values: string[], maxLength = 80) {
	return {
		type: 'object',
		additionalProperties: false,
		required: ['reasoning', 'enum_english'],
		properties: {
			reasoning: { type: 'string', maxLength },
			enum_english: { type: 'string', enum: values }
		}
	};
}

export function buildLocalActionJsonSchema(options: {
	attributes: string[];
	skills: string[];
	newSkillsAllowed: boolean;
	array?: boolean;
}): LLMResponseJsonSchema {
	const attributeSchema =
		options.attributes.length > 0
			? { type: 'string', enum: options.attributes }
			: { type: 'string', maxLength: 80 };
	const existingSkillSchema =
		options.skills.length > 0
			? { type: 'string', enum: options.skills }
			: { type: 'string', maxLength: 80 };
	const actionSchema = {
		type: 'object',
		additionalProperties: false,
		required: [
			'characterName',
			'plausibility',
			'text',
			'type',
			'related_attribute',
			'existing_related_skill_explanation',
			'related_skill',
			'difficulty_explanation',
			'action_difficulty',
			'is_possible',
			'resource_cost',
			'narration_details',
			'actionSideEffects',
			'enemyEncounterExplanation',
			'is_interruptible',
			'dice_roll'
		],
		properties: {
			characterName: { type: 'string', maxLength: 80 },
			plausibility: { type: 'string', maxLength: 120 },
			text: { type: 'string', maxLength: 160 },
			type: { type: 'string', enum: actionTypes },
			related_attribute: attributeSchema,
			existing_related_skill_explanation: { type: 'string', maxLength: 120 },
			related_skill: options.newSkillsAllowed
				? { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] }
				: { anyOf: [existingSkillSchema, { type: 'null' }] },
			difficulty_explanation: { type: 'string', maxLength: 140 },
			action_difficulty: { type: 'string', enum: Object.keys(ActionDifficulty) },
			is_possible: { type: 'boolean' },
			resource_cost: {
				anyOf: [
					{ type: 'null' },
					{
						type: 'object',
						additionalProperties: false,
						required: ['resource_key', 'cost'],
						properties: {
							resource_key: { type: 'string', maxLength: 80 },
							cost: { type: 'number' }
						}
					}
				]
			},
			narration_details: reasonedEnumSchema(['LOW', 'MEDIUM', 'HIGH']),
			actionSideEffects: { type: 'string', maxLength: 140 },
			enemyEncounterExplanation: reasonedEnumSchema(['LOW', 'MEDIUM', 'HIGH']),
			is_interruptible: reasonedEnumSchema(interruptProbabilityValues),
			dice_roll: {
				type: 'object',
				additionalProperties: false,
				required: ['modifier_explanation', 'modifier', 'modifier_value'],
				properties: {
					modifier_explanation: { type: 'string', maxLength: 120 },
					modifier: { type: 'string', enum: ['none', 'bonus', 'malus'] },
					modifier_value: { type: 'number', minimum: -2, maximum: 2 }
				}
			}
		}
	};

	return {
		name: options.array ? 'local_action_list' : 'local_single_action',
		strict: true,
		schema: options.array
			? {
					type: 'object',
					additionalProperties: false,
					required: ['actions'],
					properties: {
						actions: {
							type: 'array',
							minItems: 3,
							maxItems: 3,
							items: actionSchema
						}
					}
				}
			: actionSchema
	};
}
