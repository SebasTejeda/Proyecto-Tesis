import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PatientService } from '../../services/patients/patient';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class ResumenComponent implements OnInit {
  private patientService = inject(PatientService);
  private alertService = inject(AlertService);

  pacientes = signal<any[]>([]);
  totalPacientes = signal<number>(0);
  evaluacionesHoy = signal<number>(0);
  casosAltoRiesgo = signal<number>(0);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.cargarPacientes();
  }

  cargarPacientes(){
    this.isLoading.set(true);

    this.patientService.getPatients().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          const pacientesMapeados = data.map((p: any) => {
            const randomProb = Math.floor(Math.random() * 100);
            let riesgoCalc = 'Bajo';
            if (randomProb > 70) riesgoCalc = 'Alto';
            else if (randomProb > 40) riesgoCalc = 'Moderado'

            return {
              ...p,
              fecha: p.created_at ? new Date(p.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
              prob: randomProb,
              riesgo: riesgoCalc
            }
          })

          pacientesMapeados.reverse()

          this.pacientes.set(pacientesMapeados)
          this.totalPacientes.set(pacientesMapeados.length)
          this.casosAltoRiesgo.set(pacientesMapeados.filter(p => p.riesgo === 'Alto').length)
          this.evaluacionesHoy.set(0)
        }
        this.isLoading.set(false)
      },
      error: () => {
        this.isLoading.set(false)
        this.alertService.error('Error', 'No se pudieron cargar los pacientes')
      }
    })
  }

  getClassRiesgo(riesgo: string): string {
    switch (riesgo) {
      case 'Bajo': return 'badge-low'
      case 'Moderado': return 'badge-mod'
      case 'Alto': return 'badge-high'
      default: return ''
    }
  }
}
