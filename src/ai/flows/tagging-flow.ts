
'use server';
/**
 * @fileOverview An AI agent for generating tags from timesheet notes.
 *
 * - generateTags - A function that provides a list of relevant tags from a text note.
 * - TaggingInput - The input type for the generateTags function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TaggingInputSchema = z.object({
  notes: z.string().describe('The text notes from which to generate tags.'),
});
export type TaggingInput = z.infer<typeof TaggingInputSchema>;

const TaggingOutputSchema = z.object({
    tags: z.array(z.string()).describe('A list of relevant tags generated from the notes.'),
});

export async function generateTags(input: TaggingInput): Promise<string[]> {
  const result = await taggingFlow(input);
  return result.tags;
}

const taggingPrompt = ai.definePrompt({
    name: 'taggingPrompt',
    input: { schema: TaggingInputSchema },
    output: { schema: TaggingOutputSchema },
    prompt: `
        You are a helpful project management assistant. Your task is to analyze the following timesheet notes and generate a list of relevant, concise tags. 
        These tags will be used for categorization and future analysis.

        Focus on key activities, issues, or important information.
        Examples of good tags: "Safety Meeting", "Client Walkthrough", "Material Shortage", "Rework", "Weather Delay", "Site Cleanup", "New Task".

        Keep the tags short and to the point. Generate no more than 5 tags.

        Here are the notes:
        "{{notes}}"
    `,
});


const taggingFlow = ai.defineFlow(
  {
    name: 'taggingFlow',
    inputSchema: TaggingInputSchema,
    outputSchema: TaggingOutputSchema,
  },
  async (input) => {
    const llmResponse = await taggingPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error("The AI model did not return a valid list of tags.");
    }

    return output;
  }
);
