import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecommendationResponse } from '../../models/evaluations';

/**
 * Recomendaciones clínicas de una evaluación (tarjetas desplegables,
 * ordenadas por prioridad). Compartido entre el resultado inmediato
 * (evaluation.html) y el modal "Ver" del historial (patient-detail.html)
 * para que ambos se vean y se comporten idénticos.
 */
@Component({
  selector: 'app-clinical-recommendations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clinical-recommendations.html',
  styleUrl: './clinical-recommendations.css',
})
export class ClinicalRecommendationsComponent {
  recommendations = input<RecommendationResponse[] | null | undefined>(null);

  recomendacionesOrdenadas = computed(() =>
    [...(this.recommendations() ?? [])].sort((a, b) => a.priority - b.priority)
  );

  private readonly LABEL_MAP: Record<string, string> = {
    horas_sueno: 'Horas de sueño', vida_social: 'Vida social',
    frecuencia_ejercicio: 'Frecuencia de ejercicio', redes_sociales: 'Redes sociales',
    nivel_estres: 'Nivel de estrés', calidad_sueno: 'Calidad de sueño',
    soledad_percibida: 'Soledad percibida', apoyo_familiar: 'Apoyo familiar',
    autoestima: 'Autoestima',
  };

  getLabelFeature(key: string): string {
    return this.LABEL_MAP[key] ?? key;
  }

  private expandedRecs = signal<Set<number>>(new Set());

  toggleRecomendacion(recId: number) {
    const actuales = new Set(this.expandedRecs());
    if (actuales.has(recId)) actuales.delete(recId);
    else actuales.add(recId);
    this.expandedRecs.set(actuales);
  }

  isRecExpandida(recId: number): boolean {
    return this.expandedRecs().has(recId);
  }
}
