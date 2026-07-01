import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EvaluationService, EjecucionModelo } from '../../services/evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { environment } from '../../../environments/environment';

interface DoctorPending {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  codigo_colegiatura: string;
  account_status: string;
  created_at: string;
}

interface MotivoDesacuerdo {
  motivo: string;
  cantidad: number;
}

interface ResumenDesacuerdos {
  total_desacuerdos: number;
  motivos_frecuentes: MotivoDesacuerdo[];
  por_version_modelo: Record<string, number>;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit {
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  totalEval = signal(0);
  tasaConfirmacion = signal(0);
  tasaDesacuerdo = signal(0);

  todosMedicos = signal<DoctorPending[]>([]);
  isLoadingDoctors = signal(true);

  // Resumen de desacuerdos
  resumenDesacuerdos = signal<ResumenDesacuerdos | null>(null);
  isLoadingResumen = signal(true);

  // Modal de rechazo
  mostrarModalRechazo = signal(false);
  doctorSeleccionado = signal<DoctorPending | null>(null);
  motivoRechazo = signal('');
  procesandoId = signal<number | null>(null);

  get medicosAprobados() { return this.todosMedicos().filter(d => d.account_status === 'approved'); }
  get medicosPendientes() { return this.todosMedicos().filter(d => d.account_status === 'pending'); }
  get medicosRechazados() { return this.todosMedicos().filter(d => d.account_status === 'rejected'); }

  // Máximo para calcular el ancho de las barras
  get maxMotivo(): number {
    const motivos = this.resumenDesacuerdos()?.motivos_frecuentes ?? [];
    return motivos.length > 0 ? Math.max(...motivos.map(m => m.cantidad)) : 1;
  }

  get versionesModelo(): { version: string; cantidad: number }[] {
    const por_version = this.resumenDesacuerdos()?.por_version_modelo ?? {};
    return Object.entries(por_version).map(([version, cantidad]) => ({ version, cantidad }));
  }

  ngOnInit() {
    this.cargarEstadisticas();
    this.cargarMedicos();
    this.cargarResumenDesacuerdos();
  }

  cargarEstadisticas() {
    this.evalService.getHistorialAdmin().subscribe({
      next: (data: EjecucionModelo[]) => {
        this.totalEval.set(data.length);
        const conRespuesta = data.filter(e => e.doctor_agreement);
        if (conRespuesta.length > 0) {
          const confirmados = conRespuesta.filter(e => e.doctor_agreement === 'confirmed').length;
          const rechazados  = conRespuesta.filter(e => e.doctor_agreement === 'rejected').length;
          this.tasaConfirmacion.set(Math.round((confirmados / conRespuesta.length) * 100));
          this.tasaDesacuerdo.set(Math.round((rechazados / conRespuesta.length) * 100));
        }
      }
    });
  }

  cargarMedicos() {
    this.isLoadingDoctors.set(true);
    this.http.get<DoctorPending[]>(`${this.apiUrl}/users/admin/all-doctors`).subscribe({
      next: (data) => { this.todosMedicos.set(data); this.isLoadingDoctors.set(false); },
      error: () => { this.isLoadingDoctors.set(false); this.alertService.error('Error', 'No se pudo cargar la lista de médicos.'); }
    });
  }

  cargarResumenDesacuerdos() {
    this.isLoadingResumen.set(true);
    this.http.get<ResumenDesacuerdos>(`${this.apiUrl}/admin/export/resumen-desacuerdos`).subscribe({
      next: (data) => { this.resumenDesacuerdos.set(data); this.isLoadingResumen.set(false); },
      error: () => { this.isLoadingResumen.set(false); }
    });
  }

  descargarDesacuerdos() {
    this.http.get(`${this.apiUrl}/admin/export/desacuerdos`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `desacuerdos_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.alertService.success('Descarga iniciada', 'El archivo CSV fue generado correctamente.', true);
      },
      error: () => this.alertService.error('Error', 'No se pudo descargar el archivo.')
    });
  }

  aprobarMedico(doctor: DoctorPending) {
    this.procesandoId.set(doctor.id);
    this.http.patch(`${this.apiUrl}/users/admin/${doctor.id}/status`, { action: 'approve' }).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.todosMedicos.update(list => list.map(d => d.id === doctor.id ? { ...d, account_status: 'approved' } : d));
        this.alertService.success('Aprobado', `La cuenta de ${doctor.nombres} fue aprobada. Se le notificó por correo.`, true);
      },
      error: () => { this.procesandoId.set(null); this.alertService.error('Error', 'No se pudo aprobar la cuenta.'); }
    });
  }

  abrirModalRechazo(doctor: DoctorPending) {
    this.doctorSeleccionado.set(doctor);
    this.motivoRechazo.set('');
    this.mostrarModalRechazo.set(true);
  }

  confirmarRechazo() {
    const doctor = this.doctorSeleccionado();
    if (!doctor) return;
    this.procesandoId.set(doctor.id);
    this.http.patch(`${this.apiUrl}/users/admin/${doctor.id}/status`, {
      action: 'reject', reason: this.motivoRechazo() || null
    }).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.todosMedicos.update(list => list.map(d => d.id === doctor.id ? { ...d, account_status: 'rejected' } : d));
        this.mostrarModalRechazo.set(false);
        this.alertService.success('Rechazado', `La cuenta de ${doctor.nombres} fue rechazada. Se le notificó por correo.`, true);
      },
      error: () => { this.procesandoId.set(null); this.alertService.error('Error', 'No se pudo rechazar la cuenta.'); }
    });
  }

  getStatusLabel(status: string): string {
    if (status === 'approved') return 'Aprobado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente';
  }

  getStatusClass(status: string): string {
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    return 'status-pending';
  }
}