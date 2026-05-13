import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { PdfService } from '../../services/pdf/pdf';
import { Patient } from '../../models/patients';
import { EvaluationCreate, EvaluationResponse } from '../../models/evaluations';

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChartModule, DialogModule, ButtonModule, TooltipModule],
  templateUrl: './evaluation.html',
  styleUrls: ['./evaluation.css']
})
export class EvaluationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  pacientes = signal<Patient[]>([]);
  displayModal = signal(false);
  isLoading = signal(false);
  riesgoPorcentaje = signal(0);
  riesgoEtiqueta = signal('Pendiente');

  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  // Etiquetas legibles por campo
  readonly etiquetasVidaSocial     = ['', 'Muy baja', 'Baja', 'Activa', 'Muy activa'];
  readonly etiquetasFrecEjercicio  = ['Nunca', 'Ocasionalmente', 'Frecuentemente'];
  readonly etiquetasNivelEstres    = ['', 'Muy bajo', 'Bajo', 'Moderado', 'Alto', 'Muy alto'];
  readonly etiquetasCalidadSueno   = ['', 'Muy mala', 'Mala', 'Buena', 'Muy buena'];
  readonly etiquetasSoledad        = ['', 'Nunca', 'Ocasionalmente', 'Frecuentemente', 'Siempre'];
  readonly etiquetasApoyoFamiliar  = ['', 'Muy bajo', 'Bajo', 'Alto', 'Muy alto'];
  readonly etiquetasAutoestima     = ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];

  evalForm = this.fb.nonNullable.group({
    patient_id:   [0, [Validators.required, Validators.min(1)]],
    doctor_notes: [''],
    model_features: this.fb.nonNullable.group({
      horas_sueno:          [7.0],
      vida_social:          [2],
      frecuencia_ejercicio: [1],
      redes_sociales:       [2.0],
      nivel_estres:         [3],
      calidad_sueno:        [2],
      soledad_percibida:    [2],
      apoyo_familiar:       [3],
      autoestima:           [3],
      estado_civil:         [0],
    })
  });

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.cargarPacientes();
  }

  getEtiqueta(campo: string): string {
    const val = Number(this.evalForm.get(`model_features.${campo}`)?.value ?? 0);
    switch (campo) {
      case 'vida_social':          return this.etiquetasVidaSocial[val]    ?? String(val);
      case 'frecuencia_ejercicio': return this.etiquetasFrecEjercicio[val] ?? String(val);
      case 'nivel_estres':         return this.etiquetasNivelEstres[val]   ?? String(val);
      case 'calidad_sueno':        return this.etiquetasCalidadSueno[val]  ?? String(val);
      case 'soledad_percibida':    return this.etiquetasSoledad[val]       ?? String(val);
      case 'apoyo_familiar':       return this.etiquetasApoyoFamiliar[val] ?? String(val);
      case 'autoestima':           return this.etiquetasAutoestima[val]    ?? String(val);
      default: return String(val);
    }
  }

  cargarPacientes() {
    this.alertService.loading('Cargando pacientes...', true);
    this.patientService.getPatients().subscribe({
      next: (data: Patient[]) => {
        this.pacientes.set(data ?? []);
        this.alertService.close();
        this.route.queryParams.subscribe(params => {
          const preSelectedId = Number(params['patientId']);
          if (preSelectedId && this.pacientes().find(p => p.id === preSelectedId)) {
            this.evalForm.patchValue({ patient_id: preSelectedId });
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
      this.alertService.error('Formulario Incompleto', 'Selecciona un paciente y revisa los datos.');
      this.evalForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Guardando evaluación...');

    const raw = this.evalForm.getRawValue();
    const dataToSend: EvaluationCreate = {
      patient_id:    raw.patient_id,
      doctor_notes:  raw.doctor_notes,
      model_features: raw.model_features
    };

    this.evalService.createEvaluation(dataToSend).subscribe({
      next: (response: EvaluationResponse) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.mostrarResultados(response);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.alertService.error('Error', 'Hubo un problema procesando la evaluación.');
        console.error(err);
      }
    });
  }

  mostrarResultados(response: EvaluationResponse) {
    const pred = response.model_prediction;
    const porcentaje = pred?.risk_probability != null
      ? Math.round(pred.risk_probability * 100) : 0;
    const severidad = pred?.severity ?? 'Pendiente';

    this.riesgoPorcentaje.set(porcentaje);
    this.riesgoEtiqueta.set(severidad);
    this.initGaugeChart(porcentaje);
    this.initShapChart(pred?.shap_values ?? null);
    this.displayModal.set(true);
  }

  initGaugeChart(valor: number) {
    const display = valor || 1;
    this.gaugeData = {
      labels: ['Riesgo', 'Restante'],
      datasets: [{
        data: [display, 100 - display],
        backgroundColor: [
          valor > 50 ? '#ef4444' : (valor > 20 ? '#d97706' : '#10b981'),
          '#e2e8f0'
        ],
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

  initShapChart(shapValues: Record<string, number> | null) {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
      autoestima: 'Autoestima', estado_civil: 'Estado civil', genero: 'Género'
    };

    const entries = shapValues
      ? Object.entries(shapValues).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6)
      : [['nivel_estres', 0], ['horas_sueno', 0], ['vida_social', 0], ['autoestima', 0]];

    this.shapData = {
      labels: entries.map(([k]) => labelMap[k] ?? k),
      datasets: [{
        label: 'Impacto en Riesgo',
        data: entries.map(([, v]) => v),
        backgroundColor: (context: any) => context.raw >= 0 ? '#ef4444' : '#10b981',
        borderRadius: 5
      }]
    };
    this.shapOptions = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f1f5f9' } },
        y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
      }
    };
  }

  exportarPDF() {
    const patientId = this.evalForm.get('patient_id')?.value;
    const selectedPatient = this.pacientes().find(p => p.id === patientId);
    if (!selectedPatient) return;
    const resultado = { riesgoPorcentaje: this.riesgoPorcentaje(), riesgoEtiqueta: this.riesgoEtiqueta() };
    this.pdfService.generateEvaluationReport(selectedPatient, resultado, this.shapData);
    this.alertService.success('Informe Generado', 'El PDF se ha guardado en tus descargas.', true);
  }

  cerrarYVolver() {
    this.displayModal.set(false);
    const idPaciente = this.evalForm.get('patient_id')?.value;
    this.router.navigate(idPaciente ? ['/dashboard/patient', idPaciente] : ['/dashboard']);
  }
}