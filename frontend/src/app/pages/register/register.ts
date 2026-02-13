import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);

  registerForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    edad: ['', [Validators.required, Validators.min(0)]],
    sexo: ['', Validators.required],
    telefono: ['']
  });

  onSubmit() {
    if (this.registerForm.valid) {
      console.log('Datos del paciente:', this.registerForm.value);
      alert('¡Paciente registrado (simulado)!');
      // Aquí luego conectaremos con el Backend
      this.registerForm.reset();
    }
  }
}