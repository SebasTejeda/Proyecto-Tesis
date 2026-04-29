import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation'; // <-- NUEVO
import { AlertService } from '../../services/alert/alert';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class ResumenComponent implements OnInit {
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService); // <-- Inyectamos el servicio
  private alertService = inject(AlertService);

  pacientes = signal<any[]>([]);
  totalPacientes = signal<number>(0);
  evaluacionesHoy = signal<number>(0);
  casosAltoRiesgo = signal<number>(0);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.cargarPacientes();
  }

  // Función matemática para calcular la edad exacta
  calcularEdad(fecha_nacimiento: string | Date | undefined): number | string {
    if (!fecha_nacimiento) return '--';
    const hoy = new Date();
    const fechaNac = new Date(fecha_nacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  cargarPacientes() {
    this.isLoading.set(true);

    this.patientService
      .getPatients()
      .pipe(
        switchMap((pacientes) => {
          if (!pacientes || pacientes.length === 0) {
            return of([]); // Si no hay pacientes, devolvemos un array vacío
          }

          // Creamos múltiples peticiones simultáneas para buscar la última evaluación de cada paciente
          const peticiones = pacientes.map((p: any) =>
            this.evalService.getPatientEvaluations(p.id).pipe(
              catchError(() => of([])), // Si falla un historial, devuelve vacío para ese paciente
              map((evaluaciones) => {
                // El backend ya nos manda las evaluaciones ordenadas de más nueva a más vieja
                const ultimaEval =
                  evaluaciones.length > 0 ? evaluaciones[0] : null;

                // Extraemos los datos reales
                const porcentaje = ultimaEval
                  ? Math.round((ultimaEval.phq9_puntaje / 27) * 100)
                  : 0;
                // Agregamos un fallback seguro con ( || 'Sin evaluar') por si alguna evaluación antigua vino sin resultado
                const riesgoReal = ultimaEval
                  ? ultimaEval.resultado || 'Sin evaluar'
                  : 'Sin evaluar';

                // Ajustamos la zona horaria agregando 'Z' como hicimos en el detalle
                const fechaCorregida = ultimaEval
                  ? ultimaEval.fecha.endsWith('Z')
                    ? ultimaEval.fecha
                    : ultimaEval.fecha + 'Z'
                  : null;

                return {
                  ...p,
                  edad: this.calcularEdad(p.fecha_nacimiento),
                  fecha_ultima_eval: fechaCorregida
                    ? new Date(fechaCorregida).toLocaleDateString()
                    : 'No registrada',
                  fecha_raw: fechaCorregida
                    ? new Date(fechaCorregida)
                    : new Date(0), // Para ordenar la tabla
                  prob: porcentaje,
                  riesgo: riesgoReal,
                };
              }),
            ),
          );

          // Ejecutamos todas las búsquedas en paralelo
          return forkJoin(peticiones);
        }),
      )
      .subscribe({
        next: (pacientesCompletos: any[]) => {
          // Ordenamos la tabla para que los evaluados más recientemente salgan arriba
          pacientesCompletos.sort(
            (a, b) => b.fecha_raw.getTime() - a.fecha_raw.getTime(),
          );

          this.pacientes.set(pacientesCompletos);
          this.totalPacientes.set(pacientesCompletos.length);

          // Calculamos casos de alto riesgo reales (Moderadamente Severo o Severo)
          const casosAltos = pacientesCompletos.filter((p) =>
            p.riesgo.toLowerCase().includes('severo'),
          ).length;
          this.casosAltoRiesgo.set(casosAltos);

          // Calculamos cuántas evaluaciones se hicieron HOY
          const hoy = new Date().toLocaleDateString();
          const evHoy = pacientesCompletos.filter(
            (p) => p.fecha_ultima_eval === hoy,
          ).length;
          this.evaluacionesHoy.set(evHoy);

          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.alertService.error(
            'Error',
            'No se pudieron cargar los datos del panel.',
          );
          console.error(err);
        },
      });
  }

  // Traductor de colores para la tabla (igual al de PatientDetail)
  getClassRiesgo(riesgo: string): string {
    if (!riesgo) return 'badge-low';
    const r = riesgo.toLowerCase();
    if (r.includes('severo') || r.includes('alto')) return 'badge-high';
    if (r.includes('moderado')) return 'badge-mod';
    if (r === 'sin evaluar') return 'badge-gray'; // Por si acaban de registrar a alguien
    return 'badge-low';
  }
}
