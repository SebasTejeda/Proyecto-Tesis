export interface EvaluationCreate {
    patient_id: number;
    phq_1: number;
    phq_2: number;
    phq_3: number;
    phq_4: number;
    phq_5: number;
    phq_6: number;
    phq_7: number;
    phq_8: number;
    phq_9: number;
    historial_familiar?: string;
}

// Reemplaza tu EvaluationResponse por este:
export interface EvaluationResponse {
    id: number;
    patient_id: number;
    fecha: string;
    phq9_puntaje: number; // <-- Nuevo nombre
    resultado: string;    // <-- Nuevo nombre
    ia_feedback?: string;
    notas_doctor?: string;
    status: string;
}
