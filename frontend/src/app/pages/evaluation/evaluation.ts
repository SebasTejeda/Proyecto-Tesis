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
  isSavingAgreement = signal(false);

  riesgoBinario = signal<number>(0);
  riesgoEtiqueta = signal('Pendiente');
  riesgoPorcentaje = signal(0);
  ultimaEvaluacion = signal<EvaluationResponse | null>(null);
  doctorAgreement = signal<string | null>(null); // US007

  shapData: any;
  shapOptions: any;

  readonly etiquetasVidaSocial    = ['', 'Muy baja', 'Baja', 'Activa', 'Muy activa'];
  readonly etiquetasFrecEjercicio = ['Nunca', 'Ocasionalmente', 'Frecuentemente'];
  readonly etiquetasNivelEstres   = ['', 'Muy bajo', 'Bajo', 'Moderado', 'Alto', 'Muy alto'];
  readonly etiquetasCalidadSueno  = ['', 'Muy mala', 'Mala', 'Buena', 'Muy buena'];
  readonly etiquetasSoledad       = ['', 'Nunca', 'Ocasionalmente', 'Frecuentemente', 'Siempre'];
  readonly etiquetasApoyoFamiliar = ['', 'Muy bajo', 'Bajo', 'Alto', 'Muy alto'];
  readonly etiquetasAutoestima    = ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];

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

  constructor() { Chart.register(...registerables); }

  ngOnInit(): void { this.cargarPacientes(); }

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
      error: () => { this.alertService.close(); this.alertService.error('Error', 'No se pudieron cargar los pacientes'); }
    });
  }

  onSubmit() {
    if (this.evalForm.invalid || this.evalForm.get('patient_id')?.value === 0) {
      this.alertService.error('Formulario Incompleto', 'Selecciona un paciente y revisa los datos.');
      this.evalForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.alertService.loading('Ejecutando análisis predictivo...');
    const raw = this.evalForm.getRawValue();
    const dataToSend: EvaluationCreate = {
      patient_id: raw.patient_id,
      doctor_notes: raw.doctor_notes,
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
    this.ultimaEvaluacion.set(response);
    this.doctorAgreement.set(response.doctor_agreement ?? null);
    const pred = response.model_prediction;
    this.riesgoBinario.set(pred?.risk_binary ?? 0);
    this.riesgoEtiqueta.set(pred?.severity ?? 'Pendiente');
    this.riesgoPorcentaje.set(pred?.risk_probability != null ? Math.round(pred.risk_probability * 100) : 0);
    this.initShapChart(pred?.shap_values ?? null);
    this.displayModal.set(true);
  }

  // US007 — Conformidad del doctor
  registrarConformidad(agreement: 'confirmed' | 'rejected') {
    const evalId = this.ultimaEvaluacion()?.id;
    if (!evalId) return;
    this.isSavingAgreement.set(true);
    this.evalService.updateAgreement(evalId, agreement).subscribe({
      next: (updated) => {
        this.doctorAgreement.set(updated.doctor_agreement ?? null);
        this.isSavingAgreement.set(false);
        const msg = agreement === 'confirmed'
          ? 'Diagnóstico confirmado correctamente.'
          : 'Desacuerdo registrado correctamente.';
        this.alertService.success('Registrado', msg, true);
      },
      error: () => {
        this.isSavingAgreement.set(false);
        this.alertService.error('Error', 'No se pudo registrar la conformidad.');
      }
    });
  }

  initShapChart(shapValues: Record<string, number> | null) {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
      autoestima: 'Autoestima', estado_civil: 'Estado civil', genero: 'Género'
    };
    const entradas = shapValues
      ? Object.entries(shapValues).filter(([k]) => labelMap[k] !== undefined) : [];
    const top6 = entradas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const maxAbs = top6.length > 0 ? Math.max(...top6.map(([, v]) => Math.abs(v))) : 1;
    this.shapData = {
      labels: top6.map(([k]) => labelMap[k]),
      datasets: [{
        label: 'Impacto en el riesgo (%)',
        data: top6.map(([, v]) => Math.round((v / maxAbs) * 100)),
        backgroundColor: top6.map(([, v]) => v >= 0 ? '#ef4444' : '#10b981'),
        borderRadius: 5
      }]
    };
    this.shapOptions = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.raw >= 0 ? 'Aumenta' : 'Disminuye'} el riesgo: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } }
      },
      scales: {
        x: { min: -100, max: 100, ticks: { callback: (v: any) => `${v}%` }, grid: { color: '#f1f5f9' } },
        y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
      }
    };
  }

  getLabelFeature(key: string): string {
    const m: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Frecuencia de ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad percibida', apoyo_familiar: 'Apoyo familiar', autoestima: 'Autoestima'
    };
    return m[key] ?? key;
  }

  exportarPDF() {
    const patientId = this.evalForm.get('patient_id')?.value;
    const selectedPatient = this.pacientes().find(p => p.id === patientId);
    if (!selectedPatient) return;
    this.pdfService.generateEvaluationReport(selectedPatient,
      { riesgoPorcentaje: this.riesgoPorcentaje(), riesgoEtiqueta: this.riesgoEtiqueta() },
      this.shapData
    );
    this.alertService.success('Informe Generado', 'El PDF se ha guardado en tus descargas.', true);
  }

  cerrarYVolver() {
    this.displayModal.set(false);
    const idPaciente = this.evalForm.get('patient_id')?.value;
    this.router.navigate(idPaciente ? ['/dashboard/patient', idPaciente] : ['/dashboard']);
  }
}