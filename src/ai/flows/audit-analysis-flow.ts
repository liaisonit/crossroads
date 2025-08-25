
'use server';
/**
 * @fileOverview An AI agent for analyzing system audit logs.
 *
 * - analyzeAuditLogs - A function that provides a natural language summary of audit log entries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AuditLogEntry } from '@/lib/types';

// We can't pass the full Zod schema for AuditLogEntry due to server/client limitations
// So we'll pass the data as a JSON string and describe the structure in the prompt.
const AuditLogAnalysisInputSchema = z.object({
  logs: z.string().describe('A JSON string representing an array of audit log objects.'),
});

const AuditLogAnalysisOutputSchema = z.string().describe('A concise, natural language summary of the audit logs.');


export async function analyzeAuditLogs(logs: AuditLogEntry[]): Promise<string> {
    const analysisResult = await auditAnalysisFlow({ logs: JSON.stringify(logs) });
    return analysisResult;
}


const auditAnalysisPrompt = ai.definePrompt({
    name: 'auditAnalysisPrompt',
    input: { schema: AuditLogAnalysisInputSchema },
    output: { schema: AuditLogAnalysisOutputSchema },
    prompt: `
        You are an expert security and operations analyst for a construction company named Crossroads.
        Your task is to analyze a batch of audit logs and provide a concise, insightful summary for a Super Admin.
        Focus on identifying anomalies, suspicious patterns, or important operational events.

        The provided data is a JSON string containing an array of log objects. Each object has the following structure:
        - actor: { name: string, role: string }
        - action: string (e.g., 'jobs.delete')
        - target: { type: string, id: string }
        - severity: 'info' | 'warn' | 'error'
        - timestamp: The time of the event.
        - details: A human-readable description of the event.

        Based on the logs, generate a summary that highlights:
        1.  Any high-severity events ('warn' or 'error').
        2.  Unusual activity, such as a single user performing many actions in a short period, especially deletions.
        3.  Multiple failed login attempts or other security-related events.
        4.  Significant operational actions (e.g., creation or deletion of multiple jobs or employees).
        5.  Keep the summary professional, clear, and easy to read. Do not just list the logs; provide context and insights. If there's nothing noteworthy, state that system activity appears normal.
        
        Here is the JSON data for the logs:
        {{{logs}}}
    `,
});


const auditAnalysisFlow = ai.defineFlow(
  {
    name: 'auditAnalysisFlow',
    inputSchema: AuditLogAnalysisInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    // A more complex flow could involve fetching related data, but for now, we'll just prompt the LLM.
    const llmResponse = await auditAnalysisPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }

    return output;
  }
);
