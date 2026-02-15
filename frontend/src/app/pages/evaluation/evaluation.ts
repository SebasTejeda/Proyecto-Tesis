import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../services/alert/alert';
import { PatientService } from '../../services/patients/patient';
import { EvaluationService } from '../../services/evaluation/evaluation';
import {DropdownModule} from 'primeng/dropdown';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DropdownModule], // <--- Agregar DropdownModule
  templateUrl: './evaluation.html',
  styleUrl: './evaluation.css'
})
export class EvaluationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private alertService = inject(AlertService);
  private patientService = inject(PatientService);
  private evalService = inject(EvaluationService);

  pacientes: any[] = []; // Lista para el dropdown

  evalForm: FormGroup = this.fb.group({
    patient_id: [null, Validators.required], // <--- NUEVO CAMPO OBLIGATORIO
    ansiedad: [5, Validators.required],
    sueno: [5, Validators.required],
    estres: [5, Validators.required],
    tristeza: ['No', Validators.required],
    historial: ['No', Validators.required]
  });

  ngOnInit() {
    this.cargarPacientes();
  }

  cargarPacientes() {
    this.patientService.getPatients().subscribe({
      next: (data) => {
        this.pacientes = data;
      },
      error: () => this.alertService.error('Error', 'No se pudieron cargar los pacientes')
    });
  }

  onSubmit() {
    if (this.evalForm.invalid) {
      this.alertService.error('Falta información', 'Selecciona un paciente y completa los campos.');
      return;
    }

    this.alertService.loading('Analizando paciente...');

    // Convertimos el objeto del dropdown (que a veces devuelve todo el objeto) al ID
    const formData = { ...this.evalForm.value };
    
    // Si PrimeNG devuelve el objeto completo del paciente, extraemos solo el ID
    if (typeof formData.patient_id === 'object') {
        formData.patient_id = formData.patient_id.id;
    }

    this.evalService.createEvaluation(formData)
    .pipe(finalize(() => { 
        // No cerramos aquí para dejar que el success lo haga
    }))
    .subscribe({
      next: (res) => {
        this.alertService.success('¡Evaluación Guardada!', 'Los datos han sido procesados.');
        this.evalForm.reset({
            ansiedad: 5, sueno: 5, estres: 5, tristeza: 'No', historial: 'No'
        });
      },
      error: (err) => {
        console.error(err);
        this.alertService.error('Error', 'No se pudo guardar la evaluación.');
      }
    });
  }
}