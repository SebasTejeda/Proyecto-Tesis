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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';

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

  displayEditModal = signal(false);
  editForm = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(3)]],
    fecha_nacimiento: ['', [Validators.required]],
    sexo: ['', [Validators.required]],
    telefono: [''],
  })

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

  // NUEVA FUNCIÓN: Calcula la edad basada en la fecha de nacimiento
  calcularEdad(fecha_nacimiento: string | Date | undefined): number | string {
    if (!fecha_nacimiento) return '--';
    const hoy = new Date();
    const fechaNac = new Date(fecha_nacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  cargarDatosReales(patientId: number) {
    this.alertService.loading('Cargando expediente clínico...', true);
    
    this.patientService.getPatientById(patientId).subscribe({
      next: (pacienteData) => {
        this.patient.set(pacienteData);
        
        this.evalService.getPatientEvaluations(patientId).subscribe({
          next: (evaluaciones) => {
            // ---> SOLUCIÓN DE LA HORA: Convertimos a UTC agregando la 'Z' <---
            const evaluacionesConHoraLocal = evaluaciones.map(e => ({
                ...e, 
                fecha: e.fecha.endsWith('Z') ? e.fecha : e.fecha + 'Z' 
            }));

            // Usamos las evaluaciones arregladas
            this.historial.set(evaluacionesConHoraLocal);
            this.prepararGraficoEvolucion(evaluacionesConHoraLocal);
            // ----------------------------------------------------------------
            
            this.alertService.close();
            this.isLoading.set(false);
          },
          error: () => this.alertService.error('Error', 'No se pudo cargar el historial.')
        });
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error', 'Paciente no encontrado.');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  prepararGraficoEvolucion(evaluaciones: any[]) {
    if (!evaluaciones || evaluaciones.length === 0) return;

    const ordenadas = [...evaluaciones].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const ultimas5 = ordenadas.slice(-5);

    const labels = ultimas5.map(e => new Date(e.fecha).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const dataPoints = ultimas5.map(e => {
        // CORRECCIÓN: Usamos phq9_puntaje en vez de puntaje_total
        return Math.round((e.phq9_puntaje / 27) * 100);
    });

    this.initMainChart(labels, dataPoints);
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

    // CORRECCIÓN: Usamos phq9_puntaje y resultado
    const puntajePorcentaje = Math.round((ultimaEval.phq9_puntaje / 27) * 100);
    
    const datosResultadoSimulado = {
      riesgoPorcentaje: puntajePorcentaje,
      riesgoEtiqueta: ultimaEval.resultado.toUpperCase()
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
   
   const doctorData = this.authService.getUserData();
   const nombreDoctor = doctorData ? `Dr/a. ${doctorData.nombre}` : 'Especialista Médico';

   // --- LA CLAVE: Preparamos el objeto con la edad calculada ---
   const pacienteParaPdf = {
      ...this.patient(),
      edad: this.calcularEdad(this.patient()?.fecha_nacimiento)
   };

   const historialFormateado = this.historial().map(e => ({
      fecha: new Date(e.fecha).toLocaleDateString(),
      doctor: nombreDoctor,
      puntaje: e.phq9_puntaje,
      riesgo: e.resultado
   }));

   // Enviamos el objeto con la edad ya procesada
   this.pdfService.generateHistoryReport(pacienteParaPdf, historialFormateado);
   this.alertService.success("Historial Exportado", "Se ha generado el PDF.", true);
}

  verDetalle(evaluacion: any) {
    this.selectedEval.set(evaluacion);
    
    // CORRECCIÓN: Usamos phq9_puntaje
    const porcentaje = Math.round((evaluacion.phq9_puntaje / 27) * 100);
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

  abrirModalEditar() {
    const p = this.patient();
    if (p) {
      this.editForm.patchValue({
        nombre_completo: p.nombre_completo,
        fecha_nacimiento: p.fecha_nacimiento, // Debe estar en formato YYYY-MM-DD
        sexo: p.sexo,
        telefono: p.telefono
      });
      this.displayEditModal.set(true);
    }
  }

  // Guarda los cambios
  guardarEdicion() {
    if (this.editForm.invalid) return;

    this.alertService.loading('Actualizando paciente...');
    const id = this.patient()?.id;
    
    this.patientService.updatePatient(id, this.editForm.getRawValue()).subscribe({
      next: () => {
        this.alertService.success('Actualizado', 'Datos del paciente modificados con éxito.', true);
        this.displayEditModal.set(false);
        this.cargarDatosReales(id); // Recargamos para ver los cambios
      },
      error: () => this.alertService.error('Error', 'No se pudo actualizar el paciente.')
    });
  }
}