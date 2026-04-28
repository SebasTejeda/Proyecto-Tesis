import { Component, OnInit, inject, signal } from '@angular/core';
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


@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ChartModule, TableModule, ButtonModule, DialogModule],
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

  // --- ESTADO CON SIGNALS ---
  patient = signal<any | null>(null);
  historial = signal<any[]>([]);
  isLoading = signal(true);

  // Datos de Gráficos
  chartData: any;
  chartOptions: any;

  // Modal
  displayModal = signal(false);
  selectedEval = signal<any>(null);
  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    // 1. Extraer el ID del paciente de la URL
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.cargarDatosReales(Number(idParam));
    } else {
      this.alertService.error('Error', 'No se especificó un paciente válido.');
      this.router.navigate(['/dashboard']);
    }
  }

  cargarDatosReales(patientId: number) {
    this.alertService.loading('Cargando expediente clínico...', true);
    
    // Primero buscamos al paciente
    this.patientService.getPatientById(patientId).subscribe({
      next: (pacienteData) => {
        this.patient.set(pacienteData);
        
        // Luego buscamos su historial de evaluaciones
        this.evalService.getPatientEvaluations(patientId).subscribe({
          next: (evaluaciones) => {
            this.historial.set(evaluaciones);
            this.prepararGraficoEvolucion(evaluaciones);
            this.alertService.close();
            this.isLoading.set(false);
          },
          error: () => this.alertService.error('Error', 'No se pudo cargar el historial.')
        });
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error', 'Paciente no encontrado o acceso denegado.');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  // Prepara el gráfico de líneas con los datos reales ordenados cronológicamente
  prepararGraficoEvolucion(evaluaciones: any[]) {
    // Si no hay suficientes datos, mostramos vacío
    if (!evaluaciones || evaluaciones.length === 0) return;

    // Clonamos y ordenamos de más antiguo a más reciente para el gráfico
    const ordenadas = [...evaluaciones].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    
    // Tomamos solo las últimas 5 evaluaciones para no saturar el gráfico
    const ultimas5 = ordenadas.slice(-5);

    const labels = ultimas5.map(e => new Date(e.fecha).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const dataPoints = ultimas5.map(e => {
        // Normalizamos el puntaje de PHQ-9 (0-27) a un porcentaje (0-100) para el gráfico
        return Math.round((e.puntaje_total / 27) * 100);
    });

    this.initMainChart(labels, dataPoints);
  }

  // --- ACCIONES DE LOS BOTONES SUPERIORES ---

  irANuevaEvaluacion() {
    this.router.navigate(['/dashboard/evaluacion'], {
      queryParams: { patientId: this.patient()?.id }
    });
  }

  exportarInformeGeneral() {
    const dataPaciente = this.patient();
    if (!dataPaciente) return;

    // Tomamos la evaluación más reciente (que es la primera en el historial)
    const ultimaEval = this.historial()[0];
    
    if (!ultimaEval) {
      this.alertService.error('Sin datos', 'El paciente no tiene evaluaciones para generar un informe.');
      return;
    }

    const puntajePorcentaje = Math.round((ultimaEval.puntaje_total / 27) * 100);
    
    const datosResultadoSimulado = {
      riesgoPorcentaje: puntajePorcentaje,
      riesgoEtiqueta: ultimaEval.nivel_riesgo.toUpperCase()
    };
    
    const shapSimuladoGeneral = {
        labels: ['PHQ-9 Total', 'Historial Familiar'],
        datasets: [{ data: [puntajePorcentaje, 15] }]
    };

    this.pdfService.generateEvaluationReport(dataPaciente, datosResultadoSimulado, shapSimuladoGeneral);
    this.alertService.success('Informe Generado', 'Descarga iniciada.', true);
  }

  exportarHistorialCompleto() {
     if (this.historial().length === 0) {
        this.alertService.error("Sin datos", "No hay historial disponible.");
        return;
     }
     
     // Mapeamos los datos al formato que espera tu PDF Service
     const historialFormateado = this.historial().map(e => ({
         fecha: new Date(e.fecha).toLocaleDateString(),
         doctor: 'Dr/a. Especialista', // Podrías traer el nombre del doctor si lo unes en el backend
         puntaje: Math.round((e.puntaje_total / 27) * 100),
         riesgo: e.nivel_riesgo
     }));

     this.pdfService.generateHistoryReport(this.patient(), historialFormateado);
     this.alertService.success("Historial Exportado", "Se ha generado el PDF.", true);
  }

  verDetalle(evaluacion: any) {
    this.selectedEval.set(evaluacion);
    
    // Normalizamos el puntaje PHQ-9 para los gráficos de porcentaje
    const porcentaje = Math.round((evaluacion.puntaje_total / 27) * 100);
    this.initGaugeChart(porcentaje);
    this.initShapChart(porcentaje);
    
    this.displayModal.set(true);
  }

  // --- CONFIGURACIÓN DE GRÁFICOS ---

  initMainChart(labels: string[], dataPoints: number[]) {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Nivel de Riesgo (%)',
          data: dataPoints,
          fill: true,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2
        }
      ]
    };

    this.chartOptions = { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColorSecondary }, grid: { display: false } }, y: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, min: 0, max: 100 } } };
  }

  initGaugeChart(valor: number) {
    this.gaugeData = { labels: ['Riesgo', 'Restante'], datasets: [{ data: [valor, 100 - valor], backgroundColor: [valor > 50 ? '#ef4444' : '#10b981', '#e2e8f0'], borderWidth: 0, cutout: '85%' }] };
    this.gaugeOptions = { rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } }, aspectRatio: 1.5, maintainAspectRatio: false };
  }

  initShapChart(puntaje: number) {
    const esAlto = puntaje > 50;
    this.shapData = { labels: esAlto ? ['Síntomas Severos', 'Historial Familiar'] : ['Síntomas Leves', 'Sin Historial'], datasets: [{ label: 'Impacto', data: esAlto ? [40, 25] : [-30, -20], backgroundColor: esAlto ? '#ef4444' : '#10b981', borderRadius: 5 }] };
    this.shapOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } };
  }

  getClassRiesgo(riesgo: string): string {
    if (!riesgo) return 'badge-low';
    const r = riesgo.toLowerCase();
    if (r.includes('severo') || r.includes('alto')) return 'badge-high';
    if (r.includes('moderado')) return 'badge-mod';
    return 'badge-low';
  }
}