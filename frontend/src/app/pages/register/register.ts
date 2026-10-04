import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { PatientData } from '../../models/patients';
import { fechaNacimientoValidator, hoyEnLimaISO } from '../../validators/fecha-nacimiento.validator';
import { numeroDocumentoValidator } from '../../validators/numero-documento.validator';

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
  readonly maxFechaNacimiento = hoyEnLimaISO();

  registerForm = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(3)]],
    tipo_documento: ['DNI', Validators.required],
    numero_documento: ['', [Validators.required, numeroDocumentoValidator()]],
    fecha_nacimiento: ['', [Validators.required, fechaNacimientoValidator()]],
    sexo: ['', Validators.required],
    telefono: ['', [Validators.pattern('^9[0-9]{8}$')]]
  });

  constructor() {
    this.registerForm.get('tipo_documento')?.valueChanges.subscribe(() => {
      this.registerForm.get('numero_documento')?.updateValueAndValidity();
    });
  }

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
        let msg = 'No se pudo guardar el paciente en la base de datos.';
        if (err.error?.detail === 'El DNI ya está registrado.') msg = 'Este DNI ya pertenece a otro paciente.';
        else if (err.error?.detail === 'El documento ya está registrado.') msg = 'Este documento ya pertenece a otro paciente.';
        this.alertService.error('Error', msg);
        console.error(err);
      }
    });
  }
}