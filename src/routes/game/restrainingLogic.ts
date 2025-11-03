import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { Party } from '$lib/types/party';
import { getCharacterTechnicalId } from './characterLogic';

/**
 * Returns the active character's current restraining state explanation (per-member),
 * falling back to the legacy single-field value on the latest GameActionState for backward compatibility.
 *
 * Priority:
 * 1. Per-member map value (restrainedExplanationByMemberState[activeId]) if present (even if empty string)
 * 2. Legacy gameActionState.is_character_restrained_explanation
 * 3. undefined
 */
export function getActiveRestrainingState(
  party: Party | undefined,
  playerCharactersIdToNamesMap: Record<string, string[]>,
  currentCharacterName: string,
  restrainedExplanationByMember: Record<string, string | null>,
  currentGameActionState: GameActionState
): string | undefined {
  let activeId: string | undefined;
  if (party && party.members && party.members.length > 0) {
    activeId = party.activeCharacterId;
  } else {
    activeId = getCharacterTechnicalId(playerCharactersIdToNamesMap, currentCharacterName);
  }
  if (activeId) {
    // Only treat as "set" if the key exists in the map
    if (Object.prototype.hasOwnProperty.call(restrainedExplanationByMember, activeId)) {
      const perMember = restrainedExplanationByMember[activeId];
      if (perMember && perMember.trim().length > 0) return perMember; // non-empty string
      // null, empty string, or undefined -> fall back
    }
  }
  return undefined;
}
