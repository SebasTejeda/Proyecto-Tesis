import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EvaluationService, EjecucionModelo } from '../../services/evaluation/evaluation';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-panel fade-in">
      <div class="page-header">
        <h1 class="page-title">Panel de Administración</h1>
        <p class="page-subtitle">Resumen global del sistema NeuroMind AI</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-label">Total Evaluaciones</div>
            <div class="stat-icon-box blue"><i class="pi pi-chart-bar"></i></div>
          </div>
          <div class="stat-value">{{ totalEval() }}</div>
          <div class="stat-change">En todo el sistema</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-label">Tasa de Confirmación</div>
            <div class="stat-icon-box green"><i class="pi pi-check-circle"></i></div>
          </div>
          <div class="stat-value">{{ tasaConfirmacion() }}%</div>
          <div class="stat-change">Concordancia con el modelo</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-label">Tasa de Desacuerdo</div>
            <div class="stat-icon-box coral"><i class="pi pi-times-circle"></i></div>
          </div>
          <div class="stat-value">{{ tasaDesacuerdo() }}%</div>
          <div class="stat-change warn-text">Para mejorar el modelo</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-label">Versión Actual</div>
            <div class="stat-icon-box purple"><i class="pi pi-microchip-ai"></i></div>
          </div>
          <div class="stat-value">v1.0</div>
          <div class="stat-change">XGBoost + SHAP</div>
        </div>
      </div>

      <div class="quick-actions">
        <h2 class="section-title">Accesos Rápidos</h2>
        <div class="actions-grid">
          <a routerLink="/admin/historial" class="action-card">
            <i class="pi pi-history"></i>
            <span>Ver Historial Completo</span>
            <small>Todas las ejecuciones del modelo</small>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-panel { padding: 0; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-family: 'Playfair Display', serif; font-size: 26px; color: #1e293b; margin: 0 0 6px 0; }
    .page-subtitle { color: #64748b; margin: 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; padding: 20px; border-radius: 14px; border: 1px solid #f1f5f9; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
    .stat-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .stat-label { color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-value { font-size: 28px; font-weight: 700; color: #1e293b; font-family: 'Playfair Display', serif; }
    .stat-change { font-size: 12px; color: #10b981; margin-top: 4px; }
    .warn-text { color: #ef4444; }
    .stat-icon-box { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-box i { font-size: 1.2rem; }
    .stat-icon-box.blue   { background: #eff6ff; color: #3b82f6; }
    .stat-icon-box.green  { background: #f0fdf4; color: #10b981; }
    .stat-icon-box.coral  { background: #fef2f2; color: #ef4444; }
    .stat-icon-box.purple { background: #e0e7ff; color: #4338ca; }
    .section-title { font-size: 1.1rem; color: #1e293b; margin: 0 0 16px 0; font-weight: 600; }
    .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .action-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: #1e293b; transition: all 0.2s; }
    .action-card:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.1); transform: translateY(-1px); }
    .action-card i { font-size: 1.5rem; color: #3b82f6; margin-bottom: 4px; }
    .action-card span { font-weight: 600; font-size: 0.95rem; }
    .action-card small { color: #94a3b8; font-size: 0.8rem; }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class AdminPanelComponent implements OnInit {
  private evalService = inject(EvaluationService);

  totalEval = signal(0);
  tasaConfirmacion = signal(0);
  tasaDesacuerdo = signal(0);

  ngOnInit() {
    this.evalService.getHistorialAdmin().subscribe({
      next: (data: EjecucionModelo[]) => {
        this.totalEval.set(data.length);
        const conRespuesta = data.filter(e => e.doctor_agreement);
        if (conRespuesta.length > 0) {
          const confirmados = conRespuesta.filter(e => e.doctor_agreement === 'confirmed').length;
          const rechazados  = conRespuesta.filter(e => e.doctor_agreement === 'rejected').length;
          this.tasaConfirmacion.set(Math.round((confirmados / this.totalEval()) * 100));
          this.tasaDesacuerdo.set(Math.round((rechazados / this.totalEval()) * 100));
        }
      }
    });
  }
}