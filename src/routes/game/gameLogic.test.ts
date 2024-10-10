import { describe, it, expect } from 'vitest';
import {mustRollDice} from "./gameLogic.ts";


//TODO recreate
describe('determineDiceRollResult', () => {
    it('should return undefined when required_value is not provided or rolledValue is undefined', () => {
        expect(determineDiceRollResult(12, undefined, 2)).toBeUndefined();
        expect(determineDiceRollResult(undefined, 15, 2)).toBeUndefined();
    });

    it('should return critical failure on rolled value of 1', () => {
        expect(determineDiceRollResult(10, 1, 0)).toBe('The action is a critical failure!');
    });

    it('should return critical success on rolled value of 20', () => {
        expect(determineDiceRollResult(10, 20, 0)).toBe('The action is a critical success!');
    });

    it('should return major failure when diff is <= -6', () => {
        expect(determineDiceRollResult(15, 5, 4)).toBe('The action is a major failure.');
    });

    it('should return regular failure when diff is <= -3', () => {
        expect(determineDiceRollResult(15, 10, 1)).toBe('The action is a regular failure.');
    });

    it('should return partial failure when diff is <= -1', () => {
        expect(determineDiceRollResult(15, 13, 1)).toBe('The action is a partial failure.');
    });

    it('should return major success when diff is >= 6', () => {
        expect(determineDiceRollResult(10, 15, 2)).toBe('The action is a major success.');
    });

    it('should return regular success when diff is >= 0', () => {
        expect(determineDiceRollResult(15, 15, 0)).toBe('The action is a regular success.');
    });

    it('should handle non-numeric rolledValue or modifier', () => {
        expect(determineDiceRollResult(10, 'five', 2)).toBe('The action is a major failure.');
        expect(determineDiceRollResult(10, 12, 'three')).toBe('The action is a regular success.');
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
            const value = getRandomInteger(min, max);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThanOrEqual(max);
        }
    });

    it('should handle negative ranges correctly', () => {
        const min = -10;
        const max = -1;
        for (let i = 0; i < 100; i++) {
            const value = getRandomInteger(min, max);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThanOrEqual(max);
        }
    });
});