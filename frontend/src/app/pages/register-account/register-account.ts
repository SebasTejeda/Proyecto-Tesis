import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, RegisterData } from '../../services/auth/auth';

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
  private cdr = inject(ChangeDetectorRef);

  // ESTADO: 1 = Formulario, 2 = Verificar Código
  currentStep: number = 1;
  emailRegistrado: string = '';
  
  isLoading: boolean = false;
  errorMessage: string = '';

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  registerForm = this.fb.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    codigo_colegiatura: ['', [Validators.required, Validators.minLength(4)]], 
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  // PASO 1: Enviar datos y recibir el código
  onSubmit() {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const formData: RegisterData = {
      nombres: this.registerForm.value.nombres!,
      apellidos: this.registerForm.value.apellidos!,
      codigo_colegiatura: this.registerForm.value.codigo_colegiatura!,
      email: this.registerForm.value.email!,
      password: this.registerForm.value.password!
    };

    this.authService.register(formData)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          // ÉXITO: Guardamos el email y pasamos al paso 2
          this.emailRegistrado = formData.email;
          this.currentStep = 2; 
        },
        error: (err) => {
          if (err.status === 400) {
            this.errorMessage = 'El correo electrónico ya está registrado.';
          } else {
            this.errorMessage = 'Error al registrar. Intenta nuevamente.';
          }
          console.error(err);
        }
      });
  }

  // PASO 2: Verificar el código ingresado
  onVerifyCode(codigo: string) {
    if (!codigo || codigo.length !== 4) {
      this.errorMessage = 'El código debe tener 4 dígitos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.verifyAccount(this.emailRegistrado, codigo)
      .pipe(finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          alert('¡Cuenta verificada exitosamente! Ahora puedes iniciar sesión.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.errorMessage = 'Código incorrecto. Verifica tu correo.';
          console.error(err);
        }
      });
  }
}