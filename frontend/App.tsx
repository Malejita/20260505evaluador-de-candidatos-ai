/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText,
  Upload,
  Search,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  Briefcase,
  Users,
  Star,
  RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

import { parseFile } from './lib/fileParser';
import {
  extractCriteriaFromJD,
  evaluateCandidate,
  generateExecutiveSummary,
  generateInterviewQuestions,
  type JDCriteria,
  type CandidateEvaluation,
  type InterviewCategory,
} from './services/apiClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // State
  const [jobTitle, setJobTitle] = useState('');
  const [jdRaw, setJdRaw] = useState('');
  const [criteria, setCriteria] = useState<JDCriteria>({
    experience: '',
    skills: '',
    education: '',
    achievements: ''
  });
  const [isExtractingJD, setIsExtractingJD] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  
  const [evaluations, setEvaluations] = useState<CandidateEvaluation[]>([]);
  const [processedFileNames, setProcessedFileNames] = useState<Set<string>>(new Set());
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentView, setCurrentView] = useState<'evaluation' | 'interview'>('evaluation');
  const [interviewQuestions, setInterviewQuestions] = useState<Record<string, InterviewCategory[]>>({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Handlers
  const handleExtractJD = async () => {
    if (!jdRaw.trim()) {
      setError('Por favor ingrese la descripción del cargo.');
      return;
    }
    setIsExtractingJD(true);
    setError(null);
    try {
      const extracted = await extractCriteriaFromJD(jdRaw);
      setCriteria(extracted);
      setHasExtracted(true);
    } catch (err: any) {
      setError('Error al extraer criterios: ' + err.message);
    } finally {
      setIsExtractingJD(false);
    }
  };

  const handleClearCriteria = () => {
    setCriteria({ experience: '', skills: '', education: '', achievements: '' });
    setHasExtracted(false);
  };

  const toggleCandidateSelection = (name: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedCandidates(newSelected);
  };

  const handleGoToInterview = async () => {
    if (selectedCandidates.size === 0) {
      setError('Debe seleccionar al menos un candidato para la siguiente fase.');
      return;
    }

    setIsGeneratingQuestions(true);
    setError(null);
    try {
      const selectedEvals = evaluations.filter(ev => selectedCandidates.has(ev.name));
      const questionsMap: Record<string, InterviewCategory[]> = { ...interviewQuestions };
      
      for (const candidate of selectedEvals) {
        if (!questionsMap[candidate.name]) {
          const questions = await generateInterviewQuestions(candidate, jdRaw);
          questionsMap[candidate.name] = questions;
        }
      }
      
      setInterviewQuestions(questionsMap);
      setCurrentView('interview');
      window.scrollTo(0, 0);
    } catch (err: any) {
      setError('Error al generar preguntas de entrevista: ' + err.message);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!hasExtracted) {
      setError('Primero debe extraer y verificar los criterios de la descripción del cargo.');
      return;
    }

    const incomingFiles = Array.from(files);
    const newFiles = incomingFiles.filter(f => !processedFileNames.has(f.name));
    
    if (newFiles.length === 0) {
      setError('Los archivos seleccionados ya han sido procesados.');
      return;
    }

    if (newFiles.length < incomingFiles.length) {
      setError('Se omitieron archivos duplicados.');
    } else {
      setError(null);
    }

    setIsEvaluating(true);
    const newEvaluations: CandidateEvaluation[] = [];
    const newlyProcessedNames = new Set(processedFileNames);

    try {
      for (const file of newFiles) {
        try {
          const text = await parseFile(file);
          const evaluation = await evaluateCandidate(text, criteria, jobTitle, evaluations.length + newFiles.length);
          newEvaluations.push(evaluation);
          newlyProcessedNames.add(file.name);
        } catch (fileErr: any) {
          console.error(`Error processing file ${file.name}:`, fileErr);
          setError(`Error procesando ${file.name}: ${fileErr.message}`);
        }
      }
      setEvaluations(prev => [...prev, ...newEvaluations]);
      setProcessedFileNames(newlyProcessedNames);
    } catch (err: any) {
      setError('Error general al evaluar candidatos: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  };

  const generateSummary = async () => {
    if (evaluations.length === 0) return;
    setIsGeneratingSummary(true);
    try {
      const summary = await generateExecutiveSummary(evaluations);
      setExecutiveSummary(summary);
      setShowSummaryModal(true);
    } catch (err: any) {
      setError('Error al generar resumen ejecutivo.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const clearResults = () => {
    setEvaluations([]);
    setExecutiveSummary('');
    setProcessedFileNames(new Set());
    setError(null);
  };

  const sortedEvaluations = [...evaluations].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Sistema Reclutamiento Inteligente 
              <span className="text-blue-600 font-medium text-[10px] px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100 uppercase">v1.0 Recruiter AI</span>
            </h1>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Módulo de Reclutamiento Activo
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {currentView === 'evaluation' ? (
          <>
            {/* Sidebar: Job Description */}
        <aside className="w-[40%] bg-white border-r border-slate-200 flex flex-col overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 shrink-0">
          {/* Nombre del Cargo */}
          <div className="p-4 border-b border-slate-100">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Nombre del Cargo</label>
            <input 
              type="text" 
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Senior Web Developer"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition-all"
            />
          </div>

          {/* Perfil del Candidato */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perfil del Candidato</label>
              <textarea 
                rows={4}
                value={jdRaw}
                onChange={(e) => setJdRaw(e.target.value)}
                placeholder="Pegue aquí la descripción completa del cargo..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed transition-all"
              />
            </div>
            <button 
              onClick={handleExtractJD}
              disabled={isExtractingJD || !jdRaw.trim()}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98]"
            >
              {isExtractingJD ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Completar Criterios Siguiente Sección</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Criterios del cargo */}
          <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Criterios del Cargo</label>
              {hasExtracted && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                    <CheckCircle className="w-3 h-3" /> EXTRAÍDO
                  </span>
                  <button
                    onClick={handleClearCriteria}
                    title="Limpiar criterios extraídos"
                    className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded transition-all border border-slate-200 hover:border-red-200"
                  >
                    <X className="w-2.5 h-2.5" />
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            {hasExtracted && criteria.dataQuality && !criteria.dataQuality.toLowerCase().includes('suficiente') && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">{criteria.dataQuality}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Experiencia Requerida', value: criteria.experience },
                { label: 'Habilidades Técnicas',  value: criteria.skills },
                { label: 'Formación Académica',   value: criteria.education },
                { label: 'Logros o Competencias', value: criteria.achievements },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                  <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-1.5">{label}</p>
                  {value
                    ? <p className="text-[11px] text-slate-700 leading-snug font-medium whitespace-pre-wrap">{value}</p>
                    : <p className="text-[11px] text-slate-300 italic">No especificado en la descripción.</p>
                  }
                </div>
              ))}
            </div>

            {!hasExtracted && !isExtractingJD && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-300 gap-2 border-2 border-dashed border-slate-200 rounded-lg bg-white/50">
                <Search className="w-8 h-8 opacity-20" />
                <p className="text-[9px] font-bold uppercase tracking-tighter">Ingrese perfil arriba para completar</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col overflow-hidden bg-white">
          {error && (
            <div className="px-6 pt-4 shrink-0">
              <div className="p-3 bg-red-50 border border-red-100 rounded text-red-600 text-[11px] font-medium flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Action Header: Unified Add Button and Evaluation Results */}
          <div className="px-6 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30 shrink-0">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Gestión de Candidatos
              </h2>
              {evaluations.length > 0 && (
                <p className="text-[10px] text-slate-400 font-medium">{evaluations.length} perfiles evaluados hasta el momento</p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                accept=".pdf,.docx,.txt"
              />
              <button
                onClick={() => hasExtracted ? fileInputRef.current?.click() : setError('Configure los criterios primero')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm",
                  hasExtracted 
                    ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Sumar Hojas de Vida
              </button>
              
              {evaluations.length > 0 && (
                <button 
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {isGeneratingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  Reporte Ejecutivo
                </button>
              )}
            </div>
          </div>

          {/* Content Body: SCROLLABLE AREA */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
            {isEvaluating && (
              <div className="mx-6 mt-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Analizando perfiles mediante IA...</span>
              </div>
            )}

            {evaluations.length > 0 ? (
              <div className="flex flex-col p-6 gap-6">
                {/* Table Section */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Escalafón de Candidatos</h3>
                    <button 
                      onClick={clearResults}
                      className="text-[9px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-tighter transition-colors"
                    >
                      Reiniciar Evaluación
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4 border-b border-slate-200 w-10 text-center">Fase</th>
                          <th className="px-6 py-4 border-b border-slate-200">Candidato</th>
                          <th className="px-6 py-4 border-b border-slate-200 text-center">Score</th>
                          <th className="px-6 py-4 border-b border-slate-200">Recomendación</th>
                          <th className="px-6 py-4 border-b border-slate-200">Fortaleza Principal</th>
                          <th className="px-6 py-4 border-b border-slate-200">Brecha</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {sortedEvaluations.map((ev, i) => (
                          <tr key={i} className="hover:bg-blue-50/20 border-b border-slate-100 group transition-colors">
                            <td className="px-6 py-4 text-center">
                              <input 
                                type="checkbox"
                                checked={selectedCandidates.has(ev.name)}
                                onChange={() => toggleCandidateSelection(ev.name)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                  i === 0 ? "bg-yellow-100 text-yellow-700 border border-yellow-200" : "bg-slate-100 text-slate-400"
                                )}>
                                  {i + 1}
                                </span>
                                {ev.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm",
                                ev.score >= 8 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                ev.score >= 6 ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                "bg-rose-50 text-rose-600 border border-rose-100"
                              )}>
                                {ev.score}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded font-bold uppercase text-[9px] border",
                                ev.recommendation === 'Avanzar' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                ev.recommendation === 'Considerar' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {ev.recommendation}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 max-w-[200px]">
                              <p className="line-clamp-2 leading-relaxed">{ev.strengths}</p>
                            </td>
                            <td className="px-6 py-4 text-slate-400 italic max-w-[200px]">
                              <p className="line-clamp-2 leading-relaxed">{ev.gaps}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedCandidates.size > 0 && (
                    <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleGoToInterview}
                        disabled={isGeneratingQuestions}
                        className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-[0.2em] shadow-xl shadow-emerald-200/50 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {isGeneratingQuestions ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                        Siguiente fase: Entrevista ({selectedCandidates.size})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 p-12">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem] p-20 flex flex-col items-center gap-6"
                >
                  <div className="bg-white p-8 rounded-full shadow-2xl shadow-slate-200 relative group">
                     <FileText className="w-20 h-20 text-slate-200 group-hover:text-blue-500 transition-colors" />
                     <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-3 rounded-full border-4 border-white shadow-lg animate-bounce">
                        <Upload className="w-5 h-5" />
                     </div>
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-base font-bold text-slate-800 uppercase tracking-[0.2em]">Cargar Candidatos</p>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-medium">
                      Configure el perfil a la izquierda y sume las hojas de vida (.pdf, .docx, .txt) para iniciar el análisis comparativo automática.
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </section>
          </>
        ) : (
          <InterviewView
            candidates={evaluations.filter(ev => selectedCandidates.has(ev.name))}
            questions={interviewQuestions}
            jobTitle={jobTitle}
            onBack={() => setCurrentView('evaluation')}
          />
        )}
      </main>

      {/* Modal: Reporte Ejecutivo */}
      <AnimatePresence>
        {showSummaryModal && executiveSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSummaryModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Reporte Estratégico AI</h3>
                    <p className="text-[10px] text-blue-200 mt-0.5">{evaluations.length} candidatos evaluados</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
                  <ReactMarkdown>{executiveSummary}</ReactMarkdown>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <button
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3 h-3", isGeneratingSummary && "animate-spin")} />
                  Regenerar reporte
                </button>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const categoryStyles = {
  FORTALEZA: {
    headerColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
    numBg: 'bg-emerald-100',
    numText: 'text-emerald-700',
    Icon: Star,
  },
  BRECHA: {
    headerColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
    numBg: 'bg-amber-100',
    numText: 'text-amber-700',
    Icon: AlertCircle,
  },
  MOTIVACIÓN: {
    headerColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
    numBg: 'bg-blue-100',
    numText: 'text-blue-700',
    Icon: TrendingUp,
  },
  SITUACIONAL: {
    headerColor: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-100',
    numBg: 'bg-violet-100',
    numText: 'text-violet-700',
    Icon: BookOpen,
  },
};

function buildInterviewText(
  candidate: CandidateEvaluation,
  categories: InterviewCategory[],
  jobTitle: string
): string {
  const date = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const sep = '─'.repeat(52);
  const lines: string[] = [
    'GUÍA DE ENTREVISTA',
    `Candidato : ${candidate.name}`,
    jobTitle ? `Cargo     : ${jobTitle}` : '',
    `Score     : ${candidate.score}/10  |  Recomendación: ${candidate.recommendation}`,
    `Fecha     : ${date}`,
    '',
    sep,
    '',
    'FORTALEZAS DESTACADAS',
    candidate.strengths,
    '',
    'BRECHAS A VALIDAR',
    candidate.gaps,
    '',
    sep,
    '',
  ];
  for (const cat of categories) {
    lines.push(cat.label.toUpperCase());
    cat.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }
  return lines.filter(l => l !== undefined).join('\n').trim();
}

function InterviewView({ candidates, questions, jobTitle, onBack }: {
  candidates: CandidateEvaluation[],
  questions: Record<string, InterviewCategory[]>,
  jobTitle: string,
  onBack: () => void
}) {
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  const handleCopy = async (candidate: CandidateEvaluation) => {
    const cats = questions[candidate.name];
    if (!cats) return;
    await navigator.clipboard.writeText(buildInterviewText(candidate, cats, jobTitle));
    setCopiedFor(candidate.name);
    setTimeout(() => setCopiedFor(null), 2000);
  };

  const handleDownload = (candidate: CandidateEvaluation) => {
    const cats = questions[candidate.name];
    if (!cats) return;
    const text = buildInterviewText(candidate, cats, jobTitle);
    const date = new Date().toISOString().split('T')[0];
    const safeName = candidate.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Entrevista_${safeName}_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Siguiente Fase: Entrevista
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">Guía de preguntas personalizada por candidato</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-bold uppercase tracking-wider">
          {candidates.length} Seleccionados
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {candidates.map((candidate, idx) => (
            <motion.div
              key={candidate.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Encabezado del candidato */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {candidate.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{candidate.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-blue-600">Score: {candidate.score}/10</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Recomendación: {candidate.recommendation}</span>
                  </div>
                </div>
              </div>

              {/* Resumen del perfil */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Star className="w-3 h-3 text-emerald-500" />
                    Fortalezas Destacadas
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-50">
                    {candidate.strengths}
                  </p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                    Brechas a Validar
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/40 p-3 rounded-xl border border-rose-50 italic">
                    {candidate.gaps}
                  </p>
                </div>
              </div>

              {/* Preguntas organizadas por categoría */}
              <div className="p-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Guía de Preguntas para la Entrevista
                </h4>

                {questions[candidate.name] ? (
                  <div className="space-y-6">
                    {questions[candidate.name].map((category, catIdx) => {
                      const style = categoryStyles[category.name as keyof typeof categoryStyles] || categoryStyles.SITUACIONAL;
                      const Icon = style.Icon;
                      return (
                        <div key={catIdx}>
                          <h5 className={`text-[10px] font-bold uppercase tracking-widest ${style.headerColor} flex items-center gap-2 mb-3`}>
                            <Icon className="w-3 h-3" />
                            {category.label}
                          </h5>
                          <div className="space-y-2">
                            {category.questions.map((q, qIdx) => (
                              <div key={qIdx} className={`flex gap-3 items-start p-3 ${style.bgColor} border ${style.borderColor} rounded-xl`}>
                                <span className={`w-5 h-5 rounded-md ${style.numBg} ${style.numText} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5`}>
                                  {qIdx + 1}
                                </span>
                                <p className="text-xs text-slate-700 leading-relaxed">{q}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400 italic py-4">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[10px]">Generando preguntas personalizadas...</span>
                  </div>
                )}

                {/* Botones de exportación */}
                {questions[candidate.name] && (
                  <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                    <button
                      onClick={() => handleCopy(candidate)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      {copiedFor === candidate.name ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5" />
                          Copiar preguntas
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownload(candidate)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <Award className="w-3.5 h-3.5" />
                      Descargar .txt
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

