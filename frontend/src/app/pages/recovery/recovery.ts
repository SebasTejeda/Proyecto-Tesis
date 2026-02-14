import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-recovery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './recovery.html',
  styleUrl: './recovery.css',
})
export class RecoveryComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Controla qué pantalla mostramos: 1 (Email), 2 (Código), 3 (Nueva Password)
  currentStep: number = 1; 
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  // Guardamos el email para usarlo en todos los pasos
  emailGuardado: string = '';
  // Guardamos el código verificado
  codigoGuardado: string = '';

  // Formularios para cada paso
  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
  });

  passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  // PASO 1: Enviar Correo
  // PASO 1: Enviar Correo
sendCode() {
  if (this.emailForm.invalid) return;
  
  this.isLoading = true;
  const email = this.emailForm.value.email!;
  this.errorMessage = '';
  this.successMessage = '';

  this.authService.requestRecovery(email).pipe(finalize(()=>{
      this.isLoading = false; // Cambiamos el estado
      this.cdr.detectChanges(); // <--- ¡ESTO FUERZA EL REFRESCO VISUAL!

  })).subscribe({
    next: () => {
      this.emailGuardado = email;
      this.currentStep = 2;
      this.successMessage = 'Código enviado. Revisa tu correo.';
      this.cdr.detectChanges(); // Refrescamos para mostrar el nuevo paso y mensaje de éxito
      
    },
    error: (err) => {
      if (err.status === 403) {
        this.errorMessage = 'Esta cuenta usa Google para iniciar sesión. Intenta con Google.';
      }
      else if (err.status === 404) {
        this.errorMessage = 'Correo no registrado.';
      }
      else{
          this.errorMessage = 'Error al enviar el código. Intenta nuevamente.';
      }
      this.cdr.detectChanges(); // También en el error
    }
  });
}

  // PASO 2: Verificar Código
  verifyCode() {
    if (this.codeForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    const code = this.codeForm.value.code!;

    this.authService.verifyCode(this.emailGuardado, code)
    .pipe(
      finalize(() => {
        this.isLoading = false; // Cambiamos el estado
        this.cdr.detectChanges(); // <--- ¡ESTO FUERZA EL REFRESCO VISUAL!
      })
    )
    .subscribe({
      next: () => {
        this.codigoGuardado = code;
        this.currentStep = 3; // Avanzamos al paso 3
        this.successMessage = '';

        this.cdr.detectChanges(); // Refrescamos para mostrar el nuevo paso y mensaje de éxito
      },
      error: () => {
        this.errorMessage = 'Código incorrecto o expirado.';

        this.cdr.detectChanges(); // Refrescamos para mostrar el mensaje de error
      }
    });
  }

  // PASO 3: Cambiar Contraseña
  changePassword() {
    if (this.passwordForm.invalid) return;
    
    const pass = this.passwordForm.value.newPassword!;
    const confirm = this.passwordForm.value.confirmPassword!;

    if (pass !== confirm) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword(this.emailGuardado, this.codigoGuardado, pass).subscribe({
      next: () => {
        alert('¡Contraseña actualizada! Ahora puedes iniciar sesión.');
        this.router.navigate(['/login']);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Error al actualizar la contraseña.';
      }
    });
  }
}
