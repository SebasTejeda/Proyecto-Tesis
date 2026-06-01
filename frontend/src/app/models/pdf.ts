import { ModelPredictionResponse, RecommendationResponse } from './evaluations';

export interface PatientPdfInfo {
  id?: number;
  nombre_completo?: string;
  nombre?: string;
  edad?: number | string;
  fecha_nacimiento?: string | Date;
  sexo?: string;
  telefono?: string;
}

export interface EvaluationResult {
  riesgoPorcentaje: number;   // risk_probability * 100
  riesgoEtiqueta: string;     // severity del model_prediction
  riesgoBinario?: number;      // risk_binary (0 o 1)
}

// Para el gráfico de barras SHAP en el PDF
export interface ShapData {
  labels: string[];
  datasets: { data: number[] }[];
}

// Una fila del historial de evaluaciones en el PDF
export interface HistoryItem {
  fecha: string;
  doctor: string;
  severity?: string;
  riesgo?: string;
  riskProbability: number;
  status: string;
}

// Interface auxiliar para construir el PDF completo de una evaluación
export interface EvaluationPdfData {
  patient: PatientPdfInfo;
  result: EvaluationResult;
  prediction: ModelPredictionResponse | null;
  recommendations: RecommendationResponse[];
  shapData: ShapData | null;
  history: HistoryItem[];
}