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
import { ActivatedRoute, Router } from '@angular/router';
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
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  pacientes = signal<any[]>([]);
  displayModal = signal(false);
  isLoading = signal(false);

  // FORMULARIO REFACTORIZADO (Estructura anidada Pydantic)
  evalForm = this.fb.nonNullable.group({
    patient_id: [0, [Validators.required, Validators.min(1)]],
    notas_doctor: [''],
    
    // Grupo de Síntomas PHQ-9
    symptoms: this.fb.nonNullable.group({
      interes_poco_placer: [0, [Validators.min(0), Validators.max(3)]],
      desanimado_deprimido: [0, [Validators.min(0), Validators.max(3)]],
      dificultad_dormir: [0, [Validators.min(0), Validators.max(3)]],
      sentirse_cansado: [0, [Validators.min(0), Validators.max(3)]],
      poco_apetito: [0, [Validators.min(0), Validators.max(3)]],
      sentirse_mal_consigo_mismo: [0, [Validators.min(0), Validators.max(3)]],
      dificultad_concentracion: [0, [Validators.min(0), Validators.max(3)]],
      moverse_hablar_lento_rapido: [0, [Validators.min(0), Validators.max(3)]],
      pensamientos_muerte: [0, [Validators.min(0), Validators.max(3)]]
    }),

    // Grupo de Data Extra (ENDES)
    extra_data: this.fb.nonNullable.group({
      estado_civil: ['Soltero'],
      nivel_educativo: ['Secundaria'],
      peso: [70.0],
      talla: [1.70],
      imc: [24.2], // Idealmente se calcula automático en el HTML
      fuma_30_dias: ['No'],
      bebe_30_dias: ['No'],
      alcohol_dificultad_estudio: ['No'],
      violencia_fisica_pareja: ['No'],
      diagnostico_hipertension: ['No'],
      diagnostico_diabetes: ['No']
    })
  });

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
    
    // Auto-calcular IMC cuando cambia peso o talla
    this.evalForm.get('extra_data.peso')?.valueChanges.subscribe(() => this.calcularIMC());
    this.evalForm.get('extra_data.talla')?.valueChanges.subscribe(() => this.calcularIMC());
  }

  calcularIMC() {
    const peso = this.evalForm.get('extra_data.peso')?.value || 0;
    const talla = this.evalForm.get('extra_data.talla')?.value || 1;
    if (talla > 0) {
      const imc = parseFloat((peso / (talla * talla)).toFixed(2));
      this.evalForm.get('extra_data.imc')?.setValue(imc, { emitEvent: false });
    }
  }

  cargarPacientes() {
    this.alertService.loading('Cargando pacientes...', true);
    
    this.patientService.getPatients().subscribe({
      next: (data) => {
        this.pacientes.set(Array.isArray(data) ? data : []);
        this.alertService.close();

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
      this.alertService.error('Formulario Incompleto', 'Selecciona un paciente y revisa los datos clínicos.');
      this.evalForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Analizando perfil clínico con Machine Learning...');

    // Angular enviará un JSON anidado exacto a como FastAPI lo espera
    const dataToSend: any = this.evalForm.getRawValue();

    this.evalService.createEvaluation(dataToSend).subscribe({
      next: (response: any) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.mostrarResultados(response.phq9_puntaje, response.resultado);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.alertService.error('Error', 'Hubo un problema procesando la evaluación.');
        console.error(err);
      }
    });
  }

  mostrarResultados(puntaje_total: number, riesgo: string) {
    this.riesgoPorcentaje = Math.round((puntaje_total / 27) * 100);
    this.riesgoEtiqueta = riesgo;

    this.initGaugeChart(this.riesgoPorcentaje);
    this.initShapChart(); 
    
    this.displayModal.set(true); 
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
    this.shapData = {
      labels: ['Poco interés', 'Problemas Sueño', 'IMC Elevado', 'Sin apetito'],
      datasets: [
        {
          label: 'Impacto en Riesgo',
          data: [25, 15, 8, 10], // SHAP Simulado
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
    this.alertService.success('Informe Generado', 'El PDF se ha guardado en tus descargas.', true);
  }

  cerrarYVolver(){
    this.displayModal.set(false);
    const idPaciente = this.evalForm.get('patient_id')?.value;
    if(idPaciente) {
      this.router.navigate(['/dashboard/patient', idPaciente]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}