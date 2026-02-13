import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  errorMessage: string = '';

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
