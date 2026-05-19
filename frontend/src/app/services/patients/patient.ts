import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PatientData, Patient } from '../../models/patients';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  createPatient(data: PatientData): Observable<Patient> {
    return this.http.post<Patient>(`${this.apiUrl}/patients/`, data);
  }

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}/patients/`);
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/patients/${id}`);
  }

  updatePatient(id: number, patientData: any): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/patients/${id}`, patientData);
  }
}