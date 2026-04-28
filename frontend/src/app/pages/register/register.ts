import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router'; // Para redirigir al paciente recién creado
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { PatientData } from '../../models/patients';

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

  // Manejador de estado reactivo
  isLoading = signal(false);

  // Formulario Reactivo Estricto
  registerForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    edad: [0, [Validators.required, Validators.min(1), Validators.max(120)]],
    sexo: ['', Validators.required],
    telefono: ['', [Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$')]] // Validador de teléfono básico
  });

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched(); // Muestra los errores en rojo si el usuario no tocó los campos
      this.alertService.error('Formulario Inválido', 'Por favor, revisa los campos marcados en rojo.');
      return;
    }

    this.isLoading.set(true);
    this.alertService.loading('Registrando paciente...');

    // Extraemos los datos respetando la interfaz PatientData
    const patientData: PatientData = this.registerForm.getRawValue();

    this.patientService.createPatient(patientData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        // Usamos nombre_completo, que es la propiedad que devuelve FastAPI
        this.alertService.success('¡Registro Exitoso!', `El paciente ${response.nombre} ha sido guardado.`, true);
        
        this.registerForm.reset();
        
        // Opcional pero muy buena UX: Redirigir al expediente del paciente recién creado
        this.router.navigate(['/dashboard/patient', response.id]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.alertService.close();
        this.alertService.error('Error de Conexión', 'No se pudo guardar el registro en la base de datos.');
        console.error('Error al crear paciente:', err);
      }
    });
  }
}