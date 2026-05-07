import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL = 'gemini-2.0-flash';

export interface JDCriteria {
  experience: string;
  skills: string;
  education: string;
  achievements: string;
}

export interface CandidateEvaluation {
  name: string;
  score: number;
  justification: string[];
  strengths: string;
  gaps: string;
  recommendation: 'Avanzar' | 'Considerar' | 'Descartar';
}

export async function extractCriteria(jobDescription: string): Promise<JDCriteria> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Analiza la siguiente descripción de cargo y extrae la información solicitada en formato JSON.

    Descripción:
    ${jobDescription}

    Extrae exactamente estas 4 secciones:
    - Experiencia requerida
    - Habilidades técnicas
    - Formación académica
    - Logros o competencias esperadas`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          experience: { type: Type.STRING, description: 'Experiencia requerida' },
          skills: { type: Type.STRING, description: 'Habilidades técnicas' },
          education: { type: Type.STRING, description: 'Formación académica' },
          achievements: { type: Type.STRING, description: 'Logros o competencias esperadas' },
        },
        required: ['experience', 'skills', 'education', 'achievements'],
      },
    },
  });
  return JSON.parse(response.text || '{}');
}

export async function evaluateCandidate(
  cvText: string,
  criteria: JDCriteria,
  jobTitle: string
): Promise<CandidateEvaluation> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Eres un experto en selección de personal. Evalúa el siguiente CV frente a los criterios del cargo "${jobTitle}".

    CRITERIOS DEL CARGO:
    - Experiencia: ${criteria.experience}
    - Habilidades: ${criteria.skills}
    - Educación: ${criteria.education}
    - Logros/Competencias: ${criteria.achievements}

    CONTENIDO DEL CV:
    ${cvText}

    INSTRUCCIONES:
    1. Extrae el nombre del candidato. Si no lo encuentras, usa "Candidato sin identificar".
    2. Score numérico del 1 al 10.
    3. Justificación en 3 a 5 puntos concretos tomados del CV.
    4. Fortalezas.
    5. Brechas.
    6. Recomendación: Avanzar, Considerar o Descartar.

    Responde en formato JSON.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          justification: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 a 5 puntos concretos con evidencia real',
          },
          strengths: { type: Type.STRING },
          gaps: { type: Type.STRING },
          recommendation: {
            type: Type.STRING,
            enum: ['Avanzar', 'Considerar', 'Descartar'],
          },
        },
        required: ['name', 'score', 'justification', 'strengths', 'gaps', 'recommendation'],
      },
    },
  });
  return JSON.parse(response.text || '{}');
}

export async function generateExecutiveSummary(
  evaluations: CandidateEvaluation[]
): Promise<{ summary: string }> {
  const sorted = [...evaluations].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Genera un resumen ejecutivo breve y profesional recomendando a los mejores 3 candidatos para avanzar a entrevista basado en estas evaluaciones:
    ${JSON.stringify(top3)}`,
  });
  return { summary: response.text || '' };
}

export async function generateInterviewQuestions(
  candidate: CandidateEvaluation,
  jobDescription: string
): Promise<{ questions: string[] }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Basado en la evaluación del candidato ${candidate.name} para el cargo con la siguiente descripción, genera EXACTAMENTE 3 preguntas de entrevista personalizadas para validar sus brechas o profundizar en sus fortalezas.

    PERFIL CARGO:
    ${jobDescription}

    EVALUACIÓN DEL CANDIDATO:
    - Score: ${candidate.score}
    - Fortalezas: ${candidate.strengths}
    - Brechas: ${candidate.gaps}

    Responde en formato JSON con un arreglo de 3 strings.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['questions'],
      },
    },
  });
  const data = JSON.parse(response.text || '{"questions":[]}');
  return { questions: data.questions || [] };
}
