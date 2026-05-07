/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface JDCriteria {
  experience: string;
  skills: string;
  education: string;
  achievements: string;
  dataQuality?: string;
  profileScore?: number;
}

export interface CandidateEvaluation {
  name: string;
  score: number;
  justification: string[];
  strengths: string;
  gaps: string;
  recommendation: 'Avanzar' | 'Considerar' | 'Descartar';
  selfEvaluation: string;
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || 'Error en el servidor');
  }
  return response.json();
}

export async function extractCriteriaFromJD(jdText: string): Promise<JDCriteria> {
  return post<JDCriteria>('/api/extract-criteria', { jobDescription: jdText });
}

export async function evaluateCandidate(
  cvText: string,
  criteria: JDCriteria,
  jobTitle: string,
  totalCandidates: number = 1
): Promise<CandidateEvaluation> {
  return post<CandidateEvaluation>('/api/evaluate-candidate', { cvText, criteria, jobTitle, totalCandidates });
}

export async function generateExecutiveSummary(evaluations: CandidateEvaluation[]): Promise<string> {
  const data = await post<{ summary: string }>('/api/executive-summary', { evaluations });
  return data.summary;
}

export interface InterviewCategory {
  name: string;
  label: string;
  questions: string[];
}

export async function generateInterviewQuestions(
  candidate: CandidateEvaluation,
  jobDescription: string
): Promise<InterviewCategory[]> {
  const data = await post<{ categories: InterviewCategory[] }>('/api/interview-questions', { candidate, jobDescription });
  return data.categories;
}
