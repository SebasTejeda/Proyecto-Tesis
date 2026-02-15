import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { finalize } from 'rxjs';
import { AlertService } from '../../services/alert/alert';

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
  private alertService = inject(AlertService);

  currentStep: number = 1; 
  isLoading: boolean = false;

  emailGuardado: string = '';
  codigoGuardado: string = '';

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
  sendCode() {
    if (this.emailForm.invalid) {
      this.alertService.error('Correo Inválido', 'Por favor ingresa un correo electrónico válido.');
      return;
    }
    
    this.isLoading = true;
    const email = this.emailForm.value.email!;
    this.alertService.loading('Enviando código...');

    this.authService.requestRecovery(email).pipe(finalize(()=>{
        this.isLoading = false;
        this.alertService.close();
        this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.emailGuardado = email;
        this.currentStep = 2;
        this.alertService.success('¡Código Enviado!', `Hemos enviado los dígitos a ${email}`);
      },
      error: (err) => {
        if (err.status === 403) {
          this.alertService.error('Cuenta de Google', 'Esta cuenta usa Google. Inicia sesión con el botón de Google.');
        } else if (err.status === 404) {
          this.alertService.error('Correo No Encontrado', 'Este correo no está registrado en nuestro sistema.');
        } else {
          this.alertService.error('Error', 'No se pudo enviar el código. Intenta más tarde.');
        }
      }
    });
  }

  // PASO 2: Verificar Código
  verifyCode() {
    if (this.codeForm.invalid) {
      this.alertService.error('Código Inválido', 'El código debe tener 4 dígitos.');
      return;
    }

    this.isLoading = true;
    const code = this.codeForm.value.code!;
    this.alertService.loading('Verificando...');

    this.authService.verifyCode(this.emailGuardado, code)
    .pipe(
      finalize(() => {
        this.isLoading = false;
        this.alertService.close();
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: () => {
        this.codigoGuardado = code;
        this.currentStep = 3;
        this.alertService.success('Código Correcto', 'Ahora crea tu nueva contraseña.');
      },
      error: () => {
        this.alertService.error('Error', 'El código ingresado es incorrecto o ha expirado.');
      }
    });
  }

  // PASO 3: Cambiar Contraseña
  changePassword() {
    if (this.passwordForm.invalid) return;
    
    const pass = this.passwordForm.value.newPassword!;
    const confirm = this.passwordForm.value.confirmPassword!;

    if (pass !== confirm) {
      this.alertService.error('Error', 'Las contraseñas no coinciden.');
      return;
    }

    this.isLoading = true;
    this.alertService.loading('Actualizando contraseña...');

    this.authService.resetPassword(this.emailGuardado, this.codigoGuardado, pass).subscribe({
      next: () => {
        this.alertService.success('¡Recuperación Exitosa!', 'Tu contraseña ha sido restablecida. Inicia sesión.');
        this.router.navigate(['/login']);
      },
      error: () => {
        this.isLoading = false;
        this.alertService.close();
        this.alertService.error('Error', 'No se pudo actualizar la contraseña.');
      }
    });
  }
}