import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../services/alert/alert';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private alertService = inject(AlertService); // Asegúrate de tener un AlertService para mostrar alertas

  registerForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    edad: ['', [Validators.required, Validators.min(0)]],
    sexo: ['', Validators.required],
    telefono: ['']
  });

  onSubmit() {
    if (this.registerForm.valid) {
      this.alertService.success('Paciente registrado', 'El paciente ha sido registrado exitosamente (simulado).');
      this.registerForm.reset();
    }
  }
}