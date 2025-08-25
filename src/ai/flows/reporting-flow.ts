
'use server';
/**
 * @fileOverview An AI agent for analyzing weekly timesheet reports.
 *
 * - analyzeReport - A function that provides a natural language summary of weekly data.
 * - WeeklySummary - The input type for the analyzeReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { WeeklySummary } from '@/lib/types';


// Define the Zod schema based on the WeeklySummary type from "@/lib/types"
const CategorySummarySchema = z.record(z.object({
    regularHours: z.number(),
    overtimeHours: z.number(),
    totalHours: z.number(),
}));

const WeeklySummarySchema = z.object({
  employee: CategorySummarySchema,
  job: CategorySummarySchema,
  role: CategorySummarySchema,
});


export async function analyzeReport(input: WeeklySummary): Promise<string> {
  const analysisResult = await reportAnalysisFlow(input);
  return analysisResult;
}

const reportAnalysisPrompt = ai.definePrompt({
    name: 'reportAnalysisPrompt',
    input: { schema: WeeklySummarySchema },
    output: { schema: z.string() },
    prompt: `
        You are a helpful project management assistant for a construction company called Crossroads.
        Your task is to analyze a weekly timesheet summary and provide a concise, insightful, natural language summary for the company's management.
        
        The provided data is a JSON object with three main keys: 'employee', 'job', and 'role'. Each key contains an object where the keys are the names of employees, jobs, or roles, and the values are the total regular, overtime, and total hours for the week.

        Based on the data, generate a summary that includes:
        1. A brief opening statement with the total hours logged across all jobs.
        2. Identify the job site with the highest total hours and the most overtime.
        3. Mention the employee who worked the most total hours.
        4. Point out any other interesting patterns or potential points of interest, such as a role type that has a high amount of overtime.
        5. Keep the summary professional, clear, and easy to read. Do not just list the data, but provide context and insights.
        
        Here is the data for the week:
        Employee Summary: {{{JSON.stringify employee}}}
        Job Summary: {{{JSON.stringify job}}}
        Role Summary: {{{JSON.stringify role}}}
    `,
});


const reportAnalysisFlow = ai.defineFlow(
  {
    name: 'reportAnalysisFlow',
    inputSchema: WeeklySummarySchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const llmResponse = await reportAnalysisPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }

    return output;
  }
);
