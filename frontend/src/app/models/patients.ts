export interface PatientData {
    nombre: string;
    edad: number;
    sexo: string;
    telefono?: string;
}

export interface Patient extends PatientData {
    id: number;
    created_at?: string;
}