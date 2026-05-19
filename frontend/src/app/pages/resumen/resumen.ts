import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { Patient } from '../../models/patients';
import { EvaluationResponse } from '../../models/evaluations';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

// Interface local para las filas de la tabla
interface PatientRow extends Patient {
  edad: number | string;
  fecha_ultima_eval: string;
  fecha_raw: Date;
  prob: number;
  riesgo: string;
}

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class ResumenComponent implements OnInit {
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);

  pacientes = signal<PatientRow[]>([]);
  totalPacientes = signal<number>(0);
  evaluacionesHoy = signal<number>(0);
  casosAltoRiesgo = signal<number>(0);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.cargarPacientes();
  }

  calcularEdad(fecha_nacimiento: string | Date | undefined): number | string {
    if (!fecha_nacimiento) return '--';
    const hoy = new Date();
    const fechaNac = new Date(fecha_nacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
    return edad;
  }

  private parsearFecha(fechaStr: string | null): Date | null {
    if (!fechaStr) return null;
    // Corrige zona horaria agregando 'Z' si no viene con timezone
    const corregida = fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z';
    return new Date(corregida);
  }

  cargarPacientes() {
    this.isLoading.set(true);

    this.patientService.getPatients().pipe(
      switchMap((pacientes: Patient[]) => {
        if (!pacientes || pacientes.length === 0) return of([]);

        const peticiones = pacientes.map((p: Patient) =>
          this.evalService.getPatientEvaluations(p.id).pipe(
            catchError(() => of([] as EvaluationResponse[])),
            map((evaluaciones: EvaluationResponse[]) => {
              // El backend devuelve evaluaciones ordenadas de más nueva a más vieja
              const ultimaEval = evaluaciones.length > 0 ? evaluaciones[0] : null;

              // ── Nuevo backend: riesgo y probabilidad viven en model_prediction ──
              const prediction = ultimaEval?.model_prediction ?? null;

              const porcentaje = prediction?.risk_probability != null
                ? Math.round(prediction.risk_probability * 100)
                : 0;

              const riesgoReal = prediction?.severity ?? 'Sin evaluar';

              // Usamos el nuevo campo 'date' en lugar de 'fecha'
              const fechaDate = this.parsearFecha(ultimaEval?.date ?? null);

              const row: PatientRow = {
                ...p,
                edad: this.calcularEdad(p.fecha_nacimiento),
                fecha_ultima_eval: fechaDate
                  ? fechaDate.toLocaleDateString()
                  : 'No registrada',
                fecha_raw: fechaDate ?? new Date(0),
                prob: porcentaje,
                riesgo: riesgoReal,
              };

              return row;
            })
          )
        );

        return forkJoin(peticiones);
      })
    ).subscribe({
      next: (pacientesCompletos: PatientRow[]) => {
        // Más recientes primero
        pacientesCompletos.sort(
          (a, b) => b.fecha_raw.getTime() - a.fecha_raw.getTime()
        );

        this.pacientes.set(pacientesCompletos);
        this.totalPacientes.set(pacientesCompletos.length);

        // Alto riesgo: severity === 'Severo' exacto (no incluye Moderado)
        const casosAltos = pacientesCompletos.filter(
          (p) => p.riesgo.toLowerCase() === 'severo'
        ).length;
        this.casosAltoRiesgo.set(casosAltos);

        // Evaluaciones realizadas hoy
        const hoy = new Date().toLocaleDateString();
        const evHoy = pacientesCompletos.filter(
          (p) => p.fecha_ultima_eval === hoy
        ).length;
        this.evaluacionesHoy.set(evHoy);

        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.error('Error', 'No se pudieron cargar los datos del panel.');
        console.error(err);
      }
    });
  }

  getClassRiesgo(riesgo: string): string {
    if (!riesgo) return 'badge-low';
    const r = riesgo.toLowerCase();
    if (r === 'severo') return 'badge-high';
    if (r.includes('moderado')) return 'badge-mod';
    if (r === 'sin evaluar') return 'badge-gray';
    return 'badge-low';
  }
}