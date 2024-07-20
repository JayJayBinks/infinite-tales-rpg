export const initialCharacterState = {
    name: '',
    appearance: '',
    race: '',
    personality: '',
    background: '',
    alignment: '',
    motivation: '',
    class: '',
    traits: '',
    abilities: '',
    expertise: '',
    disadvantages: '',
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
