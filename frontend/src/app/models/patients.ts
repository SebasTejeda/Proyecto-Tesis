export interface PatientData {
    nombre_completo: string;
    fecha_nacimiento: string;
    sexo: string;
    telefono?: string;
}

export interface Patient extends PatientData {
    id: number;
    created_at?: string;
}