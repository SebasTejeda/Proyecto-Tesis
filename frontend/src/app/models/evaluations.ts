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

export interface EvaluationResponse extends EvaluationCreate {
    id: number;
    puntaje_total: number;
    nivel_riesgo: string;
    resultado_ia?: string;
    fecha: string;
}
