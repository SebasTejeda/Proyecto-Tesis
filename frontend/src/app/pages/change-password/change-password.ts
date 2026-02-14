import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';
import { finalize, take } from 'rxjs';

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

  currentStep: number = 1;
  emailUsuario: string = '';
  codigoGuardado: string = '';
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
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
      error: (err) => {
        this.errorMessage = 'Error al obtener el perfil del usuario.';
        this.isLoading = false;
      }
    });
  }

  enviarCodigo(): void {

    if (this.enviandoCodigo){
      console.warn('Evitando envío duplicado');
      return;      
    }

    this.isLoading = true;
    this.enviandoCodigo = true;
    this.successMessage = '';
    this.errorMessage = '';
    console.log('Iniciando envío de código a: ', this.emailUsuario);
    

    this.authService.requestRecovery(this.emailUsuario)
    .pipe(
      take(1),
      finalize(() => {
      this.isLoading = false;
      this.enviandoCodigo = false;
      this.cdr.detectChanges();
    }))
    .subscribe({
      next: () => {
        console.log('código enviado con éxito');
        
        this.successMessage = `Hemos enviado un código a ${this.emailUsuario}`;
      },
      error: (err) => {
        if (err.status === 403) {
          this.errorMessage = 'Tu cuenta es de Google, no necesitas cambiar la contraseña aquí.';
        } else {
          this.errorMessage = 'Error al enviar el código de recuperación. Intenta nuevamente.';
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
    console.log('Botón presionado verificar');
    console.log('Valor del formulario: ', this.codeForm.value);
    console.log('¿Formulario válido?', this.codeForm.valid);
       
    if (this.codeForm.invalid){
      console.warn('El formulario es inválido, no enviamos nada');
      this.codeForm.markAllAsTouched();
      return
    }

    this.isLoading = true;
    this.errorMessage = '';
    const code = this.codeForm.value.code!;

    console.log('Enviando al backend...', this.emailUsuario, code);
    

    this.authService.verifyCode(this.emailUsuario, code)
    .pipe(finalize(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }))
    .subscribe({
      next: (res) => {
        console.log('¡Backend respondió éxito!', res);
        this.codigoGuardado = code;
        this.currentStep = 2;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error del backend', err);
        this.errorMessage = 'Código incorrecto. Intenta nuevamente.';
      }
    })
  }

  changePassword(){
    if (this.passwordForm.invalid) return;

    const pass = this.passwordForm.value.newPassword!;
    const confirm = this.passwordForm.value.confirmPassword!;

    if (pass !== confirm) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword(this.emailUsuario, this.codigoGuardado, pass)
    .pipe(finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
    .subscribe({
      next: () => {
        this.router.navigate(['/settings']);
      },
      error: (err) => {
        this.errorMessage = 'Error al cambiar la contraseña. Intenta nuevamente.';
      }
    })
  }
}
