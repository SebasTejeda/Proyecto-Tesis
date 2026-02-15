import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  private cdr = inject(ChangeDetectorRef);
  private alertService = inject(AlertService);

  currentStep: number = 1;
  emailUsuario: string = '';
  codigoGuardado: string = '';
  isLoading: boolean = true;
  enviandoCodigo: boolean = false;

  codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
  });

  passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.authService.getProfile().pipe(take(1)).subscribe({
      next: (user) => {
        this.emailUsuario = user.email;
        if (this.emailUsuario) this.enviarCodigo();
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo obtener tu perfil. Inicia sesión nuevamente.');
        this.isLoading = false;
      }
    });
  }

  enviarCodigo(): void {
    if (this.enviandoCodigo) return;      

    this.isLoading = true;
    this.enviandoCodigo = true;

    this.authService.requestRecovery(this.emailUsuario)
    .pipe(
      take(1),
      finalize(() => {
        this.isLoading = false;
        this.enviandoCodigo = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: () => {
        // Usamos Toast o Success para avisar que se envió
        this.alertService.success('Código Enviado', `Revisa tu correo ${this.emailUsuario}`);
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
    this.codeForm.controls['code'].setValue(input.value);
  }

  verifyCode(){       
    if (this.codeForm.invalid){
      this.alertService.error('Código Inválido', 'El código debe tener 4 dígitos numéricos.');
      this.codeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const code = this.codeForm.value.code!; 

    this.authService.verifyCode(this.emailUsuario, code)
    .pipe(finalize(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }))
    .subscribe({
      next: () => {
        this.codigoGuardado = code;
        this.currentStep = 2;
        this.cdr.detectChanges();
      },
      error: () => {
        this.alertService.error('Error', 'Código incorrecto o expirado.');
      }
    })
  }

  changePassword(){
    if (this.passwordForm.invalid) {
      this.alertService.error('Formulario Inválido', 'Completa los campos correctamente.');
      return;
    }

    const pass = this.passwordForm.value.newPassword!;
    const confirm = this.passwordForm.value.confirmPassword!;

    if (pass !== confirm) {
      this.alertService.error('Error', 'Las contraseñas no coinciden.');
      return;
    }

    this.isLoading = true;
    this.alertService.loading('Actualizando contraseña...');
    
    this.authService.resetPassword(this.emailUsuario, this.codigoGuardado, pass)
    .pipe(finalize(() => { 
      this.isLoading = false; 
      this.alertService.close(); // Cerramos el loading
      this.cdr.detectChanges(); 
    }))
    .subscribe({
      next: () => {
        this.alertService.success('Contraseña Actualizada', 'Tu clave ha sido modificada con éxito.');
        this.router.navigate(['/settings']);
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo actualizar la contraseña. Intenta nuevamente.');
      }
    })
  }
}