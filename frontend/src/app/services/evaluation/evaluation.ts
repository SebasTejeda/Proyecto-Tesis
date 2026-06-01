import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EvaluationCreate, EvaluationResponse } from '../../models/evaluations';

export interface EjecucionModelo {
  evaluation_id: number;
  fecha: string;
  paciente_nombre: string;
  paciente_dni: string;
  doctor_nombre: string;
  modelo: string;
  model_version: string;
  resultado: string | null;
  risk_probability: number | null;
  doctor_agreement: string | null;
  disagreement_reason: string | null;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  createEvaluation(data: EvaluationCreate): Observable<EvaluationResponse> {
    return this.http.post<EvaluationResponse>(`${this.apiUrl}/evaluations/`, data);
  }

  getPatientEvaluations(patientId: number): Observable<EvaluationResponse[]> {
    return this.http.get<EvaluationResponse[]>(`${this.apiUrl}/evaluations/patient/${patientId}`);
  }

  getEvaluationById(id: number): Observable<EvaluationResponse> {
    return this.http.get<EvaluationResponse>(`${this.apiUrl}/evaluations/${id}`);
  }

  // US007 — conformidad con razón de desacuerdo
  updateAgreement(
    evaluationId: number,
    agreement: 'confirmed' | 'rejected',
    disagreementReason?: string
  ): Observable<EvaluationResponse> {
    return this.http.patch<EvaluationResponse>(
      `${this.apiUrl}/evaluations/${evaluationId}/agreement`,
      { doctor_agreement: agreement, disagreement_reason: disagreementReason ?? null }
    );
  }

  // Doctor: su propio historial
  getHistorialEjecuciones(): Observable<EjecucionModelo[]> {
    return this.http.get<EjecucionModelo[]>(`${this.apiUrl}/evaluations/historial`);
  }

  // Admin: historial de todos los doctores
  getHistorialAdmin(): Observable<EjecucionModelo[]> {
    return this.http.get<EjecucionModelo[]>(`${this.apiUrl}/evaluations/admin/historial`);
  }
}