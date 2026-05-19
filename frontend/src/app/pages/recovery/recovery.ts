import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { AlertService } from '../../services/alert/alert';
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
  private alertService = inject(AlertService);

  currentStep = signal(1);
  isLoading = signal(false);

  emailGuardado = signal('');
  codigoGuardado = signal('');

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const pass = control.get('newPassword')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  codeForm = this.fb.group({
    code: ['', [
      Validators.required,
      Validators.minLength(4),
      Validators.maxLength(4),
      Validators.pattern('^[0-9]{4}$')
    ]]
  });

  passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  // PASO 1: Enviar correo
  sendCode() {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      this.alertService.error('Correo Inválido', 'Por favor ingresa un correo electrónico válido.');
      return;
    }

    const email = this.emailForm.value.email!;
    this.isLoading.set(true);
    this.alertService.loading('Enviando código...');

    this.authService.requestRecovery(email)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.emailGuardado.set(email);
          this.currentStep.set(2);
          this.alertService.success('¡Código Enviado!', `Hemos enviado los dígitos a ${email}`);
        },
        error: (err) => {
          if (err.status === 403) {
            this.alertService.error('Cuenta de Google', 'Esta cuenta inicia sesión con Google. No es necesario recuperar contraseña.')
              .then(() => this.router.navigate(['/login']));
          } else if (err.status === 404) {
            this.alertService.error('Correo No Encontrado', 'Este correo no está registrado en nuestro sistema.');
          } else {
            this.alertService.error('Error', 'No se pudo enviar el código. Intenta más tarde.');
          }
        }
      });
  }

  // PASO 2: Verificar código
  verifyCode() {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      this.alertService.error('Código Inválido', 'El código debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    const code = this.codeForm.value.code!;
    this.isLoading.set(true);
    this.alertService.loading('Verificando...');

    this.authService.verifyCode(this.emailGuardado(), code)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.codigoGuardado.set(code);
          this.currentStep.set(3);
          this.alertService.success('Código Correcto', 'Ahora crea tu nueva contraseña.');
        },
        error: () => {
          this.alertService.error('Código Incorrecto', 'El código ingresado es incorrecto o ha expirado.');
        }
      });
  }

  // PASO 3: Cambiar contraseña
  changePassword() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const newPassword = this.passwordForm.value.newPassword!;
    this.isLoading.set(true);
    this.alertService.loading('Actualizando contraseña...');

    this.authService.resetPassword(this.emailGuardado(), this.codigoGuardado(), newPassword)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.alertService.success('¡Recuperación Exitosa!', 'Tu contraseña ha sido restablecida. Inicia sesión.');
          this.router.navigate(['/login']);
        },
        error: () => {
          this.alertService.error('Error', 'No se pudo actualizar la contraseña. Intenta nuevamente.');
        }
      });
  }
}