import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL = 'gemini-2.5-flash';

export interface JDCriteria {
  experience: string;
  skills: string;
  education: string;
  achievements: string;
  dataQuality?: string; // Mejora 1.1: avisa si la descripción del cargo es insuficiente
}

export interface CandidateEvaluation {
  name: string;
  score: number;
  justification: string[];
  strengths: string;
  gaps: string;
  recommendation: 'Avanzar' | 'Considerar' | 'Descartar';
  selfEvaluation: string; // Mejora 5: la IA revisa su propio trabajo
}

// ─── 1. Extraer criterios del cargo ──────────────────────────────────────────

export async function extractCriteria(jobDescription: string): Promise<JDCriteria> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Eres una especialista en análisis de perfiles de cargo con amplia experiencia en selección de personal.

PASO 1 — EVALÚA LA CALIDAD DE LA DESCRIPCIÓN:
Revisa si la descripción tiene suficiente información para extraer criterios claros.
- Si es muy corta (menos de 50 palabras) o le faltan secciones importantes, escribe en "dataQuality" qué información faltó y qué debería agregar el reclutador para una evaluación más precisa.
- Si es completa y clara, escribe: "Descripción suficiente para evaluación."

PASO 2 — EXTRAE LOS 4 CRITERIOS:
Para cada sección, interpreta y sintetiza — no copies literalmente la descripción.
- Experiencia requerida: años, tipo de rol, industria o contexto específico.
- Habilidades técnicas: herramientas, tecnologías, metodologías concretas.
- Formación académica: nivel de estudios, área, certificaciones relevantes.
- Logros o competencias esperadas: resultados medibles, habilidades blandas clave, impacto esperado.

Si alguna sección no tiene información suficiente, escribe: "No especificado en la descripción."

Descripción del cargo:
${jobDescription}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          experience:   { type: Type.STRING, description: 'Experiencia requerida' },
          skills:       { type: Type.STRING, description: 'Habilidades técnicas' },
          education:    { type: Type.STRING, description: 'Formación académica' },
          achievements: { type: Type.STRING, description: 'Logros o competencias esperadas' },
          dataQuality:  { type: Type.STRING, description: 'Evaluación de la calidad de la descripción del cargo' },
        },
        required: ['experience', 'skills', 'education', 'achievements', 'dataQuality'],
      },
    },
  });
  return JSON.parse(response.text || '{}');
}

// ─── 2. Evaluar un candidato ──────────────────────────────────────────────────

