import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para *ngIf y *ngFor
import { AuthService } from '../../services/auth/auth';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RegisterComponent } from '../register/register';
import { EvaluationComponent } from '../evaluation/evaluation';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { TableModule } from 'primeng/table';
import { SettingsComponent } from '../settings/settings';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RegisterComponent, EvaluationComponent, RouterModule, TableModule, SettingsComponent], 
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private patientService = inject(PatientService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute)

  totalPacientes: number = 0;
  evaluacionesHoy: number = 0;
  casosAltoRiesgo: number = 0; 

  userName: string = 'Usuario';
  userPhoto: string = '';
  userInitial: string = '';
  currentSection: string = 'resumen'; 

  pacientes: any[] = []

  constructor() {
    // Apenas carga el dashboard, pedimos los datos
    const userData = this.authService.getUserData();
    if (userData) {
      this.userName = userData.nombre;

      this.userInitial = this.userName.charAt(0).toUpperCase();
      // Si tiene foto de Google la usamos, si no, dejamos la por defecto
      if (userData.foto) {
        this.userPhoto = userData.foto;
      }
  }
  }

  ngOnInit(): void {
    this.cargarPacientesReales()

    this.authService.fotoActualizada.subscribe(nuevaFoto => {
      if (nuevaFoto) {
        this.userPhoto = nuevaFoto;
        this.cdr.detectChanges(); // Forzamos actualización visual
      }
    });

    const customPic = localStorage.getItem('custom_picture');
    if (customPic) {
      this.userPhoto = customPic;
    }

    this.route.queryParams.subscribe(params => {
      if(params['tab'] === 'evaluation') {
        this.currentSection = 'evaluacion';
      }
    });
  }


  cargarPacientesReales(){
    this.patientService.getPatients().subscribe({
      next: (data) => {
        
        // Verificamos que sea un arreglo antes de intentar mapearlo
        if (Array.isArray(data)) {
          this.pacientes = data.map((p: any) => {
            const randomProb = Math.floor(Math.random() * 100);
            let riesgoCalc = 'Bajo';
            if (randomProb > 70) riesgoCalc = 'Alto';
            else if (randomProb > 40) riesgoCalc = 'Moderado';

            // Blindaje para la fecha: Si no viene created_at, usamos la fecha de hoy
            const fechaString = p.created_at 
              ? new Date(p.created_at).toLocaleDateString() 
              : new Date().toLocaleDateString();

            return {
              ...p,
              fecha: fechaString,
              prob: randomProb,
              riesgo: riesgoCalc
            };
          });

          this.totalPacientes = this.pacientes.length;
          this.casosAltoRiesgo = this.pacientes.filter(p => p.riesgo === 'Alto').length;

          this.evaluacionesHoy = 0
          
          this.pacientes.reverse();
          
          // 3. ¡LA CLAVE! Forzamos a Angular a pintar los cambios
          this.cdr.detectChanges(); 
          
        }
      },
      error: (err) => {
        this.alertService.error('Error', 'No se pudieron cargar los pacientes.');
      }
    });
  }

  // Función para cambiar de sección desde el menú lateral
  cambiarSeccion(seccion: string) {
    this.currentSection = seccion;
    if (seccion === 'resumen') {
      this.cargarPacientesReales(); // Recargamos los pacientes al volver al resumen
    }
  }

  async logout() {
    const confirmado = await this.alertService.confirm('¿Cerrar sesión?', '¿Estás seguro de que deseas cerrar sesión?');
    if (confirmado) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
  
  // Función auxiliar para el color de la etiqueta
  getClassRiesgo(riesgo: string): string {
    switch(riesgo) {
      case 'Bajo': return 'badge-low';
      case 'Moderado': return 'badge-mod';
      case 'Alto': return 'badge-high';
      default: return '';
    }
  }
}