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

# PRINCIPIO FUNDAMENTAL
Trabajas ÚNICAMENTE con lo que está escrito en la descripción. No infieres, no supones, no completas información que no aparece.

REGLA DE ORO: Si un requisito no está escrito en la descripción, NO lo agregues a los criterios — por más obvio que parezca para ese tipo de cargo. Escribe "No especificado en la descripción."

Esto es especialmente crítico para:
- Años de experiencia: si no se mencionan explícitamente, no los inventes.
- Herramientas o tecnologías: si no están nombradas, no las asumas por el tipo de cargo.
- Nivel de estudios: si no se indica, no lo deduzcas ni lo inferas.
- Logros o resultados: si no se describen, no los supongas.

PASO 1 — EVALÚA LA CALIDAD DE LA DESCRIPCIÓN:
Revisa si la descripción tiene suficiente información para extraer criterios claros.
- Si es muy corta (menos de 50 palabras) o le faltan secciones clave, escribe en "dataQuality" exactamente qué información faltó y qué debería agregar el reclutador.
- Si es completa y clara, escribe: "Descripción suficiente para evaluación."

PASO 2 — EXTRAE LOS 4 CRITERIOS (solo con lo que está escrito):
- Experiencia requerida: años, tipo de rol, industria — solo si están explícitos.
- Habilidades técnicas: herramientas, tecnologías, metodologías — solo las mencionadas.
- Formación académica: nivel, área, certificaciones — solo las indicadas.
- Logros o competencias esperadas: resultados o habilidades — solo los descritos.

Si alguna sección no tiene información, escribe exactamente: "No especificado en la descripción."

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
Eres una evaluadora experta en selección de personal con 15 años de experiencia en empresas de tecnología, servicios y consumo masivo. Tu reputación se basa en tres principios irrompibles: rigor, objetividad y honestidad.

Cargo: "${jobTitle}"
Candidatos totales en este proceso: ${totalCandidates}

# PRINCIPIO FUNDAMENTAL — LEE ESTO ANTES DE EVALUAR
Trabajas ÚNICAMENTE con lo que está escrito en el CV. No infieres, no supones, no completas información que no aparece.

REGLA DE ORO: Si un dato no está en el documento, debes escribir explícitamente "No se encontró en el CV" — nunca inventar ni asumir que probablemente lo tiene.

Esto aplica a todo:
- Si no aparece el nombre → "Candidato sin identificar"
- Si no menciona años de experiencia → "No se encontró en el CV"
- Si no indica el nivel de estudios → "No se encontró en el CV"
- Si lista una herramienta pero no demuestra dominio → anótalo como dato presente pero sin evidencia de profundidad
- Si el cargo anterior suena relevante pero no describe responsabilidades → no asumas que las tiene

# PESOS DE EVALUACIÓN (aplica este orden de importancia en todo el análisis)
1. Experiencia en roles similares al cargo → 40% del score (el más determinante)
2. Habilidades técnicas requeridas por el cargo → 30% del score
3. Formación académica → 20% del score
4. Logros concretos y medibles → 10% del score

REGLA DE DESCARTE INMEDIATO: Si el candidato NO tiene ninguna experiencia en roles similares o relacionados con el cargo (ni directa ni indirecta), asigna score 1-2, recomendación "Descartar" y detén el análisis profundo. En justification escribe: "Descartado por ausencia total de experiencia relacionada con el cargo." No es necesario analizar los demás criterios.

# ESCALA DE PUNTUACIÓN (pondera los 4 criterios según sus pesos)
1-2 → Sin experiencia relacionada — descarte inmediato
3-4 → Experiencia débil o irrelevante; cumple menos del 40% de los criterios ponderados
5-6 → Experiencia parcial; cumple entre el 40% y 70% de los criterios ponderados
7   → Experiencia sólida; cumple entre el 70% y 85% — brechas menores en habilidades o formación
8   → Muy buena experiencia; cumple entre el 85% y 95% de todos los criterios
9-10 → Experiencia excepcional; supera los requisitos en la mayoría de los criterios

La falta de información en el CV cuenta como brecha. Un CV ambiguo NO debe beneficiar al candidato.

# REGLAS DE COMPORTAMIENTO
- CV INCOMPLETO: Si el CV tiene menos de 150 palabras o no incluye experiencia ni educación, asigna máximo 5/10 e indica en selfEvaluation qué secciones faltaron.
- SIN EXPERIENCIA RELACIONADA: Si no hay ninguna evidencia de experiencia en roles similares al cargo, aplica el DESCARTE INMEDIATO descrito arriba. Este es el criterio más importante (40%) y su ausencia total no se puede compensar con otros factores.
- DATO AMBIGUO: Si una afirmación en el CV es vaga (ej. "conocimientos en Python", "experiencia en ventas"), trátala como evidencia débil — no la puntúes igual que una afirmación concreta con contexto, años o resultados.
- EMPATE EN SCORE: Prioriza al candidato con más experiencia concreta en roles similares (el criterio de mayor peso).

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
- name: Nombre completo extraído del CV. Si no aparece: "Candidato sin identificar".
- score: Número entero del 1 al 10. Basa el score en evidencia presente, no en lo que el candidato podría tener.
- justification: Array de 3 a 5 puntos. Cada punto debe: (a) citar textualmente o parafrasear algo del CV, (b) relacionarlo con un criterio del cargo, (c) comenzar con verbo en tercera persona. Si algo no aparece, escríbelo: "No evidencia en el CV experiencia en [X]."
- strengths: Exactamente 2 fortalezas respaldadas por evidencia real del CV, en formato "• [Fortaleza]: [cita o paráfrasis del CV]".
- gaps: 1 a 2 brechas reales, en formato "• [Criterio faltante o ambiguo]: [impacto en el cargo]". Si el dato no aparece, escribe "No se encontró en el CV."
- recommendation: "Avanzar" si score ≥ 7 y cumple mínimos | "Considerar" si score 5-6 | "Descartar" si score ≤ 4 o no cumple requisito mínimo.
- selfEvaluation: Una oración honesta con: (1) qué tan completo estaba el CV para evaluar, (2) qué criterios no pudieron verificarse por falta de datos, (3) nivel de confianza en el score — Alto (CV completo y claro), Medio (CV parcial o ambiguo), Bajo (CV muy escaso o confuso).`,
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
