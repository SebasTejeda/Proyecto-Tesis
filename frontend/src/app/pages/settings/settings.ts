import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth/auth';
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
  private router = inject(Router);
  private alertService = inject(AlertService);

  // --- ESTADO REACTIVO CON SIGNALS ---
  isLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);

  // --- DATOS DEL FORMULARIO (ngModel) ---
  nombres: string = '';
  apellidos: string = '';
  email: string = '';
  codigo_colegiatura: string = '';

  // Datos visuales
  initial: string = '';
  userPhoto = signal<string>('');
  role: string = 'Doctor';
  isGoogleAccount = signal(false);

  // Manejo de la foto
  selectedFile: File | null = null;
  previewUrl = signal<string | ArrayBuffer | null>(null);

  // Respaldo para cancelar edición
  private backupData: any = {};

  ngOnInit() {
    // 1. Cargar datos desde caché local para evitar parpadeos
    const cachedUser = this.authService.getUserData();
    if (cachedUser?.foto) this.userPhoto.set(cachedUser.foto);

    const customPic = localStorage.getItem('custom_picture');
    if (customPic) this.userPhoto.set(customPic);

    // 2. Fetch real al backend
    this.cargarDatosUsuario();
  }

  cargarDatosUsuario() {
    this.isLoading.set(true);

    this.authService.getProfile().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (userData) => {
        // Llenar formulario
        this.nombres = userData.nombres || '';
        this.apellidos = userData.apellidos || '';
        this.email = userData.email || '';
        this.codigo_colegiatura = userData.codigo_colegiatura || '';
        this.role = userData.role || 'Doctor';

        // Llenar visuales
        this.userPhoto.set(userData.picture || '');
        this.backupData = { ...userData };

        const primerNombre = this.nombres ? this.nombres.split(' ')[0] : 'U';
        this.initial = primerNombre.charAt(0).toUpperCase();

        // Verificamos si es cuenta de Google leyendo el 'google_id' que manda FastAPI (Mejor que chequear la URL)
        if (userData.google_id) {
          this.isGoogleAccount.set(true);
        }
      },
      error: (err) => {
        this.alertService.error('Error', 'No se pudieron cargar los datos del perfil.');
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
    // ✅ Nueva validación: solo JPG o PNG
    const formatosPermitidos = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!formatosPermitidos.includes(file.type)) {
      this.alertService.error('Formato no soportado', 'Use JPG o PNG.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB Max
      this.alertService.error('Archivo muy grande', 'La imagen no debe superar los 2MB.');
      return;
    }

    this.selectedFile = file;
    this.isEditing.set(true);

    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result);
    reader.readAsDataURL(file);
  }
}

  activarEdicion() {
    this.backupData = {
      nombres: this.nombres,
      apellidos: this.apellidos,
      codigo_colegiatura: this.codigo_colegiatura
    };
    this.isEditing.set(true);
  }

  cancelarEdicion() {
    // Restauramos desde el backup
    this.nombres = this.backupData.nombres || '';
    this.apellidos = this.backupData.apellidos || '';
    this.codigo_colegiatura = this.backupData.codigo_colegiatura || '';

    // Limpiamos la memoria de la foto temporal
    this.selectedFile = null;
    this.previewUrl.set(null);
    this.isEditing.set(false);
  }

  guardarCambios() {
    // Validaciones básicas de seguridad
    if (!this.nombres.trim() || !this.apellidos.trim()) {
      this.alertService.error('Error', 'Los nombres y apellidos no pueden estar vacíos.');
      return;
    }

    this.isSaving.set(true);
    this.alertService.loading('Actualizando perfil en la nube...');

    // CONSTRUCCIÓN DEL FORMDATA (Vital para archivos físicos)
    const formData = new FormData();
    formData.append('nombres', this.nombres);
    formData.append('apellidos', this.apellidos);
    formData.append('codigo_colegiatura', this.codigo_colegiatura);

    if (this.selectedFile) {
      formData.append('foto', this.selectedFile);
    }

    this.authService.updateProfile(formData).pipe(
      finalize(() => {
        this.isSaving.set(false);
        this.alertService.close();
      })
    ).subscribe({
      next: (response) => {
        this.alertService.success('¡Perfil Actualizado!', 'Tus datos se guardaron correctamente.', true);

        // Reiniciamos estado de edición
        this.isEditing.set(false);
        this.selectedFile = null;
        this.previewUrl.set(null);

        // Actualizamos la foto global de la aplicación si Cloudinary nos devolvió una nueva URL
        if (response.picture) {
          this.userPhoto.set(response.picture);
          localStorage.setItem('custom_picture', response.picture);
          this.authService.fotoActualizada.next(response.picture);
        }

        // Actualizamos el backup con los nuevos datos
        this.backupData = {
          nombres: this.nombres,
          apellidos: this.apellidos,
          codigo_colegiatura: this.codigo_colegiatura
        };
      },
      error: () => this.alertService.error('Error', 'No se pudieron guardar los cambios. Intenta nuevamente.')
    });
  }
}
