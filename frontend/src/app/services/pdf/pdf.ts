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
}