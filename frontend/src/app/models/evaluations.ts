export interface ModelFeaturesCreate {
  horas_sueno?: number;
  vida_social?: number;
  frecuencia_ejercicio?: number;
  redes_sociales?: number;
  nivel_estres?: number;
  calidad_sueno?: number;
  soledad_percibida?: number;
  apoyo_familiar?: number;
  autoestima?: number;
  estado_civil?: number;
}

export interface EvaluationCreate {
  patient_id: number;
  doctor_notes?: string;
  model_features: ModelFeaturesCreate;
}

export interface ModelFeaturesResponse extends ModelFeaturesCreate {
  id: number;
  evaluation_id: number;
  genero?: number;       // 1=Masculino, 2=Femenino — viene del backend
  created_at: string;
}

export interface ModelPredictionResponse {
  id: number;
  evaluation_id: number;
  risk_binary: number | null;
  risk_probability: number | null;
  severity: string | null;
  severity_probability: number | null;
  shap_values: Record<string, number> | null;  // {"nivel_estres": 0.41, "horas_sueno": 0.23, ...}
  created_at: string;
}

export interface RecommendationResponse {
  id: number;
  evaluation_id: number;
  source_variable: string;
  alert_level: string;
  recommendation: string;
  priority: number;
  created_at: string;
}

export interface EvaluationResponse {
  id: number;
  patient_id: number;
  doctor_id: number;
  date: string;
  status: string;
  doctor_notes?: string;
  doctor_agreement?: string | null;
  created_at: string;

  model_features?: ModelFeaturesResponse;
  model_prediction?: ModelPredictionResponse;
  recommendations?: RecommendationResponse[];
}

export interface EjecucionModelo {
  evaluation_id: number;
  fecha: string;
  paciente_nombre: string;
  paciente_dni: string;
  doctor_nombre: string;
  modelo: string;
  resultado: string | null;
  risk_probability: number | null;
  doctor_agreement: string | null;
  status: string;
}