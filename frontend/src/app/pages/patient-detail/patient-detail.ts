import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, RouterModule, ChartModule, TableModule, ButtonModule, DialogModule, ReactiveFormsModule, FormsModule],
  templateUrl: './patient-detail.html',
  styleUrls: ['./patient-detail.css'],
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
  shapData: any;
  shapOptions: any;

  displayEditModal = signal(false);
  editForm = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(3)]],
    dni:             ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
    fecha_nacimiento:['', [Validators.required]],
    sexo:            ['', [Validators.required]],
    telefono:        [''],
  });

  // ── Filtros del historial ─────────────────────────────────────────────────
  filtroNivel = signal<string>('todos');
  readonly nivelesRiesgo = ['todos', 'Moderado/Alto', 'Leve', 'Ninguno'];

  historialFiltrado = computed(() => {
    const f = this.filtroNivel();
    if (f === 'todos') return this.historial();
    return this.historial().filter(e => e.model_prediction?.severity === f);
  });

  // ── Comparación de evaluaciones ───────────────────────────────────────────
  displayCompareModal = signal(false);
  evalASeleccionada = signal<EvaluationResponse | null>(null);
  evalBSeleccionada = signal<EvaluationResponse | null>(null);
  shapDataA: any; shapOptionsA: any;
  shapDataB: any; shapOptionsB: any;
  modoSeleccion = signal<'A' | 'B' | null>(null); // qué slot se está seleccionando

  private readonly SEVERITY_SCORE: Record<string, number> = {
    'Ninguno': 0, 'Leve': 1, 'Moderado/Alto': 2,
  };

  private readonly LABEL_MAP: Record<string, string> = {
    horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
    frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
    nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
    soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
    autoestima: 'Autoestima', estado_civil: 'Estado civil', genero: 'Género',
  };

  constructor() { Chart.register(...registerables); }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) this.cargarDatosReales(Number(idParam));
    else { this.alertService.error('Error', 'No se especificó un paciente válido.'); this.router.navigate(['/dashboard']); }
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

  formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z');
    return fecha.toLocaleString('es-PE', {
      timeZone: 'America/Lima', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
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
          error: () => { this.alertService.close(); this.isLoading.set(false); this.alertService.error('Error', 'No se pudo cargar el historial.'); },
        });
      },
      error: () => { this.alertService.close(); this.alertService.error('Error', 'Paciente no encontrado.'); this.router.navigate(['/dashboard']); },
    });
  }

  prepararGraficoEvolucion(evaluaciones: EvaluationResponse[]) {
    if (!evaluaciones || evaluaciones.length === 0) return;
    const evalValidas = evaluaciones.filter(e => e.doctor_agreement !== 'rejected');
    const base = evalValidas.length > 0 ? evalValidas : evaluaciones;
    const ordenadas = [...base].sort((a, b) => this.parsearFecha(a.date).getTime() - this.parsearFecha(b.date).getTime());
    const ultimas5 = ordenadas.slice(-5);
    const labels = ultimas5.map(e => this.parsearFecha(e.date).toLocaleDateString('es-PE', { timeZone: 'America/Lima', month: 'short', day: 'numeric' }));
    const dataPoints = ultimas5.map(e => this.SEVERITY_SCORE[e.model_prediction?.severity ?? 'Ninguno'] ?? 0);
    this.initMainChart(labels, dataPoints);
  }

  getTopFactores(evaluacion: EvaluationResponse): string {
    const shap = evaluacion.model_prediction?.shap_values;
    if (!shap) return '--';
    const top3 = Object.entries(shap)
      .filter(([k, v]) => this.LABEL_MAP[k] !== undefined && v > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k]) => this.LABEL_MAP[k]);
    return top3.length > 0 ? top3.join(', ') : 'Sin factores de riesgo';
  }

  get ultimaSeverity(): string {
    const valida = this.historial().find(e => e.doctor_agreement !== 'rejected');
    return valida?.model_prediction?.severity ?? 'Sin evaluar';
  }

  irANuevaEvaluacion() {
    this.router.navigate(['/dashboard/evaluacion'], { queryParams: { patientId: this.patient()?.id } });
  }

  exportarInformeGeneral() {
    const dataPaciente = this.patient();
    if (!dataPaciente) return;
    if (this.historial().length === 0) { this.alertService.error('Sin datos', 'El paciente no tiene evaluaciones.'); return; }
    const edad = this.calcularEdad(dataPaciente.fecha_nacimiento);
    this.pdfService.generateConsolidatedReport({ ...dataPaciente, edad }, this.historial());
    this.alertService.success('Informe Consolidado', 'Descarga iniciada.', true);
  }

  exportarEvaluacionIndividual(evaluacion: EvaluationResponse) {
    const dataPaciente = this.patient();
    if (!dataPaciente) return;
    const pred = evaluacion.model_prediction;
    const edad = this.calcularEdad(dataPaciente.fecha_nacimiento);
    this.pdfService.generateEvaluationReport(
      { ...dataPaciente, edad },
      { riesgoPorcentaje: pred?.risk_probability != null ? Math.round(pred.risk_probability * 100) : 0, riesgoEtiqueta: (pred?.severity ?? 'Pendiente').toUpperCase() },
      pred?.shap_values ? this.buildShapData(pred.shap_values) : { labels: ['Sin datos'], datasets: [{ data: [0] }] }
    );
    this.alertService.success('PDF Generado', 'La evaluación fue exportada.', true);
  }

  exportarHistorialCompleto() {
    if (this.historial().length === 0) { this.alertService.error('Sin datos', 'No hay historial disponible.'); return; }
    const doctorData = this.authService.getUserData();
    const nombreDoctor = doctorData ? `Dr/a. ${doctorData.nombre}` : 'Especialista Médico';
    const dataPaciente = this.patient();
    const pacienteParaPdf = { ...dataPaciente, edad: this.calcularEdad(dataPaciente?.fecha_nacimiento) };
    const historialFormateado = this.historial().map(e => ({
      fecha: this.parsearFecha(e.date).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }),
      doctor: nombreDoctor,
      severity: e.model_prediction?.severity ?? 'Pendiente',
      riskProbability: e.model_prediction?.risk_probability ?? 0,
      status: e.status,
    }));
    this.pdfService.generateHistoryReport(pacienteParaPdf, historialFormateado);
    this.alertService.success('Historial Exportado', 'Se ha generado el PDF.', true);
  }

  verDetalle(evaluacion: EvaluationResponse) {
    this.selectedEval.set(evaluacion);
    this.initShapChart(evaluacion.model_prediction?.shap_values ?? null);
    this.displayModal.set(true);
  }

  // ── Comparación ───────────────────────────────────────────────────────────
  abrirComparacion() {
    if (this.historial().length < 2) {
      this.alertService.error('Sin datos', 'El paciente necesita al menos 2 evaluaciones para comparar.');
      return;
    }
    // Pre-seleccionar las 2 más recientes
    this.evalASeleccionada.set(this.historial()[0]);
    this.evalBSeleccionada.set(this.historial()[1]);
    this.actualizarShapComparacion();
    this.displayCompareModal.set(true);
  }

  seleccionarEvalParaComparar(evaluation: EvaluationResponse) {
    if (this.modoSeleccion() === 'A') {
      this.evalASeleccionada.set(evaluation);
    } else if (this.modoSeleccion() === 'B') {
      this.evalBSeleccionada.set(evaluation);
    }
    this.modoSeleccion.set(null);
    this.actualizarShapComparacion();
  }

  actualizarShapComparacion() {
    const evalA = this.evalASeleccionada();
    const evalB = this.evalBSeleccionada();
    if (evalA) this.initShapChartComparacion(evalA.model_prediction?.shap_values ?? null, 'A');
    if (evalB) this.initShapChartComparacion(evalB.model_prediction?.shap_values ?? null, 'B');
  }

  initShapChartComparacion(shapValues: Record<string, number> | null, slot: 'A' | 'B') {
    const entradas = shapValues ? Object.entries(shapValues).filter(([k]) => this.LABEL_MAP[k]) : [];
    const top6 = entradas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const maxAbs = top6.length > 0 ? Math.max(...top6.map(([, v]) => Math.abs(v))) : 1;
    const data = {
      labels: top6.map(([k]) => this.LABEL_MAP[k]),
      datasets: [{ data: top6.map(([, v]) => Math.round((v / maxAbs) * 100)), backgroundColor: top6.map(([, v]) => v >= 0 ? '#ef4444' : '#10b981'), borderRadius: 4 }]
    };
    const options = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { min: -100, max: 100, ticks: { callback: (v: any) => `${v}%` } }, y: { grid: { display: false } } }
    };
    if (slot === 'A') { this.shapDataA = data; this.shapOptionsA = options; }
    else              { this.shapDataB = data; this.shapOptionsB = options; }
  }

  getDiffClass(sevA: string | null | undefined, sevB: string | null | undefined): string {
    const a = this.SEVERITY_SCORE[sevA ?? 'Ninguno'] ?? 0;
    const b = this.SEVERITY_SCORE[sevB ?? 'Ninguno'] ?? 0;
    if (a > b) return 'diff-worse';
    if (a < b) return 'diff-better';
    return 'diff-equal';
  }

  getDiffLabel(sevA: string | null | undefined, sevB: string | null | undefined): string {
    const a = this.SEVERITY_SCORE[sevA ?? 'Ninguno'] ?? 0;
    const b = this.SEVERITY_SCORE[sevB ?? 'Ninguno'] ?? 0;
    if (a > b) return '↑ Empeoró';
    if (a < b) return '↓ Mejoró';
    return '= Sin cambio';
  }

  // ── Gráficos ──────────────────────────────────────────────────────────────
  initMainChart(labels: string[], dataPoints: number[]) {
    this.chartData = {
      labels,
      datasets: [{ label: 'Nivel de Riesgo', data: dataPoints, fill: true, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2 }],
    };
    this.chartOptions = {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` Nivel: ${['Ninguno','Leve','Moderado/Alto'][ctx.raw] ?? ctx.raw}` } } },
      scales: { x: { grid: { display: false } }, y: { min: 0, max: 2, ticks: { stepSize: 1, callback: (v: any) => ['Ninguno','Leve','Moderado/Alto'][v] ?? v } } },
    };
  }

  initShapChart(shapValues: Record<string, number> | null) {
    const entradas = shapValues ? Object.entries(shapValues).filter(([k]) => this.LABEL_MAP[k] !== undefined) : [];
    const top6 = entradas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const maxAbsoluto = top6.length > 0 ? Math.max(...top6.map(([, v]) => Math.abs(v))) : 1;
    this.shapData = {
      labels: top6.map(([k]) => this.LABEL_MAP[k]),
      datasets: [{ label: 'Impacto (%)', data: top6.map(([, v]) => Math.round((v / maxAbsoluto) * 100)), backgroundColor: top6.map(([, v]) => v >= 0 ? '#ef4444' : '#10b981'), borderRadius: 5 }],
    };
    this.shapOptions = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.raw >= 0 ? 'Aumenta' : 'Disminuye'} el riesgo: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } } },
      scales: { x: { min: -100, max: 100, ticks: { callback: (v: any) => `${v}%` }, grid: { color: '#f1f5f9' } }, y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } } },
    };
  }

  private buildShapData(shapValues: Record<string, number>) {
    const entries = Object.entries(shapValues).filter(([k]) => this.LABEL_MAP[k] !== undefined).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    return { labels: entries.map(([k]) => this.LABEL_MAP[k] ?? k), datasets: [{ data: entries.map(([, v]) => v) }] };
  }

  getLabelFeature(key: string): string { return this.LABEL_MAP[key] ?? key; }

  getClassRiesgo(riesgo: string | null | undefined): string {
    if (!riesgo) return 'badge-low';
    const r = riesgo.toLowerCase();
    if (r.includes('alto') || r.includes('severo')) return 'badge-high';
    if (r.includes('moderado') || r.includes('leve')) return 'badge-mod';
    return 'badge-low';
  }

  abrirModalEditar() {
    const p = this.patient();
    if (p) {
      this.editForm.patchValue({ nombre_completo: p.nombre_completo, dni: p.dni, fecha_nacimiento: p.fecha_nacimiento, sexo: p.sexo, telefono: p.telefono ?? '' });
      this.displayEditModal.set(true);
    }
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    this.alertService.loading('Actualizando paciente...');
    const id = this.patient()?.id;
    if (!id) return;
    this.patientService.updatePatient(id, this.editForm.getRawValue()).subscribe({
      next: () => { this.alertService.success('Actualizado', 'Datos modificados con éxito.', true); this.displayEditModal.set(false); this.cargarDatosReales(id); },
      error: (err) => { this.alertService.error('Error', err.error?.detail === 'El DNI ya está registrado.' ? 'Este DNI ya pertenece a otro paciente.' : 'No se pudo actualizar el paciente.'); },
    });
  }

  paginaActual = signal(1);
  itemsPorPagina = 4;
  historialPaginado = computed(() => { const inicio = (this.paginaActual() - 1) * this.itemsPorPagina; return this.historial().slice(inicio, inicio + this.itemsPorPagina); });
  totalPaginas = computed(() => Math.ceil(this.historial().length / this.itemsPorPagina) || 1);
  paginaSiguiente() { if (this.paginaActual() < this.totalPaginas()) this.paginaActual.update(p => p + 1); }
  paginaAnterior() { if (this.paginaActual() > 1) this.paginaActual.update(p => p - 1); }
}