import { Component, inject, NgZone, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AlertService } from '../../services/alert/alert';

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
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private alertService = inject(AlertService);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  ngOnInit() {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      this.loginForm.patchValue({ email: savedEmail, rememberMe: true });
    }
    // Inicializar Google
    if (typeof google !== 'undefined' && google.accounts) {
      this.initGoogleBtn();
    } else {
      const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(checkGoogle);
          this.initGoogleBtn();
        }
      }, 100);
    }
  }

  private initGoogleBtn() {
    google.accounts.id.initialize({
      client_id: '122329310552-6f3g3hn3fuj6fngiqfnef1aknddqi01v.apps.googleusercontent.com', 
      callback: (resp: any) => this.handleGoogleLogin(resp)
    });

    google.accounts.id.renderButton(document.getElementById("google-btn"), {
      theme: 'outline',
      size: 'large',
      width: '350'
    });
  }

  handleGoogleLogin(response: any) {
    this.alertService.loading('Iniciando sesión con Google...');
    
    this.http.post('http://127.0.0.1:8000/auth/google', {
      credential: response.credential
    }).subscribe({
      next: (res: any) => {
        this.alertService.close();
        this.ngZone.run(() => {
          localStorage.setItem('token', res.access_token);
          this.router.navigate(['/dashboard']);
        });
      },
      error: () => {
        this.alertService.close();
        this.alertService.error('Error de Acceso', 'No se pudo iniciar sesión con Google.');
      }
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password, rememberMe } = this.loginForm.value;

      if (rememberMe){
        localStorage.setItem('saved_email', email);
      } else{
        localStorage.removeItem('saved_email');
      }
      
      this.alertService.loading('Entrando...');

      this.authService.login(email, password, rememberMe).subscribe({
        next: (res) => {
          this.alertService.close();
          this.router.navigate(['/dashboard']); 
        },
        error: (err) => {
          this.alertService.close();
          if (err.status === 400 && err.error?.detail) {
            this.alertService.error('Error de Acceso', err.error.detail);
          } else {
            this.alertService.error('Error de Acceso', 'Correo o contraseña incorrectos.');
          }
        }
      });
    } else {
        this.alertService.error('Formulario Incompleto', 'Por favor ingresa tu correo y contraseña.');
    }
  }
}