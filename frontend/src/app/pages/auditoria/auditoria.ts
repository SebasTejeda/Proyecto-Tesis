import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { EvaluationService } from '../../services/evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { EjecucionModelo } from '../../models/evaluations';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule],
  templateUrl: './auditoria.html',
  styleUrls: ['./auditoria.css'],
})
export class AuditoriaComponent implements OnInit {
  private evalService = inject(EvaluationService);
  private alertService = inject(AlertService);

  ejecuciones = signal<EjecucionModelo[]>([]);
  isLoading = signal(true);

  // Estadísticas rápidas
  get totalEjecuciones() {
    return this.ejecuciones().length;
  }
  get totalConfirmadas() {
    return this.ejecuciones().filter((e) => e.doctor_agreement === 'confirmed')
      .length;
  }
  get totalRechazadas() {
    return this.ejecuciones().filter((e) => e.doctor_agreement === 'rejected')
      .length;
  }
  get totalSinRespuesta() {
    return this.ejecuciones().filter((e) => !e.doctor_agreement).length;
  }

  ngOnInit() {
    this.evalService.getHistorialEjecuciones().subscribe({
      next: (data) => {
        this.ejecuciones.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.alertService.error(
          'Error',
          'No se pudo cargar el historial de ejecuciones.',
        );
      },
    });
  }

  getClassResultado(resultado: string | null): string {
    if (!resultado) return 'badge-gray';
    const r = resultado.toLowerCase();
    if (r.includes('alto')) return 'badge-high';
    if (r.includes('leve')) return 'badge-mod';
    if (r === 'ninguno') return 'badge-low';
    return 'badge-gray';
  }

  getAgreementLabel(agreement: string | null): string {
    if (agreement === 'confirmed') return 'Confirmado';
    if (agreement === 'rejected') return 'No concuerda';
    return 'Pendiente';
  }

  getAgreementClass(agreement: string | null): string {
    if (agreement === 'confirmed') return 'agreement-confirmed';
    if (agreement === 'rejected') return 'agreement-rejected';
    return 'agreement-pending';
  }

  registrarConformidad(
    ejecucion: EjecucionModelo,
    agreement: 'confirmed' | 'rejected',
  ) {
    this.evalService
      .updateAgreement(ejecucion.evaluation_id, agreement)
      .subscribe({
        next: () => {
          // Actualizar localmente sin recargar
          this.ejecuciones.update((list) =>
            list.map((e) =>
              e.evaluation_id === ejecucion.evaluation_id
                ? { ...e, doctor_agreement: agreement }
                : e,
            ),
          );
          this.alertService.success(
            'Registrado',
            agreement === 'confirmed'
              ? 'Diagnóstico confirmado.'
              : 'Desacuerdo registrado.',
            true,
          );
        },
        error: () =>
          this.alertService.error(
            'Error',
            'No se pudo registrar la conformidad.',
          ),
      });
  }

  formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr.endsWith('Z') ? fechaStr : fechaStr + 'Z');
    return fecha.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
