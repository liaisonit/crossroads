
'use server';
/**
 * @fileOverview An AI agent for suggesting crew members based on historical data.
 *
 * - suggestCrew - A function that provides a list of suggested employees for a job.
 * - CrewSuggestionInput - The input type for the suggestCrew function.
 * - CrewSuggestion - The return type for the suggestCrew function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Submission } from '@/lib/types';

const CrewSuggestionInputSchema = z.object({
  jobId: z.string().describe('The ID of the job for which to suggest crew members.'),
});
export type CrewSuggestionInput = z.infer<typeof CrewSuggestionInputSchema>;

const CrewSuggestionSchema = z.object({
    name: z.string().describe('The name of the suggested employee.'),
    role: z.string().describe('The most recent role of the employee.'),
    confidence: z.number().describe('The confidence score (0-1) of the suggestion.'),
});

const CrewSuggestionOutputSchema = z.object({
    suggestions: z.array(CrewSuggestionSchema).describe('A list of suggested crew members.'),
});

export type CrewSuggestion = z.infer<typeof CrewSuggestionSchema>;

export async function suggestCrew(input: CrewSuggestionInput): Promise<CrewSuggestion[]> {
  const result = await crewSuggestionFlow(input);
  return result.suggestions;
}

const crewSuggestionFlow = ai.defineFlow(
  {
    name: 'crewSuggestionFlow',
    inputSchema: CrewSuggestionInputSchema,
    outputSchema: CrewSuggestionOutputSchema,
  },
  async ({ jobId }) => {
    if (!jobId) {
        return { suggestions: [] };
    }
    // 1. Fetch the last 5 submissions for the given job
    const submissionsRef = collection(db, 'submissions');
    const q = query(
        submissionsRef, 
        where('jobId', '==', jobId),
        orderBy('submittedAt', 'desc'),
        limit(5)
    );
    const querySnapshot = await getDocs(q);
    const submissions = querySnapshot.docs.map(doc => doc.data() as Submission);

    if (submissions.length === 0) {
        return { suggestions: [] };
    }

    // 2. Analyze employee frequency
    const employeeFrequency: Record<string, { count: number, roles: string[] }> = {};
    let totalEntries = 0;

    submissions.forEach(submission => {
        submission.employees.forEach(employee => {
            if (!employeeFrequency[employee.employee]) {
                employeeFrequency[employee.employee] = { count: 0, roles: [] };
            }
            employeeFrequency[employee.employee].count++;
            employeeFrequency[employee.employee].roles.push(employee.role);
            totalEntries++;
        });
    });

    // 3. Generate suggestions based on frequency (>=60%)
    const suggestions: CrewSuggestion[] = [];
    const submissionCount = submissions.length;

    for (const name in employeeFrequency) {
        const { count, roles } = employeeFrequency[name];
        const confidence = count / submissionCount;
        
        if (confidence >= 0.6) {
            // Find the most recent role for the employee
            const mostRecentRole = roles[0] || 'Unknown';
            
            suggestions.push({
                name,
                role: mostRecentRole,
                confidence,
            });
        }
    }
    
    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return { suggestions };
  }
);
