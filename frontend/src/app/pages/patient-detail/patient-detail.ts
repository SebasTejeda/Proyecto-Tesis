import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../../services/pdf/pdf';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';
import { Patient } from '../../models/patients';
import { EvaluationResponse } from '../../models/evaluations';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ChartModule, TableModule, ButtonModule, DialogModule, ReactiveFormsModule],
  templateUrl: './patient-detail.html',
  styleUrls: ['./patient-detail.css']
})
export class PatientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pdfService = inject(PdfService);
  private alertService = inject(AlertService);
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  patient = signal<Patient | null>(null);
  historial = signal<EvaluationResponse[]>([]);
  isLoading = signal(true);

  chartData: any;
  chartOptions: any;

  displayModal = signal(false);
  selectedEval = signal<EvaluationResponse | null>(null);
  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  displayEditModal = signal(false);
  editForm = this.fb.nonNullable.group({
    nombre_completo:  ['', [Validators.required, Validators.minLength(3)]],
    dni:              ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
    fecha_nacimiento: ['', [Validators.required]],
    sexo:             ['', [Validators.required]],
    telefono:         [''],
  });

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.cargarDatosReales(Number(idParam));
    } else {
      this.alertService.error('Error', 'No se especificó un paciente válido.');
      this.router.navigate(['/dashboard']);
    }
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

  private parsearFecha(fechaStr: string | null | undefined): Date {
    if (!fechaStr) return new Date(0);
    const corregida = fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z';
    return new Date(corregida);
  }

  cargarDatosReales(patientId: number) {
    this.alertService.loading('Cargando expediente clínico...', true);
    this.patientService.getPatientById(patientId).subscribe({
      next: (pacienteData: Patient) => {
        this.patient.set(pacienteData);
        this.evalService.getPatientEvaluations(patientId).subscribe({
          next: (evaluaciones: EvaluationResponse[]) => {
            this.historial.set(evaluaciones);
            this.prepararGraficoEvolucion(evaluaciones);
            this.alertService.close();
            this.isLoading.set(false);
          },
          error: () => {
            this.alertService.close();
            this.isLoading.set(false);
            this.alertService.error('Error', 'No se pudo cargar el historial.');
          }
        });
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error', 'Paciente no encontrado.');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  prepararGraficoEvolucion(evaluaciones: EvaluationResponse[]) {
    if (!evaluaciones || evaluaciones.length === 0) return;
    const ordenadas = [...evaluaciones]
      .sort((a, b) => this.parsearFecha(a.date).getTime() - this.parsearFecha(b.date).getTime());
    const ultimas5 = ordenadas.slice(-5);
    const labels = ultimas5.map(e =>
      this.parsearFecha(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    );
    const dataPoints = ultimas5.map(e =>
      e.model_prediction?.risk_probability != null
        ? Math.round(e.model_prediction.risk_probability * 100) : 0
    );
    this.initMainChart(labels, dataPoints);
  }

  get ultimaSeverity(): string {
    return this.historial()[0]?.model_prediction?.severity ?? 'Sin evaluar';
  }

  irANuevaEvaluacion() {
    this.router.navigate(['/dashboard/evaluacion'], {
      queryParams: { patientId: this.patient()?.id }
    });
  }

  exportarInformeGeneral() {
    const dataPaciente = this.patient();
    if (!dataPaciente) return;
    const ultimaEval = this.historial()[0];
    if (!ultimaEval) {
      this.alertService.error('Sin datos', 'El paciente no tiene evaluaciones para generar un informe.');
      return;
    }
    const pred = ultimaEval.model_prediction;
    const puntajePorcentaje = pred?.risk_probability != null
      ? Math.round(pred.risk_probability * 100) : 0;
    const datosResultado = {
      riesgoPorcentaje: puntajePorcentaje,
      riesgoEtiqueta: (pred?.severity ?? 'Pendiente').toUpperCase()
    };
    const shapParaPdf = pred?.shap_values
      ? this.buildShapData(pred.shap_values)
      : { labels: ['Pendiente'], datasets: [{ data: [0] }] };
    this.pdfService.generateEvaluationReport(dataPaciente, datosResultado, shapParaPdf);
    this.alertService.success('Informe Generado', 'Descarga iniciada.', true);
  }

  exportarHistorialCompleto() {
    if (this.historial().length === 0) {
      this.alertService.error('Sin datos', 'No hay historial disponible.');
      return;
    }
    const doctorData = this.authService.getUserData();
    const nombreDoctor = doctorData ? `Dr/a. ${doctorData.nombre}` : 'Especialista Médico';
    const pacienteParaPdf = {
      ...this.patient(),
      edad: this.calcularEdad(this.patient()?.fecha_nacimiento)
    };
    const historialFormateado = this.historial().map(e => ({
      fecha: this.parsearFecha(e.date).toLocaleDateString(),
      doctor: nombreDoctor,
      severity: e.model_prediction?.severity ?? 'Pendiente',
      riskProbability: e.model_prediction?.risk_probability ?? 0,
      status: e.status
    }));
    this.pdfService.generateHistoryReport(pacienteParaPdf, historialFormateado);
    this.alertService.success('Historial Exportado', 'Se ha generado el PDF.', true);
  }

  verDetalle(evaluacion: EvaluationResponse) {
    this.selectedEval.set(evaluacion);
    const porcentaje = evaluacion.model_prediction?.risk_probability != null
      ? Math.round(evaluacion.model_prediction.risk_probability * 100) : 0;
    this.initGaugeChart(porcentaje);
    this.initShapChart(evaluacion.model_prediction?.shap_values ?? null);
    this.displayModal.set(true);
  }

  // ── Gráficos ─────────────────────────────────────────────────────────────────

  initMainChart(labels: string[], dataPoints: number[]) {
    this.chartData = {
      labels,
      datasets: [{
        label: 'Nivel de Riesgo (%)',
        data: dataPoints,
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2
      }]
    };
    this.chartOptions = {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { min: 0, max: 100 } }
    };
  }

  initGaugeChart(valor: number) {
    const display = valor || 1;
    this.gaugeData = {
      labels: ['Riesgo', 'Restante'],
      datasets: [{
        data: [display, 100 - display],
        backgroundColor: [valor > 50 ? '#ef4444' : '#10b981', '#e2e8f0'],
        borderWidth: 0, cutout: '85%'
      }]
    };
    this.gaugeOptions = {
      rotation: -90, circumference: 180,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      aspectRatio: 1.5, maintainAspectRatio: false
    };
  }

  initShapChart(shapValues: Record<string, number> | null) {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
      autoestima: 'Autoestima', estado_civil: 'Estado civil', genero: 'Género'
    };

    // Filtrar solo features con nombre legible (excluye estado_civil_1, genero_2, etc.)
    const entradas = shapValues
      ? Object.entries(shapValues).filter(([k]) => labelMap[k] !== undefined)
      : [];

    // Top 6 por valor absoluto
    const top6 = entradas
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 6);

    // Escalar a porcentaje relativo: mayor valor absoluto = 100%
    const maxAbsoluto = top6.length > 0
      ? Math.max(...top6.map(([, v]) => Math.abs(v))) : 1;

    const labels  = top6.map(([k]) => labelMap[k]);
    const valores = top6.map(([, v]) => Math.round((v / maxAbsoluto) * 100));
    const colores = valores.map(v => v >= 0 ? '#ef4444' : '#10b981');

    this.shapData = {
      labels,
      datasets: [{
        label: 'Impacto en el riesgo (%)',
        data: valores,
        backgroundColor: colores,
        borderRadius: 5
      }]
    };

    this.shapOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.raw;
              const signo = val >= 0 ? '+' : '';
              const efecto = val >= 0 ? 'Aumenta el riesgo' : 'Disminuye el riesgo';
              return ` ${efecto}: ${signo}${val}%`;
            }
          }
        }
      },
      scales: {
        x: {
          min: -100, max: 100,
          ticks: { callback: (v: any) => `${v}%` },
          grid: { color: '#f1f5f9' }
        },
        y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
      }
    };
  }

  private buildShapData(shapValues: Record<string, number>) {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
      autoestima: 'Autoestima', estado_civil: 'Estado civil'
    };
    const entries = Object.entries(shapValues)
      .filter(([k]) => labelMap[k] !== undefined)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    return {
      labels: entries.map(([k]) => labelMap[k] ?? k),
      datasets: [{ data: entries.map(([, v]) => v) }]
    };
  }

  // Convierte el nombre técnico de la variable a etiqueta legible
  getLabelFeature(key: string): string {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Frecuencia de ejercicio',
      redes_sociales: 'Redes sociales', nivel_estres: 'Nivel de estrés',
      calidad_sueno: 'Calidad de sueño', soledad_percibida: 'Soledad percibida',
      apoyo_familiar: 'Apoyo familiar', autoestima: 'Autoestima'
    };
    return labelMap[key] ?? key;
  }

  getClassRiesgo(riesgo: string | null | undefined): string {
    if (!riesgo) return 'badge-low';
    const r = riesgo.toLowerCase();
    if (r === 'severo' || r.includes('alto')) return 'badge-high';
    if (r.includes('moderado')) return 'badge-mod';
    return 'badge-low';
  }

  abrirModalEditar() {
    const p = this.patient();
    if (p) {
      this.editForm.patchValue({
        nombre_completo:  p.nombre_completo,
        dni:              p.dni,
        fecha_nacimiento: p.fecha_nacimiento,
        sexo:             p.sexo,
        telefono:         p.telefono ?? ''
      });
      this.displayEditModal.set(true);
    }
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    this.alertService.loading('Actualizando paciente...');
    const id = this.patient()?.id;
    if (!id) return;
    this.patientService.updatePatient(id, this.editForm.getRawValue()).subscribe({
      next: () => {
        this.alertService.success('Actualizado', 'Datos del paciente modificados con éxito.', true);
        this.displayEditModal.set(false);
        this.cargarDatosReales(id);
      },
      error: (err) => {
        const msg = err.error?.detail === 'El DNI ya está registrado.'
          ? 'Este DNI ya pertenece a otro paciente.'
          : 'No se pudo actualizar el paciente.';
        this.alertService.error('Error', msg);
      }
    });
  }

  paginaActual = signal(1);
  itemsPorPagina = 4;

  historialPaginado = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.itemsPorPagina;
    return this.historial().slice(inicio, inicio + this.itemsPorPagina);
  });

  totalPaginas = computed(() =>
    Math.ceil(this.historial().length / this.itemsPorPagina) || 1
  );

  paginaSiguiente() {
    if (this.paginaActual() < this.totalPaginas()) this.paginaActual.update(p => p + 1);
  }

  paginaAnterior() {
    if (this.paginaActual() > 1) this.paginaActual.update(p => p - 1);
  }
}