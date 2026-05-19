export interface PatientData {
  nombre_completo: string;
  fecha_nacimiento: string;
  sexo: string;
  telefono?: string;
  dni:string;
}

export interface Patient extends PatientData {
  id: number;
  doctor_id: number;
  created_at: string;
}