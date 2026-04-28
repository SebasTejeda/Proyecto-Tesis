import { Component, OnInit, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { PatientService } from '../../services/patients/patient';
import { AlertService } from '../../services/alert/alert';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../../services/pdf/pdf';
import { TooltipModule } from 'primeng/tooltip';
import { ActivatedRoute } from '@angular/router';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { EvaluationCreate } from '../../models/evaluations';


@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ChartModule, 
    DialogModule, 
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './evaluation.html',
  styleUrls: ['./evaluation.css']
})
export class EvaluationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService); // Nuevo servicio
  private alertService = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);

  pacientes = signal<any[]>([]);
  displayModal = signal(false);
  isLoading = signal(false);

  evalForm = this.fb.nonNullable.group({
    patient_id: [0, [Validators.required, Validators.min(1)]],
    phq_1: [0, [Validators.min(0), Validators.max(3)]], // Poco interés
    phq_2: [0, [Validators.min(0), Validators.max(3)]], // Deprimido
    phq_3: [0, [Validators.min(0), Validators.max(3)]], // Sueño
    phq_4: [0, [Validators.min(0), Validators.max(3)]], // Cansancio
    phq_5: [0, [Validators.min(0), Validators.max(3)]], // Apetito
    phq_6: [0, [Validators.min(0), Validators.max(3)]], // Culpa
    phq_7: [0, [Validators.min(0), Validators.max(3)]], // Concentración
    phq_8: [0, [Validators.min(0), Validators.max(3)]], // Lentitud/Agitación
    phq_9: [0, [Validators.min(0), Validators.max(3)]], // Pensamientos suicidas
    historial_familiar: ['No', Validators.required]
  });

  // Variables para los gráficos
  riesgoPorcentaje: number = 0;
  riesgoEtiqueta: string = '';
  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.cargarPacientes();
  }

  cargarPacientes() {
    this.alertService.loading('Cargando pacientes...', true);
    
    this.patientService.getPatients().subscribe({
      next: (data) => {
        this.pacientes.set(Array.isArray(data) ? data : []);
        this.alertService.close();

        // Autoselección si venimos desde el detalle del paciente
        this.route.queryParams.subscribe(params => {
          const preSelectedId = params['patientId'];
          if (preSelectedId) {
            const idNumber = Number(preSelectedId);
            const pacienteExiste = this.pacientes().find(p => p.id === idNumber);
            if (pacienteExiste) {
               this.evalForm.patchValue({ patient_id: idNumber });
            }
          }
        });
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error', 'No se pudieron cargar los pacientes');
      }
    });
  }

  onSubmit() {
    if (this.evalForm.invalid || this.evalForm.get('patient_id')?.value === 0) {
      this.alertService.error('Formulario Incompleto', 'Por favor selecciona un paciente y completa el cuestionario.');
      this.evalForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Enviando datos y analizando con IA...');

    const dataToSend: EvaluationCreate = this.evalForm.getRawValue();

    // 🚀 Llamada real al backend
    this.evalService.createEvaluation(dataToSend).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.alertService.close();
        
        // Mapeamos los resultados de tu backend a la vista
        this.mostrarResultados(response.puntaje_total, response.nivel_riesgo);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.alertService.error('Error', 'Hubo un problema de conexión con el modelo.');
        console.error(err);
      }
    });
  }

  mostrarResultados(puntaje_total: number, riesgo: string) {
    // Cálculo temporal para el Gauge (0-27 a porcentaje 0-100)
    this.riesgoPorcentaje = Math.round((puntaje_total / 27) * 100);
    this.riesgoEtiqueta = riesgo;

    this.initGaugeChart(this.riesgoPorcentaje);
    this.initShapChart(); // SHAP simulado por ahora
    
    this.displayModal.set(true); // Abrimos el modal usando Signal
  }

  initGaugeChart(valor: number) {
    this.gaugeData = {
      labels: ['Riesgo', 'Restante'],
      datasets: [
        {
          data: [valor, 100 - valor],
          backgroundColor: [
            valor > 50 ? '#ef4444' : (valor > 20 ? '#d97706' : '#10b981'),
            '#e2e8f0'
          ],
          borderWidth: 0,
          cutout: '85%'
        }
      ]
    };
    this.gaugeOptions = { rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } }, aspectRatio: 1.5, maintainAspectRatio: false };
  }

  initShapChart() {
    // SHAP Simulado hasta que conectes XGBoost
    this.shapData = {
      labels: ['Poco interés', 'Problemas Sueño', 'Culpa', 'Sin apetito'],
      datasets: [
        {
          label: 'Impacto',
          data: [25, 15, -5, 10],
          backgroundColor: (context: any) => context.raw >= 0 ? '#ef4444' : '#10b981',
          borderRadius: 5
        }
      ]
    };
    this.shapOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { display: false } }, y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } } } };
  }

  exportarPDF(){
    const patientId = this.evalForm.get('patient_id')?.value;
    const selectedPatient = this.pacientes().find(p => p.id == patientId);

    if(!selectedPatient) return;

    const resultado = { riesgoPorcentaje: this.riesgoPorcentaje, riesgoEtiqueta: this.riesgoEtiqueta }
    this.pdfService.generateEvaluationReport(selectedPatient, resultado, this.shapData);
    this.alertService.success('Informe Descargado', 'El PDF se ha generado correctamente.', true);
  }
}