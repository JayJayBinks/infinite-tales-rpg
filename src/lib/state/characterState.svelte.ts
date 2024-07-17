export const initialCharacterState = {
    name: undefined,
    appearance: undefined,
    race: undefined,
    personality: undefined,
    background: undefined,
    alignment: undefined,
    motivation: undefined,
    class: undefined,
    traits: undefined,
    abilities: undefined,
    expertise: undefined,
    disadvantages: undefined,
}


class CharacterState {
    value = $state({...initialCharacterState});
    overwrites = $state({});

    clear = () => {
        this.value = {...initialCharacterState};
        this.overwrites = undefined;
    };

    clearSingle(stateRef) {
        this.value[stateRef] = initialCharacterState[stateRef];
        this.overwrites[stateRef] = undefined;
    }
}

export const characterState = new CharacterState();
