import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EjecucionModelo, EvaluationCreate, EvaluationResponse } from '../../models/evaluations';

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  createEvaluation(data: EvaluationCreate): Observable<EvaluationResponse> {
    return this.http.post<EvaluationResponse>(
      `${this.apiUrl}/evaluations/`,
      data,
    );
  }

  getPatientEvaluations(patientId: number): Observable<EvaluationResponse[]> {
    return this.http.get<EvaluationResponse[]>(
      `${this.apiUrl}/evaluations/patient/${patientId}`,
    );
  }

  getEvaluationById(evaluationId: number): Observable<EvaluationResponse> {
    return this.http.get<EvaluationResponse>(
      `${this.apiUrl}/evaluations/${evaluationId}`,
    );
  }

  updateAgreement(
    evaluationId: number,
    agreement: 'confirmed' | 'rejected',
  ): Observable<EvaluationResponse> {
    return this.http.patch<EvaluationResponse>(
      `${this.apiUrl}/evaluations/${evaluationId}/agreement`,
      { doctor_agreement: agreement },
    );
  }

  getHistorialEjecuciones(): Observable<EjecucionModelo[]> {
    return this.http.get<EjecucionModelo[]>(
      `${this.apiUrl}/evaluations/historial`,
    );
  }
}
