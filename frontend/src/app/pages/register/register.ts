import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { PatientData } from '../../models/patients';
import { fechaNacimientoValidator } from '../../validators/fecha-nacimiento.validator';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private alertService = inject(AlertService);
  private patientService = inject(PatientService);
  private router = inject(Router);

  isLoading = signal(false);
  readonly maxFechaNacimiento = new Date().toISOString().split('T')[0];

  registerForm = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(3)]],
    dni: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
    fecha_nacimiento: ['', [Validators.required, fechaNacimientoValidator()]],
    sexo: ['', Validators.required],
    telefono: ['', [Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$')]]
  });

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.alertService.error('Formulario Inválido', 'Por favor, completa los campos requeridos marcados en rojo.');
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Registrando paciente...');

    const patientData: PatientData = this.registerForm.getRawValue();

    this.patientService.createPatient(patientData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.alertService.success('¡Registro Exitoso!', `El paciente ${response.nombre_completo} ha sido guardado.`, true);
        this.registerForm.reset();
        this.router.navigate(['/dashboard/patient', response.id]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        const msg = err.error?.detail === 'El DNI ya está registrado.'
          ? 'Este DNI ya pertenece a otro paciente.'
          : 'No se pudo guardar el paciente en la base de datos.';
        this.alertService.error('Error', msg);
        console.error(err);
      }
    });
  }
}