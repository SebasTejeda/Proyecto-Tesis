export interface PatientData {
  nombre_completo: string;
  fecha_nacimiento: string;
  sexo: string;
  telefono?: string;
  tipo_documento: string;
  numero_documento: string;
}

export interface Patient extends PatientData {
  id: number;
  doctor_id: number;
  created_at: string;
}