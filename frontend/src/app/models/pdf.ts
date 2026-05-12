export interface PatientPdfInfo {
    id?: number;
    nombre_completo?: string;
    nombre?: string;
    edad?: number | string;
    sexo?: string; // <-- AÑADIDO
    telefono?: string; // <-- AÑADIDO
}

export interface EvaluationResult {
    riesgoPorcentaje: number;
    riesgoEtiqueta: string;
}

export interface ShapData {
    labels: string[];
    datasets: { data: number[] }[];
}

export interface HistoryItem {
    fecha: string;
    doctor: string;
    puntaje: number | string;
    riesgo: string;
}
