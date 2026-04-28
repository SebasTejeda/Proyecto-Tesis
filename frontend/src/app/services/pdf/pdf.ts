import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- INTERFACES PARA TIPADO ESTRICTO ---
export interface PatientPdfInfo {
  id?: number;
  nombre_completo?: string;
  nombre?: string;
  edad?: number;
}

export interface EvaluationResult {
  riesgoPorcentaje: number;
  riesgoEtiqueta: string;
}

export interface ShapData {
  labels: string[];
  datasets: { data: number[] }[];
}

export interface HistoryItem {
  fecha: string;
  doctor: string;
  puntaje: number;
  riesgo: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  // Colores Corporativos estandarizados en RGB para jsPDF
  private readonly brandColors = {
    primary: [59, 130, 246] as [number, number, number], // Azul #3b82f6
    textGray: [51, 65, 85] as [number, number, number],  // Gris #334155
    danger: [239, 68, 68] as [number, number, number],   // Rojo
    success: [16, 185, 129] as [number, number, number]  // Verde
  };

  constructor() { }

  generateEvaluationReport(patient: PatientPdfInfo, resultado: EvaluationResult, shapData: ShapData) {
    const doc = new jsPDF();
    const nombrePaciente = patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    // --- 1. CABECERA ---
    doc.setFillColor(...this.brandColors.primary);
    doc.rect(0, 0, 210, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);

    doc.setFontSize(10);
    doc.text('Informe de Evaluación Psicológica con IA', 130, 17);

    // --- 2. DATOS DEL PACIENTE ---
    let yPos = 40;
    
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 15, yPos);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos + 2, 195, yPos + 2);
    
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Nombre: ${nombrePaciente}`, 15, yPos);
    doc.text(`Edad: ${patient.edad || 'N/A'} años`, 120, yPos);
    yPos += 8;
    doc.text(`ID Expediente: #${patient.id || 'S/N'}`, 15, yPos);
    doc.text(`Fecha Evaluación: ${new Date().toLocaleDateString()}`, 120, yPos);

    // --- 3. RESULTADO DEL MODELO ---
    yPos += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RESULTADO DEL ANÁLISIS', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 15;
    
    const isHighRisk = resultado.riesgoPorcentaje > 50;
    const riesgoColor = isHighRisk ? this.brandColors.danger : this.brandColors.success;
    
    doc.setFillColor(...riesgoColor);
    doc.roundedRect(15, yPos, 180, 25, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(`NIVEL DE RIESGO: ${resultado.riesgoEtiqueta}`, 105, yPos + 16, { align: 'center' });
    
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(11);
    doc.text(`Probabilidad calculada por el modelo: ${resultado.riesgoPorcentaje}%`, 15, yPos + 35);

    // --- 4. EXPLICABILIDAD (Tabla SHAP) ---
    yPos += 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FACTORES DETERMINANTES (XAI)', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    // Programación defensiva: Verificar que shapData es válido
    if (shapData && shapData.labels && shapData.datasets && shapData.datasets.length > 0) {
      const tableBody = shapData.labels.map((label: string, index: number) => {
        const valor = shapData.datasets[0].data[index];
        const impacto = valor > 0 ? 'Aumenta Riesgo (+)' : 'Disminuye Riesgo (-)';
        return [label, `${valor}%`, impacto];
      });

      autoTable(doc, {
        startY: yPos + 10,
        head: [['Factor Analizado', 'Peso (%)', 'Impacto Clínico']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary },
        styles: { fontSize: 10, cellPadding: 3 }
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Datos de interpretabilidad no disponibles para este análisis.', 15, yPos + 10);
    }

    // --- 5. FIRMA ---
    // Usamos any temporalmente porque los tipos de jspdf-autotable a veces no detectan lastAutoTable
    const lastTableY = (doc as any).lastAutoTable?.finalY || yPos + 30;
    const finalY = lastTableY + 40;
    
    doc.setDrawColor(0, 0, 0);
    doc.line(70, finalY, 140, finalY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Especialista', 105, finalY + 5, { align: 'center' });

    // --- GUARDAR ---
    const filename = nombrePaciente.replace(/\s+/g, '_'); // Reemplaza espacios por guiones bajos
    doc.save(`Evaluacion_${filename}_${new Date().getTime()}.pdf`);
  }

  generateHistoryReport(patient: PatientPdfInfo, historial: HistoryItem[]) {
    const doc = new jsPDF();
    const nombrePaciente = patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    doc.setFillColor(...this.brandColors.primary);
    doc.rect(0, 0, 210, 25, 'F'); 

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);

    doc.setFontSize(10);
    doc.text('Historial Clínico Completo', 150, 17);

    let yPos = 40;
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paciente: ${nombrePaciente}`, 15, yPos);
    doc.text(`ID: #${patient.id || 'S/N'}`, 150, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 15, yPos);
    doc.text(`Total de evaluaciones: ${historial?.length || 0}`, 150, yPos);

    if (historial && historial.length > 0) {
      const tableBody = historial.map(item => [
        item.fecha,
        item.doctor,
        `${item.puntaje}%`,
        item.riesgo
      ]);

      autoTable(doc, {
        startY: yPos + 15,
        head: [['Fecha', 'Especialista', 'Puntaje', 'Nivel de Riesgo']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary, halign: 'center' },
        bodyStyles: { textColor: this.brandColors.textGray },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 70 },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const riesgo = data.cell.raw as string;
            if (riesgo === 'Alto') data.cell.styles.textColor = this.brandColors.danger;
            if (riesgo === 'Bajo') data.cell.styles.textColor = this.brandColors.success;
          }
        }
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Este documento es un resumen histórico generado automáticamente por NeuroMind AI.', 105, 285, { align: 'center' });

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Historial_${filename}.pdf`);
  }
}