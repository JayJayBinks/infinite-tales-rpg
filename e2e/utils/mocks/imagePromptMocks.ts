export const MOCK_IMAGE_PROMPT = 'A dramatic fantasy scene showing floating sky islands with broken magical bridges, heroes standing at the edge looking determined, painterly Moebius art style with vibrant colors';

export function generateImagePromptResponse(_context: any): { image_prompt: string } {
  return { image_prompt: MOCK_IMAGE_PROMPT };
}
