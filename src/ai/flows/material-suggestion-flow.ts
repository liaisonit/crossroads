
'use server';
/**
 * @fileOverview An AI agent for suggesting materials based on historical order data.
 *
 * - suggestMaterials - A function that provides a list of suggested materials for a job.
 * - MaterialSuggestionInput - The input type for the suggestMaterials function.
 * - MaterialSuggestion - The return type for the suggestMaterials function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MaterialOrder, MaterialSuggestion } from '@/lib/types';

const MaterialSuggestionInputSchema = z.object({
  jobId: z.string().describe('The ID of the job for which to suggest materials.'),
});
export type MaterialSuggestionInput = z.infer<typeof MaterialSuggestionInputSchema>;

const MaterialSuggestionSchema = z.object({
    name: z.string().describe('The name of the suggested material/equipment.'),
    confidence: z.number().describe('The confidence score (0-1) of the suggestion.'),
    suggestedQuantity: z.number().optional().describe('The suggested median quantity for the item.'),
});

const MaterialSuggestionOutputSchema = z.object({
    suggestions: z.array(MaterialSuggestionSchema).describe('A list of suggested materials.'),
});


export async function suggestMaterials(input: MaterialSuggestionInput): Promise<MaterialSuggestion[]> {
  const result = await materialSuggestionFlow(input);
  return result.suggestions;
}

// Helper function to calculate median
const calculateMedian = (numbers: number[]): number => {
    if (numbers.length === 0) return 1; // Default to 1 if no data
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
};

const materialSuggestionFlow = ai.defineFlow(
  {
    name: 'materialSuggestionFlow',
    inputSchema: MaterialSuggestionInputSchema,
    outputSchema: MaterialSuggestionOutputSchema,
  },
  async ({ jobId }) => {
    if (!jobId) {
        return { suggestions: [] };
    }
    // 1. Fetch the last 10 material orders for the given job
    const ordersRef = collection(db, 'materialOrders');
    const q = query(
        ordersRef, 
        where('jobId', '==', jobId),
        where('status', '==', 'Delivered'), // Only learn from completed orders
        orderBy('createdAt', 'desc'),
        limit(10)
    );
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => doc.data() as MaterialOrder);

    if (orders.length === 0) {
        return { suggestions: [] };
    }

    // 2. Analyze item frequency and quantities
    const itemData: Record<string, { count: number, quantities: number[] }> = {};

    orders.forEach(order => {
        order.items.forEach(item => {
            if (!itemData[item.name]) {
                itemData[item.name] = { count: 0, quantities: [] };
            }
            itemData[item.name].count++;
            itemData[item.name].quantities.push(item.quantity);
        });
    });

    // 3. Generate suggestions based on frequency (appears in >= 50% of orders)
    const suggestions: MaterialSuggestion[] = [];
    const orderCount = orders.length;

    for (const name in itemData) {
        const { count, quantities } = itemData[name];
        const confidence = count / orderCount;
        
        if (confidence >= 0.5) {
            const suggestedQuantity = calculateMedian(quantities);
            suggestions.push({
                name,
                confidence,
                suggestedQuantity,
            });
        }
    }
    
    // Sort by confidence, then alphabetically
    suggestions.sort((a, b) => {
        if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
        }
        return a.name.localeCompare(b.name);
    });

    return { suggestions };
  }
);
