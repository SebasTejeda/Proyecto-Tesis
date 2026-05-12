import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
  private alertService = inject(AlertService);
  private patientService = inject(PatientService);
  private router = inject(Router);

  isLoading = signal(false);

  // Formulario actualizado con los nombres exactos del Backend (Pydantic)
  registerForm = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(3)]],
    fecha_nacimiento: ['', Validators.required], // Ahora es una fecha (String YYYY-MM-DD)
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

    const patientData = this.registerForm.getRawValue();

    this.patientService.createPatient(patientData).subscribe({
      next: (response: any) => {
        this.isLoading.set(false);
        this.alertService.success('¡Registro Exitoso!', `El paciente ${response.nombre_completo} ha sido guardado.`, true);
        
        this.registerForm.reset();
        
        // Redirige al expediente del paciente usando el nuevo ID
        this.router.navigate(['/dashboard/patient', response.id]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.alertService.error('Error', 'No se pudo guardar el paciente en la base de datos.');
        console.error(err);
      }
    });
  }
}