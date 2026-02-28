import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AlertService } from '../../services/alert/alert';

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
  private alertService = inject(AlertService);

  nombres: string = '';
  apellidos: string = '';
  email: string = '';
  codigo_colegiatura: string = '';

  private backupData: any = {};

  initial: string = '';
  userPhoto: string = '';
  role: string = '';

  isLoading: boolean = true;
  isEditing: boolean = false;

  isGoogleAccount: boolean = false;

  selectedFile: File | null = null;
  previewUrl : string | ArrayBuffer | null = null;

  constructor() { }

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

        // Detectar si la cuenta es de Google a través de la URL de la imagen
        if(userData.picture && userData.picture.includes('googleusercontent.com')){
          this.isGoogleAccount = true;
        }
      },
      error: (err) => {
        this.alertService.error('Error', 'No se pudieron cargar los datos del usuario. Por favor, inténtalo de nuevo.');

        if (err.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    
    if (file) {
      // Validar tamaño (Máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.alertService.error('Archivo muy grande', 'La imagen no debe superar los 2MB.');
        return;
      }

      this.selectedFile = file;
      this.isEditing = true; // Habilita el botón de guardar

      // Generar previsualización para mostrarla instantáneamente en pantalla
      const reader = new FileReader();
      reader.onload = (e) => this.previewUrl = reader.result;
      reader.readAsDataURL(file);
    }
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
    
    // Si cancela, también limpiamos la previsualización de la foto
    this.selectedFile = null;
    this.previewUrl = null;
    this.isEditing = false;
  }

  guardarCambios() {
    this.isLoading = true;
    this.alertService.loading('Guardando cambios...');
    
    const formData = new FormData();
    formData.append('nombres', this.nombres);
    formData.append('apellidos', this.apellidos);
    formData.append('codigo_colegiatura', this.codigo_colegiatura);

    if (this.selectedFile) {
      formData.append('foto', this.selectedFile);
    }
    
    this.authService.updateProfile(formData).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.alertService.success('Éxito', 'Tu perfil ha sido actualizado correctamente.');
        this.isEditing = false;
        this.selectedFile = null; // Limpiamos el archivo seleccionado
        
        // Actualizamos el backup manualmente con las variables actuales
        this.backupData = { 
          nombres: this.nombres, 
          apellidos: this.apellidos, 
          codigo_colegiatura: this.codigo_colegiatura 
        }; 
      },
      error: (err) => {
        this.alertService.error('Error', 'No se pudieron guardar los cambios. Por favor, inténtalo de nuevo.');
      }
    });
  }

}