import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';

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
  private patientService = inject(PatientService); // Inyecta el servicio de pacientes

  registerForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    edad: ['', [Validators.required, Validators.min(0)]],
    sexo: ['', Validators.required],
    telefono: ['']
  });

  onSubmit() {
    if (this.registerForm.invalid) {
      this.alertService.error('Error', 'Completa los campos obligatorios.');
      return
    }

    this.alertService.loading('Registrando paciente...');

    this.patientService.createPatient(this.registerForm.value).
    subscribe({
      next: (res) => {
        this.alertService.success('¡Registrado!', `Paciente ${res.nombre} guardado exitosamente.`);
        this.registerForm.reset();
      },
      error: (err) => {
        this.alertService.error('Error', 'Ocurrió un error al registrar el paciente.');
      }
    });
  }
}