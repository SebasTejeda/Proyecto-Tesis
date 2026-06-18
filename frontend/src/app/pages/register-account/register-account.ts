import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth/auth';
import { AlertService } from '../../services/alert/alert';
import { RegisterData } from '../../models/auth';

@Component({
  selector: 'app-register-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register-account.html',
  styleUrl: './register-account.css',
})
export class RegisterAccountComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);

  // Paso 1: Formulario, Paso 2: Verificar correo, Paso 3: Cuenta pendiente
  currentStep = signal(1);
  emailRegistrado = signal('');
  isLoading = signal(false);

  verificationCode = new FormControl('', [
    Validators.required,
    Validators.minLength(4),
    Validators.maxLength(4),
    Validators.pattern('^[0-9]{4}$')
  ]);

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  registerForm = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    codigo_colegiatura: ['', [Validators.required, Validators.minLength(4)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.alertService.error('Formulario Inválido', 'Por favor revisa todos los campos.');
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Registrando y enviando código...');

    const { nombres, apellidos, codigo_colegiatura, email, password } = this.registerForm.getRawValue();
    const formData: RegisterData = { nombres, apellidos, codigo_colegiatura, email, password };

    this.authService.register(formData)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.emailRegistrado.set(email);
          this.verificationCode.reset();
          this.currentStep.set(2);
          this.alertService.success('¡Registro Exitoso!', 'Te hemos enviado un código a tu correo.');
        },
        error: (err) => {
          const detail = err.error?.detail;
          const msg = detail === 'El correo ya está registrado.'
            ? detail : 'No se pudo crear la cuenta. Intenta nuevamente.';
          this.alertService.error('Error de Registro', msg);
        }
      });
  }

  onVerifyCode() {
    if (this.verificationCode.invalid) {
      this.verificationCode.markAsTouched();
      this.alertService.error('Código Inválido', 'El código debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Verificando cuenta...');

    this.authService.verifyAccount(this.emailRegistrado(), this.verificationCode.value!)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          // Verificación exitosa → mostrar pantalla de pendiente
          this.alertService.close();
          this.currentStep.set(3);
        },
        error: (err) => {
          let msg = 'Código incorrecto. Intenta nuevamente.';
          if (err.error?.detail) {
            msg = typeof err.error.detail === 'string' ? err.error.detail : msg;
          }
          this.alertService.error('Error de Verificación', msg);
        }
      });
  }
}