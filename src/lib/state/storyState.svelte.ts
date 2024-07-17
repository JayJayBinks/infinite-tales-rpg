export const initialStoryState = {
    game: "",
    adventure_and_main_event: "",
    theme: "",
    tonality: "",
    character: "",
    general_image_prompt: "",
}

/**
 * storyStateForPrompt will be sent to ai to generate StoryState, overwrites can preset custom values
 */
class StoryState {
    value = $state({...initialStoryState});

    overwrites = $state({...initialStoryState});

    clear(){
        this.value = {...initialStoryState};
        this.overwrites = {...initialStoryState};
    }

    clearSingle(stateRef) {
        this.value[stateRef] = initialStoryState[stateRef];
        this.overwrites[stateRef] = undefined;
    }
}

export const storyState = new StoryState();
