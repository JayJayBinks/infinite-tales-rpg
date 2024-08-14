import { describe, it, expect } from 'vitest';
import {determineDiceRollResult, getRndInteger, mustRollDice} from "./gameLogic.ts";

describe('determineDiceRollResult', () => {
    it('should return undefined when action.dice_roll is not provided or rolledValue is "?"', () => {
        expect(determineDiceRollResult({}, '?', 2)).toBeUndefined();
        expect(determineDiceRollResult({ dice_roll: undefined }, 15, 2)).toBeUndefined();
    });

    it('should return critical failure on rolled value of 1', () => {
        const action = { dice_roll: { required_value: 10 } };
        expect(determineDiceRollResult(action, 1, 0)).toBe('The action is a critical failure!');
    });

    it('should return critical success on rolled value of 20', () => {
        const action = { dice_roll: { required_value: 10 } };
        expect(determineDiceRollResult(action, 20, 0)).toBe('The action is a critical success!');
    });

    it('should return major failure when diff is <= -6', () => {
        const action = { dice_roll: { required_value: 15 } };
        expect(determineDiceRollResult(action, 5, 4)).toBe('The action is a major failure.');
    });

    it('should return regular failure when diff is <= -3', () => {
        const action = { dice_roll: { required_value: 15 } };
        expect(determineDiceRollResult(action, 10, 1)).toBe('The action is a regular failure.');
    });

    it('should return partial failure when diff is <= -1', () => {
        const action = { dice_roll: { required_value: 15 } };
        expect(determineDiceRollResult(action, 13, 1)).toBe('The action is a partial failure.');
    });

    it('should return major success when diff is >= 6', () => {
        const action = { dice_roll: { required_value: 10 } };
        expect(determineDiceRollResult(action, 15, 2)).toBe('The action is a major success.');
    });

    it('should return regular success when diff is >= 0', () => {
        const action = { dice_roll: { required_value: 15 } };
        expect(determineDiceRollResult(action, 15, 0)).toBe('The action is a regular success.');
    });

    it('should handle non-numeric rolledValue or modifier', () => {
        const action = { dice_roll: { required_value: 10 } };
        expect(determineDiceRollResult(action, 'five', 2)).toBe('The action is a major failure.');
        expect(determineDiceRollResult(action, 12, 'three')).toBe('The action is a regular success.');
    });
});




describe('mustRollDice', () => {
    it('should return false when action text is "continue the tale"', () => {
        const action = { text: 'continue the tale', action_difficulty: 'none', type: 'combat' };
        expect(mustRollDice(action)).toBe(false);
    });

    it('should return true when action difficulty is not "none" or "simple"', () => {
        const action = { text: 'attack', action_difficulty: 'hard', type: 'combat' };
        expect(mustRollDice(action)).toBe(true);
    });

    it('should return true when action type is "social_manipulation"', () => {
        const action = { text: 'convince', action_difficulty: 'none', type: 'social_manipulation' };
        expect(mustRollDice(action)).toBe(true);
    });

    it('should return false for non-difficult actions', () => {
        const action = { text: 'observe', action_difficulty: 'none', type: 'investigation' };
        expect(mustRollDice(action)).toBe(false);
    });
});




describe('getRndInteger', () => {
    it('should return a random integer between min (inclusive) and max (exclusive)', () => {
        const min = 1;
        const max = 10;
        for (let i = 0; i < 100; i++) { // Test multiple times for random value
            const value = getRndInteger(min, max);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThan(max);
        }
    });

    it('should handle negative ranges correctly', () => {
        const min = -10;
        const max = -1;
        for (let i = 0; i < 100; i++) {
            const value = getRndInteger(min, max);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThan(max);
        }
    });
});