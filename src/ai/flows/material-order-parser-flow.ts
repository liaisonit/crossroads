
'use server';
/**
 * @fileOverview An AI agent for parsing unstructured text into a material order.
 *
 * - parseMaterialOrderFromText - A function that takes a raw string and returns a structured list of material items.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { MaterialOrderItem } from '@/lib/types';

const MaterialOrderParserInputSchema = z.object({
  text: z.string().describe('The raw text from a user, likely pasted from a chat application like WhatsApp.'),
});

const MaterialOrderItemSchema = z.object({
    name: z.string().describe("The name of the material or equipment. Normalize it (e.g., '2x4 lumber' not '2 by 4s')."),
    quantity: z.number().describe('The quantity of the item. Default to 1 if not specified.'),
    notes: z.string().optional().describe('Any additional notes or specifications for the item.'),
});

const MaterialOrderParserOutputSchema = z.object({
  items: z.array(MaterialOrderItemSchema).describe('The structured list of items parsed from the text.'),
});

export async function parseMaterialOrderFromText(text: string): Promise<MaterialOrderItem[]> {
  const result = await materialOrderParserFlow({ text });
  return result.items;
}

const parsingPrompt = ai.definePrompt({
    name: 'materialOrderParsingPrompt',
    input: { schema: MaterialOrderParserInputSchema },
    output: { schema: MaterialOrderParserOutputSchema },
    prompt: `
        You are an expert at parsing and normalizing material lists for a construction company.
        Your task is to take a raw, unstructured text input, likely from a WhatsApp message, and convert it into a structured list of material order items.

        Guidelines:
        - Extract the item name and quantity for each line.
        - If a quantity is not explicitly mentioned, assume it is 1.
        - Normalize item names. For example, "2 by 4s", "2x4 lumber", "two by fours" should all become "2x4 Lumber".
        - Ignore any conversational text, greetings, or lines that are not material requests.
        - Capture any specific details as notes for that item.
        - If a line is ambiguous, do your best to interpret it as a material request. If it's clearly not a material, ignore it.

        Examples:
        - "20x Switch Box" -> name: 'Switch Box', quantity: 20
        - "a few wire rolls, maybe 5?" -> name: 'Wire Roll', quantity: 5, notes: 'maybe 5?'
        - "cable ties, one pack" -> name: 'Cable Ties', quantity: 1, notes: 'one pack'
        - "I need a scissor lift for tomorrow" -> name: 'Scissor Lift', quantity: 1, notes: 'for tomorrow'

        Here is the text to parse:
        "{{text}}"
    `,
});


const materialOrderParserFlow = ai.defineFlow(
  {
    name: 'materialOrderParserFlow',
    inputSchema: MaterialOrderParserInputSchema,
    outputSchema: MaterialOrderParserOutputSchema,
  },
  async (input) => {
    const llmResponse = await parsingPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error("The AI model did not return a valid list of items.");
    }
    
    // Filter out any items where the model might have hallucinated an empty name.
    const cleanedItems = output.items.filter(item => item.name && item.name.trim() !== '');

    return { items: cleanedItems };
  }
);
