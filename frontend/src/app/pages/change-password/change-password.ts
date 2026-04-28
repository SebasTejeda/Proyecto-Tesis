import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { finalize, take } from 'rxjs';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);

  currentStep = signal(1);
  emailUsuario = signal('');
  codigoGuardado = signal('');
  isLoading = signal(true);
  enviandoCodigo = signal(false);

  codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
  });

  passwordMatchValidator(control:AbstractControl): ValidationErrors | null {
    const password = control.get('newPassword')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  passwordForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, {validators: this.passwordMatchValidator});

  ngOnInit(): void {
    this.authService.getProfile().pipe(take(1)).subscribe({
      next: (user) => {
        this.emailUsuario.set(user.email);
        if (this.emailUsuario()) this.enviarCodigo();
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo obtener tu perfil. Inicia sesión nuevamente.');
        this.isLoading.set(false);
      }
    });
  }

  enviarCodigo(): void {
    if (this.enviandoCodigo()) return;

    this.isLoading.set(true);
    this.enviandoCodigo.set(true);

    this.authService.requestRecovery(this.emailUsuario())
    .pipe(
      take(1),
      finalize(() => {
        this.isLoading.set(false);
        this.enviandoCodigo.set(false);
      })
    )
    .subscribe({
      next: () => {
                this.alertService.success('Código Enviado', `Revisa tu correo ${this.emailUsuario()}`, true);
      },
      error: (err) => {
        if (err.status === 403) {
          this.alertService.error('Cuenta de Google', 'Tu cuenta es de Google, no necesitas cambiar la contraseña aquí.');
        } else {
          this.alertService.error('Error', 'No se pudo enviar el código. Intenta nuevamente.');
        }
      }
    })
  }

  limpiarCodigo(event: any){
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, '');
    this.codeForm.controls.code.setValue(input.value);
  }

  verifyCode(){
    if (this.codeForm.invalid){
      this.alertService.error('Código Inválido', 'El código debe tener 4 dígitos numéricos.');
      this.codeForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const code = this.codeForm.getRawValue().code;

    this.authService.verifyCode(this.emailUsuario(), code)
    .pipe(finalize(() => {
      this.isLoading.set(false);
    }))
    .subscribe({
      next: () => {
        this.codigoGuardado.set(code);
        this.currentStep.set(2);
      },
      error: () => {
        this.alertService.error('Error', 'Código incorrecto o expirado.');
      }
    })
  }

  changePassword(){
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.alertService.error('Formulario Inválido', 'Completa los campos correctamente.');
      return;
    }
    const {newPassword} = this.passwordForm.getRawValue();

    this.isLoading.set(true);
    this.alertService.loading('Actualizando contraseña...');
    
    this.authService.resetPassword(this.emailUsuario(), this.codigoGuardado(), newPassword)
    .pipe(finalize(() => {
      this.isLoading.set(false);
    }))
    .subscribe({
      next: () => {
        this.alertService.close();
        this.alertService.success('Contraseña Actualizada', 'Tu clave ha sido modificada con éxito.');
        this.router.navigate(['/dashboard/settings']);
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error', 'No se pudo actualizar la contraseña. Intenta nuevamente.');
      }
    })
  }
}