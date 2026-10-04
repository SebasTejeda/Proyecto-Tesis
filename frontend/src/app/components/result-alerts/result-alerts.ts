import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Avisos del resultado de una evaluación (nivel Moderado/Alto y baja
 * confianza del modelo). Compartido entre el resultado inmediato
 * (evaluation.html) y el modal "Ver" del historial (patient-detail.html)
 * para que ambos muestren exactamente los mismos avisos con el mismo estilo.
 */
@Component({
  selector: 'app-result-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result-alerts.html',
  styleUrl: './result-alerts.css',
})
export class ResultAlertsComponent {
  severidad = input<string | null | undefined>(null);
  /** Fracción 0-1 (model_prediction.risk_probability), no porcentaje redondeado. */
  probabilidad = input<number | null | undefined>(null);

  esModeradoAlto = computed(() => this.severidad() === 'Moderado/Alto');

  bajaConfianza = computed(() => {
    const p = this.probabilidad();
    if (p == null) return false;
    const pct = p * 100;
    return pct >= 40 && pct <= 60;
  });
}
