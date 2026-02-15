import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, RegisterData } from '../../services/auth/auth';
import { AlertService } from '../../services/alert/alert';

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
  private alertService = inject(AlertService);

  currentStep: number = 1;
  emailRegistrado: string = '';
  isLoading: boolean = false;

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
    if (this.registerForm.invalid) {
        this.alertService.error('Formulario Inválido', 'Por favor revisa todos los campos.');
        return;
    }

    this.isLoading = true;

    const formData: RegisterData = {
      nombres: this.registerForm.value.nombres!,
      apellidos: this.registerForm.value.apellidos!,
      codigo_colegiatura: this.registerForm.value.codigo_colegiatura!,
      email: this.registerForm.value.email!,
      password: this.registerForm.value.password!
    };

    this.alertService.loading('Registrando y enviando código...');
    
    this.authService.register(formData)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.alertService.close();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.emailRegistrado = formData.email;
          this.currentStep = 2; 
          this.alertService.success('¡Registro Exitoso!', 'Te hemos enviado un código a tu correo.');
        },
        error: (err) => {
          if (err.status === 400) {
            this.alertService.error('Error de Registro', 'El correo electrónico ya está registrado.');
          } else {
            this.alertService.error('Error', 'No se pudo crear la cuenta. Intenta nuevamente.');
          }
        }
      });
  }

  // PASO 2: Verificar el código ingresado
  onVerifyCode(codigo: string) {
    if (!codigo || codigo.length !== 4) {
      this.alertService.error('Error', 'El código debe tener 4 dígitos.');
      return;
    }

    this.isLoading = true;
    this.alertService.loading('Verificando cuenta...');

    this.authService.verifyAccount(this.emailRegistrado, codigo)
      .pipe(finalize(() => { 
          this.isLoading = false; 
          this.alertService.close();
          this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: () => {
          this.alertService.success('¡Cuenta Verificada!', 'Bienvenido a NeuroMind AI. Ahora puedes iniciar sesión.');
          this.router.navigate(['/login']);
        },
        error: () => {
          this.alertService.error('Error', 'Código incorrecto. Verifica tu correo.');
        }
      });
  }
}