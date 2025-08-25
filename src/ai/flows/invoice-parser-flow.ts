
'use server';
/**
 * @fileOverview An AI agent for parsing invoice images.
 *
 * - parseInvoice - A function that takes an invoice image and returns a structured list of line items.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { MaterialOrderItem } from '@/lib/types';

const InvoiceParserInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});

const MaterialOrderItemSchema = z.object({
    name: z.string().describe("The name of the material or equipment. Be precise and avoid abbreviations if possible."),
    quantity: z.number().describe('The quantity of the item.'),
});

const InvoiceParserOutputSchema = z.array(MaterialOrderItemSchema);


export async function parseInvoice(input: { photoDataUri: string }): Promise<MaterialOrderItem[]> {
  const result = await invoiceParserFlow(input);
  return result;
}

const parsingPrompt = ai.definePrompt({
    name: 'invoiceParsingPrompt',
    input: { schema: InvoiceParserInputSchema },
    output: { schema: InvoiceParserOutputSchema },
    prompt: `
        You are an expert at using OCR to parse invoices and receipts for a construction company.
        Your task is to take an image of an invoice and extract a structured list of all line items, including their name and quantity.

        Guidelines:
        - Carefully scan the image and identify each line item.
        - Extract the item name and its corresponding quantity.
        - Ignore headers, footers, totals, taxes, and any other non-item information.
        - If an item's name is abbreviated, expand it if you are confident in the full name (e.g., "BX, 1G" should be "1-Gang Box"). Otherwise, use the text as-is.
        - Pay close attention to numbers and ensure you extract the correct quantity for each item.

        Here is the invoice image to parse:
        {{media url=photoDataUri}}
    `,
});


const invoiceParserFlow = ai.defineFlow(
  {
    name: 'invoiceParserFlow',
    inputSchema: InvoiceParserInputSchema,
    outputSchema: InvoiceParserOutputSchema,
  },
  async (input) => {
    const llmResponse = await parsingPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error("The AI model did not return a valid list of items from the invoice.");
    }
    
    return output;
  }
);
