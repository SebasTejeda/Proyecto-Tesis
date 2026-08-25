import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Table, TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { Patient } from '../../models/patients';
import { EvaluationResponse } from '../../models/evaluations';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

interface PatientRow extends Patient {
  edad: number | string;
  fecha_ultima_eval: string;
  fecha_raw: Date;
  riesgo: string;
  shap_values: Record<string, number> | null;
  total_evaluaciones: number;
}

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, FormsModule],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class ResumenComponent implements OnInit {
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);

  @ViewChild('dt') dt?: Table;

  pacientes = signal<PatientRow[]>([]);
  todasEvaluaciones = signal<EvaluationResponse[]>([]);
  isLoading = signal<boolean>(true);

  mesSeleccionado = signal<number>(new Date().getMonth());
  readonly meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  filtroRiesgo = signal<string>('todos');

  private readonly LABEL_MAP: Record<string, string> = {
    horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
    frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
    nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
    soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
    autoestima: 'Autoestima',
  };

  totalPacientes = computed(() => this.pacientes().length);

  evaluacionesDelMes = computed(() => {
    const mes = this.mesSeleccionado();
    const anio = new Date().getFullYear();
    return this.todasEvaluaciones().filter(e => {
      const fecha = this.parsearFecha(e.date);
      if (!fecha) return false;
      return fecha.getMonth() === mes && fecha.getFullYear() === anio;
    }).length;
  });

  casosAltoRiesgo = computed(() => {
    const mes = this.mesSeleccionado();
    const anio = new Date().getFullYear();
    return this.todasEvaluaciones().filter(e => {
      const fecha = this.parsearFecha(e.date);
      if (!fecha) return false;
      return fecha.getMonth() === mes && fecha.getFullYear() === anio
        && e.model_prediction?.severity === 'Moderado/Alto';
    }).length;
  });

  pacientesFiltrados = computed(() => {
    const filtro = this.filtroRiesgo();
    const conEval = this.pacientes().filter(p => p.riesgo !== 'Sin evaluar');
    if (filtro === 'todos') return conEval;
    return conEval.filter(p => p.riesgo === filtro);
  });

  ngOnInit() { this.cargarPacientes(); }

  calcularEdad(fecha_nacimiento: string | Date | undefined): number | string {
    if (!fecha_nacimiento) return '--';
    const hoy = new Date();
    const fechaNac = new Date(fecha_nacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
    return edad;
  }

  private parsearFecha(fechaStr: string | null | undefined): Date | null {
    if (!fechaStr) return null;
    const corregida = fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z';
    return new Date(corregida);
  }

  getTopFactores(shap: Record<string, number> | null): string {
    if (!shap) return '--';
    const top3 = Object.entries(shap)
      .filter(([k, v]) => this.LABEL_MAP[k] !== undefined && v > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k]) => this.LABEL_MAP[k]);
    return top3.length > 0 ? top3.join(', ') : 'Sin factores de riesgo';
  }

  cargarPacientes() {
    this.isLoading.set(true);
    this.todasEvaluaciones.set([]); // resetear antes de cargar
    this.patientService.getPatients().pipe(
      switchMap((pacientes: Patient[]) => {
        if (!pacientes || pacientes.length === 0) return of([]);
        const peticiones = pacientes.map((p: Patient) =>
          this.evalService.getPatientEvaluations(p.id).pipe(
            catchError(() => of([] as EvaluationResponse[])),
            map((evaluaciones: EvaluationResponse[]) => {
              const ultimaEval = evaluaciones.length > 0 ? evaluaciones[0] : null;
              const prediction = ultimaEval?.model_prediction ?? null;
              const riesgoReal = prediction?.severity ?? 'Sin evaluar';
              const fechaDate = this.parsearFecha(ultimaEval?.date ?? null);

              const todasActuales = this.todasEvaluaciones();
              this.todasEvaluaciones.set([...todasActuales, ...evaluaciones]);

              const row: PatientRow = {
                ...p,
                edad: this.calcularEdad(p.fecha_nacimiento),
                fecha_ultima_eval: fechaDate
                  ? fechaDate.toLocaleDateString('es-PE', { timeZone: 'America/Lima', month: 'short', day: 'numeric' })
                  : 'No registrada',
                fecha_raw: fechaDate ?? new Date(0),
                riesgo: riesgoReal,
                shap_values: prediction?.shap_values ?? null,
                total_evaluaciones: evaluaciones.length,
              };
              return row;
            })
          )
        );
        return forkJoin(peticiones);
      })
    ).subscribe({
      next: (pacientesCompletos: PatientRow[]) => {
        pacientesCompletos.sort((a, b) => b.fecha_raw.getTime() - a.fecha_raw.getTime());
        this.pacientes.set(pacientesCompletos);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.error('Error', 'No se pudieron cargar los datos del panel.');
      },
    });
  }

  getClassRiesgo(riesgo: string): string {
    if (!riesgo) return 'badge-none';
    const r = riesgo.toLowerCase();
    if (r.includes('alto') || r.includes('severo')) return 'badge-high';
    if (r.includes('leve')) return 'badge-mod';
    if (r === 'ninguno') return 'badge-low';
    return 'badge-none';
  }

  // ── Exportar a Excel ─────────────────────────────────────────────────────
  exportarExcel() {
    const filas = (this.dt?.filteredValue as PatientRow[] | null) ?? this.pacientesFiltrados();
    const data = filas.map(p => ({
      'Nombre Completo':     p.nombre_completo,
      'DNI':                 p.dni,
      'Edad':                p.edad,
      'Sexo':                p.sexo,
      'Teléfono':            p.telefono ?? '--',
      'Fecha Registro':      p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '--',
      'Última Evaluación':   p.fecha_ultima_eval,
      'Nivel de Riesgo':     p.riesgo,
      'Total Evaluaciones':  p.total_evaluaciones,
      'Factores Principales': this.getTopFactores(p.shap_values),
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');

    const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    XLSX.writeFile(wb, `NeuroMind_Pacientes_${fecha}.xlsx`);

    this.alertService.success('Excel Generado', 'El archivo fue descargado correctamente.', true);
  }
}