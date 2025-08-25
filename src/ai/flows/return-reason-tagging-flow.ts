
'use server';
/**
 * @fileOverview An AI agent for classifying material return reasons.
 *
 * - classifyReturnReason - A function that takes a raw string and returns a structured list of reason tags.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReturnReasonParserInputSchema = z.object({
  reasonText: z.string().describe('The raw text from a user explaining why an item is being returned.'),
});

const ReturnReasonParserOutputSchema = z.object({
  tags: z.array(z.enum(["Excess", "Damaged", "Wrong Item", "Quality Issue", "Other"]))
          .describe('A list of classification tags. Choose one or more relevant tags from the available options.'),
});

export async function classifyReturnReason(input: { reasonText: string }): Promise<string[]> {
  const result = await returnReasonTaggerFlow(input);
  return result.tags;
}

const taggingPrompt = ai.definePrompt({
    name: 'returnReasonTaggingPrompt',
    input: { schema: ReturnReasonParserInputSchema },
    output: { schema: ReturnReasonParserOutputSchema },
    prompt: `
        You are an expert at classifying reasons for material returns at a construction company.
        Your task is to analyze the provided text and assign one or more predefined tags that best describe the reason for the return.

        Available Tags:
        - Excess: The item was over-ordered, or not all of it was needed.
        - Damaged: The item arrived broken or was damaged on site.
        - Wrong Item: The delivered item was not what was ordered (e.g., wrong size, wrong color, wrong type).
        - Quality Issue: The item has a manufacturing defect or is not up to standards, but is not physically broken.
        - Other: The reason does not fit into any of the above categories.

        Analyze the following reason provided by a user and select the most appropriate tag(s).

        Reason Text:
        "{{reasonText}}"
    `,
});


const returnReasonTaggerFlow = ai.defineFlow(
  {
    name: 'returnReasonTaggerFlow',
    inputSchema: ReturnReasonParserInputSchema,
    outputSchema: ReturnReasonParserOutputSchema,
  },
  async (input) => {
    const llmResponse = await taggingPrompt(input);
    const output = llmResponse.output;

    if (!output || !output.tags) {
      throw new Error("The AI model did not return a valid list of tags.");
    }
    
    return { tags: output.tags };
  }
);
