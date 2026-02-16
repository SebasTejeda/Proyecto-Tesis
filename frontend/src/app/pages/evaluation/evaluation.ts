import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { PatientService } from '../../services/patients/patient';
import { AlertService } from '../../services/alert/alert';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../../services/pdf/pdf';
import { ActivatedRoute } from '@angular/router'; // Importante para leer la URL

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ChartModule, 
    DialogModule, 
    ButtonModule
  ],
  templateUrl: './evaluation.html',
  styleUrls: ['./evaluation.css']
})
export class EvaluationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private patientService = inject(PatientService);
  private alertService = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute); // Inyectamos la ruta activa

  evalForm: FormGroup;
  pacientes: any[] = [];
  
  displayModal: boolean = false;
  riesgoPorcentaje: number = 0;
  riesgoEtiqueta: string = '';

  gaugeData: any;
  gaugeOptions: any;
  shapData: any;
  shapOptions: any;

  constructor() {
    Chart.register(...registerables);

    this.evalForm = this.fb.group({
      patient_id: [null, Validators.required],
      ansiedad: [5, Validators.required],
      sueno: [5, Validators.required],
      estres: [5, Validators.required],
      tristeza: ['No', Validators.required],
      historial: ['No', Validators.required]
    });
  }

  ngOnInit(): void {
    // 1. Mostrar carga inicial
    this.alertService.loading('Cargando pacientes...');

    this.patientService.getPatients().subscribe({
      next: (data) => {
        // 2. Llenar la lista de pacientes
        this.pacientes = Array.isArray(data) ? data : [];
        
        // 3. Cerrar la alerta de carga
        this.alertService.close();

        // 4. (NUEVO) Verificar si venimos del Detalle con un paciente pre-seleccionado
        this.route.queryParams.subscribe(params => {
          const preSelectedId = params['patientId'];
          
          if (preSelectedId) {
            // Buscamos si el paciente existe en la lista cargada
            const idNumber = Number(preSelectedId);
            const pacienteExiste = this.pacientes.find(p => p.id === idNumber);

            if (pacienteExiste) {
               // Seleccionamos al paciente en el formulario automáticamente
               this.evalForm.patchValue({ patient_id: idNumber });
            }
          }
        });

        // 5. Actualizar la vista
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.alertService.close();
        this.alertService.error('Error', 'No se pudieron cargar los pacientes');
      }
    });
  }

  onSubmit() {
    if (this.evalForm.invalid) {
      this.alertService.error('Formulario Incompleto', 'Por favor selecciona un paciente.');
      return;
    }

    this.alertService.loading('Analizando síntomas con IA...');

    setTimeout(() => {
      this.alertService.close();
      this.mostrarResultadosSimulados();
      this.displayModal = true;
      this.cdr.detectChanges();
    }, 2000);
  }

  mostrarResultadosSimulados() {
    this.riesgoPorcentaje = 78;
    this.riesgoEtiqueta = 'ALTO';

    this.initGaugeChart(this.riesgoPorcentaje);
    this.initShapChart();
  }

  initGaugeChart(valor: number) {
    this.gaugeData = {
      labels: ['Riesgo', 'Restante'],
      datasets: [
        {
          data: [valor, 100 - valor],
          backgroundColor: [
            valor > 50 ? '#ef4444' : '#10b981',
            '#e2e8f0'
          ],
          borderWidth: 0,
          cutout: '85%'
        }
      ]
    };

    this.gaugeOptions = {
      rotation: -90,
      circumference: 180,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      aspectRatio: 1.5,
      maintainAspectRatio: false
    };
  }

  initShapChart() {
    this.shapData = {
      labels: ['Ansiedad Alta', 'Mal Sueño', 'Sin Tristeza', 'Estrés Medio'],
      datasets: [
        {
          label: 'Impacto',
          data: [35, 20, -10, 5],
          backgroundColor: (context: any) => {
            const value = context.raw;
            return value >= 0 ? '#ef4444' : '#10b981';
          },
          borderRadius: 5
        }
      ]
    };

    this.shapOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { display: false }
        },
        y: {
          grid: { display: false },
          ticks: { font: { weight: 'bold' } }
        }
      }
    };
  }

  exportarPDF(){
    const patientId = this.evalForm.get('patient_id')?.value;
    const selectedPatient = this.pacientes.find(p => p.id == patientId);

    if(!selectedPatient) {
        this.alertService.error('Error', 'No hay paciente seleccionado');
        return;
    }

    const resultado = {
      riesgoPorcentaje: this.riesgoPorcentaje,
      riesgoEtiqueta: this.riesgoEtiqueta
    }

    this.pdfService.generateEvaluationReport(selectedPatient, resultado, this.shapData);
    this.alertService.success('Informe Descargado', 'El PDF se ha generado correctamente.')
  }
}