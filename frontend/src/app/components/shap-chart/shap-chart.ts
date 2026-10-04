import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

/**
 * Gráfico de factores determinantes (SHAP) de una evaluación. Compartido
 * entre el resultado inmediato (evaluation.html) y el modal "Ver" del
 * historial (patient-detail.html) para que ambos se vean idénticos,
 * incluido el mensaje cuando no hay datos de explicabilidad.
 */
@Component({
  selector: 'app-shap-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  templateUrl: './shap-chart.html',
  styleUrl: './shap-chart.css',
})
export class ShapChartComponent {
  shapData = input<any>(null);
  shapOptions = input<any>(null);
}
