import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ChartModule } from 'primeng/chart'; 
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog'; // <--- Importante para el Modal
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../../services/pdf/pdf';
import { AlertService } from '../../services/alert/alert';

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


  // Datos del Paciente (Simulados)
  patient: any = {
    id: 1,
    nombre: 'Juan Pérez',
    edad: 24,
    sexo: 'Masculino',
    ocupacion: 'Estudiante Universitario',
    telefono: '+51 987 654 321',
    fecha_registro: '15/01/2026',
    riesgo_actual: 'Alto',
    foto: null 
  };

  // Datos para el Gráfico Principal (Evolución)
  chartData: any;
  chartOptions: any;

  // Historial de Evaluaciones
  historial = [
    { fecha: '10/02/2026', riesgo: 'Alto', puntaje: 85, doctor: 'Dr. Tineo' },
    { fecha: '02/02/2026', riesgo: 'Moderado', puntaje: 65, doctor: 'Dr. Tineo' },
    { fecha: '25/01/2026', riesgo: 'Moderado', puntaje: 60, doctor: 'Dr. Tejeda' },
    { fecha: '15/01/2026', riesgo: 'Bajo', puntaje: 30, doctor: 'Dr. Tejeda' },
  ];

  // --- VARIABLES PARA EL MODAL DE DETALLE ---
  displayModal: boolean = false;
  selectedEval: any = null;
  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    // this.route.snapshot.paramMap.get('id'); // Aquí capturarías el ID real
    this.initMainChart();
  }

  // --- 1. ACCIONES DE LOS BOTONES SUPERIORES ---

  irANuevaEvaluacion() {
    // Redirige al dashboard a la sección de evaluación
    // Nota: Para que esto abra la pestaña exacta, necesitarías lógica extra en dashboard,
    // pero por ahora redirigir es lo estándar.
    this.router.navigate(['/dashboard'], {
      queryParams: {
        tab: 'evaluation',
        patientId: this.patient.id // Pasamos el ID del paciente
      }
    });
  }

  exportarInformeGeneral() {
    // 1. Validar que tenemos datos del paciente
    if (!this.patient || !this.patient.nombre) {
        alert("Error: No hay datos del paciente para generar el informe.");
        return;
    }

    // 2. Preparar los datos del paciente para el servicio PDF
    // IMPORTANTE: Mapeamos 'nombre' a 'nombre_completo' para que el PDF service lo entienda y el archivo se nombre bien.
    const patientForPdf = {
        ...this.patient, // Copia todas las propiedades
        nombre_completo: this.patient.nombre, // Asegura esta propiedad
        id: this.patient.id // Asegura el ID
    };

    // 3. Simular datos coherentes basados en el riesgo ACTUAL del paciente
    const riesgoActual = this.patient.riesgo_actual; // Ej: 'Alto', 'Moderado', 'Bajo'
    let puntajeSimulado = 30; // Default bajo

    if (riesgoActual === 'Alto') puntajeSimulado = 88;
    else if (riesgoActual === 'Moderado') puntajeSimulado = 62;

    const datosResultadoSimulado = {
      riesgoPorcentaje: puntajeSimulado,
      riesgoEtiqueta: riesgoActual.toUpperCase()
    };
    
    // 4. Simular datos SHAP coherentes para el reporte general
    const esAlto = puntajeSimulado > 50;
    const shapSimuladoGeneral = {
        labels: esAlto ? ['Ansiedad Generalizada', 'Calidad de Sueño Pobre', 'Estrés Percibido'] : ['Buen Soporte Social', 'Actividad Física Regular', 'Sueño Adecuado'],
        datasets: [{
           // Valores positivos si es riesgo alto, negativos si es bajo
           data: esAlto ? [35, 25, 15] : [-25, -15, -10]
        }]
    };

    // 5. Llamar al servicio
    console.log("Generando PDF para:", patientForPdf.nombre_completo);
    this.pdfService.generateEvaluationReport(patientForPdf, datosResultadoSimulado, shapSimuladoGeneral);
  }

  // --- 2. ACCIONES DE LA TABLA (HISTORIAL) ---

  exportarHistorialCompleto() {
     if (!this.historial || this.historial.length === 0) {
        this.alertService.error("Sin datos", "No hay historial disponible para exportar.");
        return;
     }

     // Llamamos al nuevo método del servicio
     this.pdfService.generateHistoryReport(this.patient, this.historial);
     
     this.alertService.success("Historial Exportado", "Se ha generado el PDF con todas las evaluaciones.");
  }

  verDetalle(evaluacion: any) {
    this.selectedEval = evaluacion;
    
    // Generamos los gráficos con los datos de ESA evaluación histórica
    this.initGaugeChart(evaluacion.puntaje);
    this.initShapChart(evaluacion.puntaje); // Pasamos el puntaje para simular datos coherentes
    
    this.displayModal = true;
  }

  // --- 3. CONFIGURACIÓN DE GRÁFICOS ---

  initMainChart() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    this.chartData = {
      labels: ['15/01', '25/01', '02/02', '10/02'],
      datasets: [
        {
          label: 'Nivel de Riesgo (%)',
          data: [30, 60, 65, 85],
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

    this.chartOptions = {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColorSecondary }, grid: { display: false } },
        y: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, min: 0, max: 100 }
      }
    };
  }

  // Gráfico de Dona para el Modal (Velómetro)
  initGaugeChart(valor: number) {
    this.gaugeData = {
      labels: ['Riesgo', 'Restante'],
      datasets: [{
          data: [valor, 100 - valor],
          backgroundColor: [valor > 50 ? '#ef4444' : '#10b981', '#e2e8f0'],
          borderWidth: 0,
          cutout: '85%'
        }]
    };
    this.gaugeOptions = {
      rotation: -90, circumference: 180, 
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      aspectRatio: 1.5, maintainAspectRatio: false
    };
  }

  // Gráfico SHAP para el Modal (Simulado basado en el puntaje histórico)
  initShapChart(puntaje: number) {
    // Simulamos datos diferentes según si el riesgo fue alto o bajo
    const esAlto = puntaje > 50;
    
    this.shapData = {
      labels: esAlto ? ['Ansiedad Severa', 'Insomnio', 'Estrés Laboral'] : ['Buen Sueño', 'Actividad Física', 'Bajo Estrés'],
      datasets: [{
          label: 'Impacto',
          data: esAlto ? [40, 25, 10] : [-30, -20, -10],
          backgroundColor: esAlto ? '#ef4444' : '#10b981',
          borderRadius: 5
        }]
    };

    this.shapOptions = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
    };
  }

  getClassRiesgo(riesgo: string): string {
    switch (riesgo) {
      case 'Alto': return 'badge-high';
      case 'Moderado': return 'badge-mod';
      default: return 'badge-low';
    }
  }
}