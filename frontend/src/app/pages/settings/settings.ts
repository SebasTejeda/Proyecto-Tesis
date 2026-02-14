import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  nombres: string = '';
  apellidos: string = ''
  email: string = '';
  codigo_colegiatura: string = '';

  private backupData: any = {};

  initial: string = '';
  userPhoto: string = '';
  role: string = '';

  isLoading: boolean = true;
  isEditing: boolean = false;

  ngOnInit() {
    this.cargarDatosUsuario();
  }

  cargarDatosUsuario() {
    this.isLoading = true;

    this.authService.getProfile()
    .pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (userData) => {
        
        this.nombres = userData.nombres || '';
        this.apellidos = userData.apellidos || '';
        this.email = userData.email || '';
        this.codigo_colegiatura = userData.codigo_colegiatura || '';

        this.userPhoto = userData.picture || '';

        this.backupData = { ...userData }; // Guardamos una copia para poder cancelar ediciones

        const primerNombre = this.nombres ? this.nombres.split(' ')[0] : 'U';
        this.initial = primerNombre.charAt(0).toUpperCase();
      },
      error: (err) => {
        console.error('Error al cargar datos del usuario:', err);

        if (err.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  activarEdicion() {
    this.backupData = {
      nombres: this.nombres,
      apellidos: this.apellidos,
      codigo_colegiatura: this.codigo_colegiatura
    };
    this.isEditing = true;
  }

  cancelarEdicion() {
    this.nombres = this.backupData.nombres || '';
    this.apellidos = this.backupData.apellidos || '';
    this.codigo_colegiatura = this.backupData.codigo_colegiatura || '';
    this.isEditing = false;
  }

  guardarCambios() {
    this.isLoading = true;
    const datosActualizados = {
      nombre: this.nombres,
      apellidos: this.apellidos,
      codigo_colegiatura: this.codigo_colegiatura
    }

    this.authService.updateProfile(datosActualizados).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        console.log('Perfil actualizado:', response);
        this.isEditing = false;
        this.backupData = { ...datosActualizados }; // Actualizamos el backup con los nuevos datos
      },
      error: (err) => {
        console.error('Error al actualizar perfil:', err);
      }
    });
  }

}
