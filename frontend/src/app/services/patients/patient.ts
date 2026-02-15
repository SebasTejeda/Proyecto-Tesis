import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PatientData {
  nombre: string;
  edad: number;
  sexo: string;
  telefono?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000'; // Tu URL backend

  // Helper para headers con token
  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Crear paciente
  createPatient(data: PatientData): Observable<any> {
    return this.http.post(`${this.apiUrl}/patients/`, data, { headers: this.getHeaders() });
  }

  // Obtener lista de pacientes
  getPatients(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/patients/`, { headers: this.getHeaders() });
  }
}