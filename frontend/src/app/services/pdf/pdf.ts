import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EvaluationResult, HistoryItem, PatientPdfInfo, ShapData } from '../../models/pdf';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  private readonly brandColors = {
    primary: [59, 130, 246] as [number, number, number],
    textGray: [51, 65, 85] as [number, number, number],
    danger: [239, 68, 68] as [number, number, number],
    success: [16, 185, 129] as [number, number, number]
  };

  generateEvaluationReport(patient: PatientPdfInfo, resultado: EvaluationResult, shapData: ShapData) {
    const doc = new jsPDF();
    const nombrePaciente = patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    // 1. Cabecera
    doc.setFillColor(...this.brandColors.primary);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);
    doc.setFontSize(10);
    doc.text('Informe de Evaluación Psicológica con IA', 130, 17);

    // 2. Datos del paciente
    let yPos = 40;
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 15, yPos);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${nombrePaciente}`, 15, yPos);
    doc.text(`Edad: ${patient.edad || '--'} años`, 120, yPos);
    yPos += 8;
    doc.text(`Sexo: ${patient.sexo || 'No especificado'}`, 15, yPos);
    doc.text(`Fecha Evaluación: ${new Date().toLocaleDateString()}`, 120, yPos);

    // 3. Resultado del modelo
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

    // 4. Explicabilidad SHAP
    yPos += 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FACTORES DETERMINANTES (XAI / SHAP)', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    if (shapData?.labels?.length && shapData.datasets?.length) {
      const tableBody = shapData.labels.map((label: string, index: number) => {
        const valor = shapData.datasets[0].data[index];
        const impacto = valor > 0 ? 'Aumenta Riesgo (+)' : 'Disminuye Riesgo (-)';
        return [label, `${(valor * 100).toFixed(1)}%`, impacto];
      });

      autoTable(doc, {
        startY: yPos + 10,
        head: [['Factor Analizado', 'Peso SHAP', 'Impacto Clínico']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary },
        styles: { fontSize: 10, cellPadding: 3 }
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Datos de interpretabilidad no disponibles (modelo aún no integrado).', 15, yPos + 10);
    }

    // 5. Firma
    const lastTableY = (doc as any).lastAutoTable?.finalY || yPos + 30;
    const finalY = lastTableY + 40;
    doc.setDrawColor(0, 0, 0);
    doc.line(70, finalY, 140, finalY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Especialista', 105, finalY + 5, { align: 'center' });

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Evaluacion_${filename}_${new Date().getTime()}.pdf`);
  }

  generateHistoryReport(patient: PatientPdfInfo, historial: HistoryItem[]) {
    const doc = new jsPDF();
    const nombrePaciente = patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    // Cabecera
    doc.setFillColor(...this.brandColors.primary);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);
    doc.setFontSize(10);
    doc.text('Historial Clínico Completo', 195, 17, { align: 'right' });

    // Datos del paciente
    let yPos = 40;
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paciente: ${nombrePaciente}`, 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Edad: ${patient.edad || '--'} años   |   Sexo: ${patient.sexo || 'No especificado'}`,
      195, yPos, { align: 'right' }
    );

    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 15, yPos);
    doc.text(`Total de evaluaciones: ${historial?.length || 0}`, 195, yPos, { align: 'right' });

    // Tabla — usa severity y riskProbability del nuevo HistoryItem
    if (historial?.length > 0) {
      const tableBody = historial.map(item => [
        item.fecha,
        item.doctor,
        `${(item.riskProbability * 100).toFixed(1)}%`,
        item.severity,
        item.status
      ]);

      autoTable(doc, {
        startY: yPos + 15,
        head: [['Fecha', 'Especialista', 'Probabilidad', 'Severidad', 'Estado']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary, halign: 'center' },
        bodyStyles: { textColor: this.brandColors.textGray },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 55 },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 30, halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const severity = (data.cell.raw as string).toLowerCase();
            if (severity === 'severo' || severity.includes('grave')) {
              data.cell.styles.textColor = this.brandColors.danger;
            } else if (severity.includes('leve') || severity.includes('mínim') || severity === 'ninguno') {
              data.cell.styles.textColor = this.brandColors.success;
            }
          }
        }
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'Este documento es un resumen histórico generado automáticamente por NeuroMind AI.',
      105, 285, { align: 'center' }
    );

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Historial_${filename}.pdf`);
  }
}