import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import {
  extractCriteria,
  evaluateCandidate,
  generateExecutiveSummary,
  generateInterviewQuestions,
} from './services/gemini.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Rutas API ────────────────────────────────────────────────────────────────

app.post('/api/extract-criteria', async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const result = await extractCriteria(jobDescription);
    res.json(result);
  } catch (error) {
    console.error('/api/extract-criteria error:', error);
    res.status(500).json({ error: 'Error al extraer criterios del cargo' });
  }
});

app.post('/api/evaluate-candidate', async (req, res) => {
  try {
    const { cvText, criteria, jobTitle } = req.body;
    const result = await evaluateCandidate(cvText, criteria, jobTitle);
    res.json(result);
  } catch (error) {
    console.error('/api/evaluate-candidate error:', error);
    res.status(500).json({ error: 'Error al evaluar el candidato' });
  }
});

app.post('/api/executive-summary', async (req, res) => {
  try {
    const { evaluations } = req.body;
    const result = await generateExecutiveSummary(evaluations);
    res.json(result);
  } catch (error) {
    console.error('/api/executive-summary error:', error);
    res.status(500).json({ error: 'Error al generar el resumen ejecutivo' });
  }
});

app.post('/api/interview-questions', async (req, res) => {
  try {
    const { candidate, jobDescription } = req.body;
    const result = await generateInterviewQuestions(candidate, jobDescription);
    res.json(result);
  } catch (error) {
    console.error('/api/interview-questions error:', error);
    res.status(500).json({ error: 'Error al generar preguntas de entrevista' });
  }
});

// ─── Archivos estáticos (producción) ─────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en puerto ${PORT}`);
});
