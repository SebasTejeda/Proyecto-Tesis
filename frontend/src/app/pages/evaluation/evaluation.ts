import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './evaluation.html',
  styleUrl: './evaluation.css'
})
export class EvaluationComponent {
  private fb = inject(FormBuilder);

  evalForm: FormGroup = this.fb.group({
    ansiedad: [5, Validators.required], // Valor inicial 5
    sueno: [5, Validators.required],
    estres: [5, Validators.required],
    tristeza: ['0', Validators.required],
    historial: ['0', Validators.required]
  });

  onSubmit() {
    if (this.evalForm.valid) {
      console.log('Datos para la IA:', this.evalForm.value);
      alert('🤖 Enviando datos al modelo de Python... (Próximamente)');
    }
  }
}