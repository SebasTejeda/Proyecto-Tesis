import { Component, inject, NgZone, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert/alert';
import { environment } from '../../../environments/environment';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private alertService = inject(AlertService);

  isLoading = signal(false);
  isBloqueado = signal(false);          // muestra banner de bloqueo
  mensajeBloqueo = signal('');          // mensaje específico del backend
  intentosRestantes = signal<number | null>(null); // muestra advertencia antes del bloqueo

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  ngOnInit() {
    this.checkSavedEmail();
    this.initGoogleAuth();
  }

  private checkSavedEmail() {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      this.loginForm.patchValue({ email: savedEmail, rememberMe: true });
    }
  }

  private initGoogleAuth() {
    if (typeof google !== 'undefined' && google.accounts) {
      this.renderGoogleButton();
    } else {
      const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(checkGoogle);
          this.renderGoogleButton();
        }
      }, 100);
    }
  }

  renderGoogleButton() {
    google.accounts.id.initialize({
      client_id: environment.id_google,
      callback: (response: any) => this.handleGoogleLogin(response)
    });
    google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      { theme: 'outline', size: 'large', width: '360' }
    );
  }

  handleGoogleLogin(response: any) {
    this.alertService.loading('Iniciando sesión con Google...');
    this.isLoading.set(true);

    this.ngZone.run(() => {
      this.authService.loginWithGoogle(response.credential).subscribe({
        next: () => {
          this.alertService.close();
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.isLoading.set(false);
          this.alertService.close();
          this.alertService.error('Error de Acceso', 'No se pudo iniciar sesión con Google.');
        }
      });
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    // Resetear estados de error
    this.isBloqueado.set(false);
    this.intentosRestantes.set(null);

    const { email, password, rememberMe } = this.loginForm.getRawValue();

    if (rememberMe) {
      localStorage.setItem('saved_email', email);
    } else {
      localStorage.removeItem('saved_email');
    }

    this.alertService.loading('Entrando...');
    this.isLoading.set(true);

    this.authService.login(email, password, rememberMe).subscribe({
      next: () => {
        this.alertService.close();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();

        const detail: string = err.error?.detail || '';
        const statusCode: number = err.status;

        if (statusCode === 429) {
          // Cuenta bloqueada
          this.isBloqueado.set(true);
          this.mensajeBloqueo.set(detail);
          this.loginForm.get('password')?.reset();
        } else if (detail.includes('intento')) {
          // Advertencia de intentos restantes
          this.intentosRestantes.set(this.extraerIntentosRestantes(detail));
          this.alertService.error('Contraseña incorrecta', detail);
        } else {
          this.alertService.error('Error de Acceso', detail || 'No se pudo iniciar sesión.');
        }
      }
    });
  }

  private extraerIntentosRestantes(msg: string): number | null {
    const match = msg.match(/(\d+)\s+intento/);
    return match ? parseInt(match[1]) : null;
  }

  limpiarBloqueo() {
    this.isBloqueado.set(false);
    this.mensajeBloqueo.set('');
    this.intentosRestantes.set(null);
    this.loginForm.reset();
  }
}