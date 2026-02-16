import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { PatientService } from '../../services/patients/patient';
import { AlertService } from '../../services/alert/alert'; // <--- IMPORTAMOS TU SERVICIO
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../../services/pdf/pdf';

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
  private alertService = inject(AlertService); // <--- INYECTAMOS TU SERVICIO
  private cdr = inject(ChangeDetectorRef);
  private pdfService = inject(PdfService);


  evalForm: FormGroup;
  pacientes: any[] = [];
  
  // YA NO NECESITAMOS loadingAnalysis
  displayModal: boolean = false;
  riesgoPorcentaje: number = 0;
  riesgoEtiqueta: string = '';

  // Variables para el Select de carga
  loadingPacientes: boolean = true;

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

    this.alertService.loading('Cargando pacientes...');

    this.patientService.getPatients().subscribe({
      next: (data) => {
        this.pacientes = Array.isArray(data) ? data : [];
        this.alertService.close();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.alertService.close();
        // Usamos tu servicio para errores también
        this.alertService.error('Error', 'No se pudieron cargar los pacientes');
      }
    });
  }

  onSubmit() {
    if (this.evalForm.invalid) {
      // Usamos tu servicio para validación
      this.alertService.error('Formulario Incompleto', 'Por favor selecciona un paciente.');
      return;
    }

    // 1. LLAMAMOS A TU SERVICIO DE LOADING
    this.alertService.loading('Analizando síntomas con IA...');

    setTimeout(() => {
      // 2. CERRAR SWEETALERT
      this.alertService.close();

      // 3. PREPARAR DATOS
      this.mostrarResultadosSimulados();
      
      // 4. MOSTRAR EL MODAL DE PRIMENG
      this.displayModal = true;
      
      // 5. FORZAR ACTUALIZACIÓN (Para que Angular pinte el modal inmediatamente)
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

    if(!selectedPatient) return

    const resultado = {
      riesgoPorcentaje: this.riesgoPorcentaje,
      riesgoEtiqueta: this.riesgoEtiqueta
    }

    this.pdfService.generateEvaluationReport(selectedPatient, resultado, this.shapData);

    this.alertService.success('Informe Descargado', 'El PDF se ha generado correctamente.')

  }
}