import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  styleUrls: ['./evaluation.css'],
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

  busquedaPaciente = signal('');
  pacienteSeleccionado = signal<Patient | null>(null);
  mostrarDropdown = signal(false);
  sinPacienteError = signal(false);

  pacientesFiltrados = computed(() => {
    const q = this.normalizar(this.busquedaPaciente().trim());
    if (!q) return this.pacientes().slice(0, 8);
    return this.pacientes().filter(p =>
      this.normalizar(p.nombre_completo).includes(q) || p.dni.includes(q)
    ).slice(0, 8);
  });

  private normalizar(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  readonly DOCTOR_NOTES_MAX_LENGTH = 1000;

  draftDisponible = signal(false);
  draftFecha = signal<string | null>(null);

  riesgoBinario = signal<number>(0);
  riesgoEtiqueta = signal('Pendiente');
  riesgoPorcentaje = signal(0);
  ultimaEvaluacion = signal<EvaluationResponse | null>(null);
  doctorAgreement = signal<string | null>(null);

  // Bloque 5 — baja confianza y derivación
  bajaConfianza = signal(false);          // true si probabilidad entre 40-60%
  sugerirDerivacion = signal(false);      // true si nivel Moderado/Alto

  displayDisagreementModal = signal(false);
  selectedDisagreementReason = signal<string>('');
  otherReason = signal<string>('');

  readonly DISAGREEMENT_OPTIONS = [
    'El nivel de riesgo es mayor al indicado',
    'El nivel de riesgo es menor al indicado',
    'El paciente no presenta riesgo depresivo',
    'Los factores identificados no son los principales',
    'El modelo no considera información clínica relevante',
    'Otro',
  ];

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
    doctor_notes: ['', [Validators.maxLength(this.DOCTOR_NOTES_MAX_LENGTH)]],
    model_features: this.fb.nonNullable.group({
      horas_sueno: [7.0, [Validators.required, Validators.min(0), Validators.max(24)]],
      vida_social: [2, [Validators.required, Validators.min(1), Validators.max(4)]],
      frecuencia_ejercicio: [1, [Validators.required, Validators.min(0), Validators.max(2)]],
      redes_sociales: [2.0, [Validators.required, Validators.min(0), Validators.max(24)]],
      nivel_estres: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      calidad_sueno: [2, [Validators.required, Validators.min(1), Validators.max(4)]],
      soledad_percibida: [2, [Validators.required, Validators.min(1), Validators.max(4)]],
      apoyo_familiar: [3, [Validators.required, Validators.min(1), Validators.max(4)]],
      autoestima: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      estado_civil: [0, Validators.required],
    }),
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
          if (preSelectedId) {
            const p = this.pacientes().find(p => p.id === preSelectedId);
            if (p) this.seleccionarPaciente(p);
          }
        });
      },
      error: () => { this.alertService.close(); this.alertService.error('Error', 'No se pudieron cargar los pacientes'); },
    });
  }

  seleccionarPaciente(p: Patient) {
    this.pacienteSeleccionado.set(p);
    this.busquedaPaciente.set('');
    this.evalForm.patchValue({ patient_id: p.id });
    this.mostrarDropdown.set(false);
    this.sinPacienteError.set(false);
    this.cargarBorrador(p.id);
  }

  limpiarPaciente() {
    this.pacienteSeleccionado.set(null);
    this.busquedaPaciente.set('');
    this.evalForm.patchValue({ patient_id: 0 });
    this.mostrarDropdown.set(false);
    this.draftDisponible.set(false);
    this.draftFecha.set(null);
  }

  // ── Borrador (localStorage) ─────────────────────────────────────────────
  private draftKey(patientId: number): string {
    const doctorId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || 'anon';
    return `neuromind_draft_eval_${doctorId}_${patientId}`;
  }

  private cargarBorrador(patientId: number) {
    const raw = localStorage.getItem(this.draftKey(patientId));
    if (!raw) { this.draftDisponible.set(false); this.draftFecha.set(null); return; }
    try {
      const borrador = JSON.parse(raw);
      this.evalForm.patchValue({
        doctor_notes: borrador.doctor_notes ?? '',
        model_features: borrador.model_features ?? {},
      });
      this.draftDisponible.set(true);
      this.draftFecha.set(borrador.fecha ?? null);
    } catch {
      localStorage.removeItem(this.draftKey(patientId));
      this.draftDisponible.set(false);
      this.draftFecha.set(null);
    }
  }

  guardarBorrador() {
    const patientId = this.pacienteSeleccionado()?.id;
    if (!patientId) {
      this.alertService.error('Sin paciente', 'Selecciona un paciente antes de guardar un borrador.');
      return;
    }
    const raw = this.evalForm.getRawValue();
    const borrador = { doctor_notes: raw.doctor_notes, model_features: raw.model_features, fecha: new Date().toISOString() };
    localStorage.setItem(this.draftKey(patientId), JSON.stringify(borrador));
    this.draftDisponible.set(true);
    this.draftFecha.set(borrador.fecha);
    this.alertService.success('Borrador guardado', 'Podrás continuar más tarde con estos datos.', true);
  }

  descartarBorrador() {
    const patientId = this.pacienteSeleccionado()?.id;
    if (patientId) localStorage.removeItem(this.draftKey(patientId));
    this.draftDisponible.set(false);
    this.draftFecha.set(null);
  }

  private limpiarBorrador(patientId: number) {
    localStorage.removeItem(this.draftKey(patientId));
    this.draftDisponible.set(false);
    this.draftFecha.set(null);
  }

  onBusquedaFocus() { this.mostrarDropdown.set(true); }
  onBusquedaBlur()  { setTimeout(() => this.mostrarDropdown.set(false), 200); }

  onSubmit() {
    if (!this.pacienteSeleccionado()) {
      this.sinPacienteError.set(true);
      this.alertService.error('Formulario Incompleto', 'Selecciona un paciente de la lista.');
      return;
    }
    this.isLoading.set(true);
    this.alertService.loading('Ejecutando análisis predictivo...');
    const raw = this.evalForm.getRawValue();
    this.evalService.createEvaluation({
      patient_id: raw.patient_id, doctor_notes: raw.doctor_notes, model_features: raw.model_features,
    }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.limpiarBorrador(raw.patient_id);
        this.mostrarResultados(response);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        console.error(err);
        if (err.status === 503) {
          this.alertService.confirm(
            'El modelo no respondió',
            'La evaluación se guardó pero el modelo no respondió. ¿Reintentar cálculo?',
          ).then(reintentar => { if (reintentar) this.onSubmit(); });
        } else {
          this.alertService.error('Error', 'Hubo un problema procesando la evaluación.');
        }
      },
    });
  }

  mostrarResultados(response: EvaluationResponse) {
    this.ultimaEvaluacion.set(response);
    this.doctorAgreement.set(response.doctor_agreement ?? null);
    this.expandedRecs.set(new Set());
    const pred = response.model_prediction;
    const prob = pred?.risk_probability ?? 0;

    this.riesgoBinario.set(pred?.risk_binary ?? 0);
    this.riesgoEtiqueta.set(pred?.severity ?? 'Pendiente');
    this.riesgoPorcentaje.set(Math.round(prob * 100));

    // Bloque 5 — detectar baja confianza (zona gris 40-60%)
    const pct = prob * 100;
    this.bajaConfianza.set(pct >= 40 && pct <= 60);

    // Bloque 5 — sugerir derivación si nivel es Moderado/Alto
    this.sugerirDerivacion.set(pred?.severity === 'Moderado/Alto');

    this.initShapChart(pred?.shap_values ?? null);
    this.displayModal.set(true);
  }

  confirmarDiagnostico() {
    const evalId = this.ultimaEvaluacion()?.id;
    if (!evalId) return;
    this.isSavingAgreement.set(true);
    this.evalService.updateAgreement(evalId, 'confirmed').subscribe({
      next: (updated) => { this.doctorAgreement.set(updated.doctor_agreement ?? null); this.isSavingAgreement.set(false); this.alertService.success('Registrado', 'Diagnóstico confirmado.', true); },
      error: () => { this.isSavingAgreement.set(false); this.alertService.error('Error', 'No se pudo registrar.'); },
    });
  }

  abrirModalDesacuerdo() {
    this.selectedDisagreementReason.set('');
    this.otherReason.set('');
    this.displayDisagreementModal.set(true);
  }

  confirmarDesacuerdo() {
    const reason = this.selectedDisagreementReason() === 'Otro'
      ? this.otherReason().trim() : this.selectedDisagreementReason();
    if (!reason) { this.alertService.error('Requerido', 'Selecciona o escribe una razón.'); return; }
    const evalId = this.ultimaEvaluacion()?.id;
    if (!evalId) return;
    this.isSavingAgreement.set(true);
    this.displayDisagreementModal.set(false);
    this.evalService.updateAgreement(evalId, 'rejected', reason).subscribe({
      next: (updated) => { this.doctorAgreement.set(updated.doctor_agreement ?? null); this.isSavingAgreement.set(false); this.alertService.success('Registrado', 'Desacuerdo registrado.', true); },
      error: () => { this.isSavingAgreement.set(false); this.alertService.error('Error', 'No se pudo registrar.'); },
    });
  }

  initShapChart(shapValues: Record<string, number> | null) {
    const labelMap: Record<string, string> = {
      horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
      frecuencia_ejercicio: 'Ejercicio', redes_sociales: 'Redes sociales',
      nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
      soledad_percibida: 'Soledad', apoyo_familiar: 'Apoyo familiar',
      autoestima: 'Autoestima', estado_civil: 'Estado civil', genero: 'Género',
    };
    const entradas = shapValues ? Object.entries(shapValues).filter(([k]) => labelMap[k]) : [];
    const top6 = entradas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const maxAbsCalc = top6.length > 0 ? Math.max(...top6.map(([, v]) => Math.abs(v))) : 0;
    const maxAbs = maxAbsCalc > 0 ? maxAbsCalc : 1;
    this.shapData = {
      labels: top6.map(([k]) => labelMap[k]),
      datasets: [{ label: 'Impacto (%)', data: top6.map(([, v]) => Math.round((v / maxAbs) * 100)), backgroundColor: top6.map(([, v]) => v >= 0 ? '#ef4444' : '#10b981'), borderRadius: 5 }],
    };
    this.shapOptions = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.raw >= 0 ? 'Aumenta' : 'Disminuye'} el riesgo: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } } },
      scales: { x: { min: -100, max: 100, ticks: { callback: (v: any) => `${v}%` }, grid: { color: '#f1f5f9' } }, y: { grid: { display: false }, ticks: { font: { weight: 'bold' } } } },
    };
  }

  expandedRecs = signal<Set<number>>(new Set());

  toggleRecomendacion(recId: number) {
    const actuales = new Set(this.expandedRecs());
    if (actuales.has(recId)) actuales.delete(recId);
    else actuales.add(recId);
    this.expandedRecs.set(actuales);
  }

  isRecExpandida(recId: number): boolean {
    return this.expandedRecs().has(recId);
  }

  getLabelFeature(key: string): string {
    const m: Record<string, string> = { horas_sueno: 'Horas de sueño', vida_social: 'Vida social', frecuencia_ejercicio: 'Frecuencia de ejercicio', redes_sociales: 'Redes sociales', nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño', soledad_percibida: 'Soledad percibida', apoyo_familiar: 'Apoyo familiar', autoestima: 'Autoestima' };
    return m[key] ?? key;
  }

  exportarPDF() {
    const selectedPatient = this.pacienteSeleccionado();
    if (!selectedPatient) return;
    try {
      this.pdfService.generateEvaluationReport(selectedPatient, { riesgoPorcentaje: this.riesgoPorcentaje(), riesgoEtiqueta: this.riesgoEtiqueta() }, this.shapData);
      this.alertService.success('Informe Generado', 'El PDF se ha guardado en tus descargas.', true);
    } catch (err: any) {
      this.alertService.error('No se pudo generar el PDF', err?.message ?? 'Faltan datos de la evaluación para generar el informe.');
    }
  }

  async cerrarYVolver() {
    if (this.doctorAgreement()) { this.ejecutarNavegacion(); return; }
    const confirmado = await this.alertService.confirm(
      '¿Cerrar sin confirmar?',
      'Si cierras la pantalla se entenderá que estás de acuerdo con el resultado generado por el modelo.',
    );
    if (confirmado) {
      const evalId = this.ultimaEvaluacion()?.id;
      if (evalId) {
        this.isSavingAgreement.set(true);
        this.alertService.loading('Guardando conformidad automática...');
        this.evalService.updateAgreement(evalId, 'confirmed').subscribe({
          next: () => { this.isSavingAgreement.set(false); this.alertService.close(); this.ejecutarNavegacion(); },
          error: () => { this.isSavingAgreement.set(false); this.alertService.close(); this.ejecutarNavegacion(); },
        });
      } else { this.ejecutarNavegacion(); }
    }
  }

  private ejecutarNavegacion() {
    this.displayModal.set(false);
    const idPaciente = this.evalForm.get('patient_id')?.value;
    this.router.navigate(idPaciente ? ['/dashboard/patient', idPaciente] : ['/dashboard']);
  }
}