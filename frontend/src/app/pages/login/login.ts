import { Component, inject, NgZone, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  errorMessage: string = '';

  ngOnInit() {
    // Verificamos si la librería de Google ya cargó
    if (typeof google !== 'undefined' && google.accounts) {
      this.initGoogleBtn();
    } else {
      // Si no ha cargado, esperamos y reintentamos cada 100ms
      const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(checkGoogle); // ¡Ya llegó! Detenemos el reloj
          this.initGoogleBtn();       // Iniciamos el botón
        }
      }, 100);
    }
  }

  // Sacamos la lógica a una función privada para no repetir código
  private initGoogleBtn() {
    google.accounts.id.initialize({
      client_id: '122329310552-6f3g3hn3fuj6fngiqfnef1aknddqi01v.apps.googleusercontent.com', // <--- TU ID AQUÍ
      callback: (resp: any) => this.handleGoogleLogin(resp)
    });

    google.accounts.id.renderButton(document.getElementById("google-btn"), {
      theme: 'outline',
      size: 'large',
      width: '100%'
    });
  }

  handleGoogleLogin(response: any) {
    console.log("Token de Google recibido:", response.credential);

    // Lo enviamos a TU Backend (Python)
    this.http.post('http://127.0.0.1:8000/auth/google', {
      credential: response.credential
    }).subscribe({
      next: (res: any) => {
        // Usamos NgZone para volver al "mundo Angular" y navegar
        this.ngZone.run(() => {
          localStorage.setItem('token', res.access_token);
          this.router.navigate(['/dashboard']);
        });
      },
      error: (err) => {
        console.error('Error en login con Google:', err);
        alert('Error al iniciar sesión con Google');
      }
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      
      // Llamamos al servicio de autenticación
      this.authService.login(email, password).subscribe({
        next: (res) => {
          console.log('Login exitoso!', res);
          
          // --- AQUÍ ESTÁ LA SOLUCIÓN ---
          // En lugar de alert(), usamos el router para ir al Dashboard
          this.router.navigate(['/dashboard']); 
        },
        error: (err) => {
          console.error(err);
          // Si falla, mostramos el mensaje de error en rojo
          this.errorMessage = 'Correo o contraseña incorrectos';
        }
      });
    }
  }
}