export async function evaluateCandidate(
  cvText: string,
  criteria: JDCriteria,
  jobTitle: string,
  totalCandidates: number = 1
): Promise<CandidateEvaluation> {

  // Mejora 3: nivel de detalle según volumen de candidatos
  const detailLevel = totalCandidates <= 5
    ? 'Proceso pequeño (≤5 candidatos): proporciona análisis detallado y justificaciones completas.'
    : totalCandidates <= 10
      ? 'Proceso mediano (6-10 candidatos): análisis equilibrado, conciso y claro.'
      : 'Proceso grande (+10 candidatos): respuestas concisas, enfocadas en los diferenciadores clave.';

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `# ROL
Eres una evaluadora experta en selección de personal con 15 años de experiencia. Tu trabajo es riguroso, consistente y completamente libre de sesgos. Evalúas basándote únicamente en evidencia presente en el CV, nunca en suposiciones.

Cargo: "${jobTitle}"
Candidatos totales en este proceso: ${totalCandidates}

# ESCALA DE PUNTUACIÓN
1-2 → No cumple ningún requisito mínimo
3-4 → Cumple menos del 40% de los requisitos
5-6 → Cumple entre el 40% y 70%
7   → Cumple entre el 70% y 85% — perfil sólido con brechas menores
8   → Cumple entre el 85% y 95% — muy buena opción
9-10 → Supera los requisitos — candidato excepcional

# REGLAS DE COMPORTAMIENTO
- CV INCOMPLETO: Si el CV tiene menos de 150 palabras o no incluye experiencia ni educación, asigna máximo 5/10 e indica en selfEvaluation qué faltó.
- SIN REQUISITO MÍNIMO: Si el candidato claramente no cumple la experiencia mínima del cargo, la recomendación debe ser "Descartar" sin importar otros factores positivos.
- EMPATE EN SCORE: Si dos candidatos tienen el mismo puntaje, prioriza al que tenga más evidencia concreta (proyectos, logros medibles, certificaciones).

# NIVEL DE DETALLE
${detailLevel}

# CRITERIOS DEL CARGO
- Experiencia requerida: ${criteria.experience}
- Habilidades técnicas: ${criteria.skills}
- Formación académica: ${criteria.education}
- Logros/Competencias: ${criteria.achievements}

# CV DEL CANDIDATO
${cvText}

# PLANTILLA DE RESPUESTA (sigue esta estructura exacta)
- name: Nombre completo del candidato. Si no aparece: "Candidato sin identificar".
- score: Número entero del 1 al 10 usando la escala de referencia.
- justification: Array de 3 a 5 puntos. Cada punto debe citar evidencia concreta del CV, relacionarla con un criterio del cargo, y comenzar con verbo en tercera persona ("Demuestra...", "Cuenta con...", "No evidencia...").
- strengths: Exactamente 2 fortalezas en formato "• [Fortaleza]: [evidencia concreta del CV]".
- gaps: 1 a 2 brechas en formato "• [Criterio faltante]: [impacto esperado en el desempeño del cargo]".
- recommendation: "Avanzar" si score ≥ 7 y cumple mínimos | "Considerar" si score 5-6 | "Descartar" si score ≤ 4 o no cumple requisito mínimo.
- selfEvaluation: Una oración con: (1) si el CV tenía información suficiente para evaluar, (2) qué criterios no pudieron evaluarse por falta de datos, (3) nivel de confianza en el score — Alto, Medio o Bajo.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name:           { type: Type.STRING },
          score:          { type: Type.NUMBER },
          justification:  { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths:      { type: Type.STRING },
          gaps:           { type: Type.STRING },
          recommendation: { type: Type.STRING, enum: ['Avanzar', 'Considerar', 'Descartar'] },
          selfEvaluation: { type: Type.STRING },
        },
        required: ['name', 'score', 'justification', 'strengths', 'gaps', 'recommendation', 'selfEvaluation'],
      },
    },
  });
  return JSON.parse(response.text || '{}');
}

// ─── 3. Resumen ejecutivo ─────────────────────────────────────────────────────

export async function generateExecutiveSummary(
  evaluations: CandidateEvaluation[]
): Promise<{ summary: string }> {
  const sorted = [...evaluations].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Eres un consultor de selección de personal preparando un reporte ejecutivo para el equipo directivo.

ESTRUCTURA OBLIGATORIA (sigue este orden exacto):

**1. Recomendación principal**
Una sola oración: cuántos candidatos avanzan y si el proceso fue exitoso.

**2. Candidatos recomendados** (para cada uno de los top 3)
• Nombre y score
• Razón principal para avanzar (1 oración con evidencia concreta)
• Brecha o riesgo más relevante a validar en entrevista

**3. Elemento diferenciador**
Qué distingue al candidato con mayor score de los demás (1-2 oraciones).

**4. Prioridad para la entrevista**
Un tema o competencia que el panel debe profundizar con todos los candidatos.

Tono: profesional, directo, orientado a la decisión. Máximo 300 palabras.

Evaluaciones del proceso:
${JSON.stringify(top3)}`,
  });
  return { summary: response.text || '' };
}

// ─── 4. Preguntas de entrevista ───────────────────────────────────────────────

export async function generateInterviewQuestions(
  candidate: CandidateEvaluation,
  jobDescription: string
): Promise<{ questions: string[] }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Eres un entrevistador experto. Diseña exactamente 3 preguntas de entrevista para ${candidate.name}, candidato al cargo descrito a continuación.

TIPO DE PREGUNTA POR NÚMERO:
1. [TÉCNICA]: valida una habilidad específica del cargo que el CV no demostró claramente.
2. [COMPORTAMENTAL]: explora cómo manejó una situación real relevante al cargo. Usa el formato STAR implícito (Situación, Tarea, Acción, Resultado).
3. [BRECHA]: profundiza directamente en la brecha más crítica de este candidato.

PERFIL DEL CANDIDATO:
- Score obtenido: ${candidate.score}/10
- Fortalezas identificadas: ${candidate.strengths}
- Brecha crítica: ${candidate.gaps}

DESCRIPCIÓN DEL CARGO:
${jobDescription}

Redacta cada pregunta en segunda persona ("¿Cómo harías...?", "Cuéntame sobre..."). Sé específico al cargo — evita preguntas genéricas. Incluye el tipo como prefijo: "[TÉCNICA]", "[COMPORTAMENTAL]", "[BRECHA]".`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['questions'],
      },
    },
  });
  const data = JSON.parse(response.text || '{"questions":[]}');
  return { questions: data.questions || [] };
}
