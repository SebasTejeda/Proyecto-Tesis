import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  generateEvaluationReport(patient: any, resultado: any, shapData: any) {
    const doc = new jsPDF();
    const azulCorporativo = '#3b82f6';
    const grisTexto = '#334155';

    // --- 1. CABECERA ---
    // Logo (Simulado con un cuadro azul)
    doc.setFillColor(59, 130, 246); // Azul RGB
    doc.rect(0, 0, 210, 25, 'F'); // Barra superior azul

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);

    doc.setFontSize(10);
    doc.text('Informe de Evaluación Psicológica con IA', 130, 17);

    // --- 2. DATOS DEL PACIENTE ---
    let yPos = 40;
    
    doc.setTextColor(grisTexto);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 15, yPos);
    
    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos + 2, 195, yPos + 2);
    
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Fila 1
    doc.text(`Nombre: ${patient.nombre_completo}`, 15, yPos);
    doc.text(`Edad: ${patient.edad || 'N/A'} años`, 120, yPos);
    yPos += 8;
    // Fila 2
    doc.text(`ID Expediente: #00000${patient.id}`, 15, yPos);
    doc.text(`Fecha Evaluación: ${new Date().toLocaleDateString()}`, 120, yPos);

    // --- 3. RESULTADO DEL MODELO (El Velómetro en texto) ---
    yPos += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RESULTADO DEL ANÁLISIS', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 15;
    
    // Cuadro de Resultado
    const riesgoColor = resultado.riesgoPorcentaje > 50 ? [239, 68, 68] : [16, 185, 129]; // Rojo o Verde
    doc.setFillColor(riesgoColor[0], riesgoColor[1], riesgoColor[2]);
    doc.roundedRect(15, yPos, 180, 25, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(`NIVEL DE RIESGO: ${resultado.riesgoEtiqueta}`, 105, yPos + 16, { align: 'center' });
    
    // Probabilidad
    doc.setTextColor(grisTexto);
    doc.setFontSize(11);
    doc.text(`Probabilidad calculada por el modelo: ${resultado.riesgoPorcentaje}%`, 15, yPos + 35);

    // --- 4. EXPLICABILIDAD (Tabla SHAP) ---
    yPos += 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FACTORES DETERMINANTES (XAI)', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    // Preparamos los datos para la tabla
    // shapData viene del componente (labels y data)
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
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    // --- 5. FIRMA ---
    const finalY = (doc as any).lastAutoTable.finalY + 40;
    
    doc.setDrawColor(0, 0, 0);
    doc.line(70, finalY, 140, finalY); // Línea de firma
    doc.setFontSize(10);
    doc.text('Firma del Especialista', 105, finalY + 5, { align: 'center' });

    // --- GUARDAR ---
    doc.save(`Evaluacion_${patient.nombre_completo}_${new Date().getTime()}.pdf`);
  }

  generateHistoryReport(patient: any, historial: any[]) {
    const doc = new jsPDF();
    const grisTexto = '#334155';

    // 1. CABECERA (Igual que el otro reporte para consistencia)
    doc.setFillColor(59, 130, 246); // Azul
    doc.rect(0, 0, 210, 25, 'F'); 

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 17);

    doc.setFontSize(10);
    doc.text('Historial Clínico Completo', 150, 17);

    // 2. RESUMEN DEL PACIENTE
    let yPos = 40;
    doc.setTextColor(grisTexto);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paciente: ${patient.nombre_completo || patient.nombre}`, 15, yPos);
    doc.text(`ID: #${patient.id}`, 150, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 15, yPos);
    doc.text(`Total de evaluaciones: ${historial.length}`, 150, yPos);

    // 3. TABLA DE HISTORIAL (La parte importante)
    // Preparamos los datos para la tabla
    const tableBody = historial.map(item => [
      item.fecha,
      item.doctor,
      `${item.puntaje}%`, // Columna Puntaje
      item.riesgo         // Columna Riesgo
    ]);

    autoTable(doc, {
      startY: yPos + 15,
      head: [['Fecha', 'Especialista', 'Puntaje', 'Nivel de Riesgo']],
      body: tableBody,
      theme: 'grid', // Estilo rejilla limpio
      headStyles: { fillColor: [59, 130, 246], halign: 'center' },
      bodyStyles: { textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 40 }, // Fecha
        1: { cellWidth: 70 }, // Doctor
        2: { cellWidth: 30, halign: 'center' }, // Puntaje
        3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' } // Riesgo
      },
      // Colorear el texto del riesgo dinámicamente
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
            const riesgo = data.cell.raw as string;
            if (riesgo === 'Alto') data.cell.styles.textColor = [239, 68, 68]; // Rojo
            if (riesgo === 'Bajo') data.cell.styles.textColor = [16, 185, 129]; // Verde
        }
      }
    });

    // 4. PIE DE PÁGINA
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Este documento es un resumen histórico generado automáticamente por NeuroMind AI.', 105, 280, { align: 'center' });

    // GUARDAR
    doc.save(`Historial_${patient.nombre || 'Paciente'}.pdf`);
  }
}