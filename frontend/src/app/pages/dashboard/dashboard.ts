import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para *ngIf y *ngFor
import { AuthService } from '../../services/auth/auth';
import { Router, RouterModule } from '@angular/router';
import { RegisterComponent } from '../register/register';
import { EvaluationComponent } from '../evaluation/evaluation';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RegisterComponent, EvaluationComponent, RouterModule], 
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  userName: string = 'Usuario';
  userPhoto: string = '';
  userInitial: string = '';
  currentSection: string = 'resumen'; 

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

  // Datos de prueba para que la tabla no se vea vacía
  pacientesRecientes = [
    { nombre: 'María González', edad: 34, fecha: '09/01/2026', prob: 27, riesgo: 'Bajo' },
    { nombre: 'Carlos Mendoza', edad: 42, fecha: '09/01/2026', prob: 68, riesgo: 'Moderado' },
    { nombre: 'Ana Martínez', edad: 28, fecha: '08/01/2026', prob: 85, riesgo: 'Alto' },
    { nombre: 'Jorge Silva', edad: 51, fecha: '08/01/2026', prob: 45, riesgo: 'Moderado' },
    { nombre: 'Lucía Fernández', edad: 37, fecha: '07/01/2026', prob: 15, riesgo: 'Bajo' },
    { nombre: 'Pedro Ramírez', edad: 60, fecha: '07/01/2026', prob: 92, riesgo: 'Alto' },
    { nombre: 'Sofía Torres', edad: 30, fecha: '06/01/2026', prob: 33, riesgo: 'Bajo' },
    { nombre: 'Diego López', edad: 45, fecha: '06/01/2026', prob: 74, riesgo: 'Moderado' }
  ];

  // Función para cambiar de sección desde el menú lateral
  cambiarSeccion(seccion: string) {
    this.currentSection = seccion;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
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