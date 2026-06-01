import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  EvaluationResult,
  HistoryItem,
  PatientPdfInfo,
  ShapData,
} from '../../models/pdf';
import { EvaluationResponse } from '../../models/evaluations';

@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly brandColors = {
    primary: [59, 130, 246] as [number, number, number],
    textGray: [51, 65, 85] as [number, number, number],
    danger: [239, 68, 68] as [number, number, number],
    success: [16, 185, 129] as [number, number, number],
    warning: [217, 119, 6] as [number, number, number],
    purple: [99, 102, 241] as [number, number, number],
    lightBg: [248, 250, 252] as [number, number, number],
  };

  private readonly LABEL_MAP: Record<string, string> = {
    horas_sueno: 'Horas de sueño',
    vida_social: 'Vida social',
    frecuencia_ejercicio: 'Frecuencia de ejercicio',
    redes_sociales: 'Redes sociales',
    nivel_estres: 'Nivel de estrés',
    calidad_sueno: 'Calidad de sueño',
    soledad_percibida: 'Soledad percibida',
    apoyo_familiar: 'Apoyo familiar',
    autoestima: 'Autoestima',
  };

  private calcularEdadTexto(patient: PatientPdfInfo): string {
    if (
      patient.edad !== undefined &&
      patient.edad !== null &&
      patient.edad !== '--'
    ) {
      return String(patient.edad);
    }
    if (patient.fecha_nacimiento) {
      const hoy = new Date();
      const nac = new Date(patient.fecha_nacimiento as string);
      let edad = hoy.getFullYear() - nac.getFullYear();
      const mes = hoy.getMonth() - nac.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
      return String(edad);
    }
    return '--';
  }

  // ── Convierte valor SHAP numérico a etiqueta clínica legible ──────────────
  private shapToLabel(
    valor: number,
    maxAbs: number,
  ): { nivel: string; tipo: 'riesgo' | 'protector' } {
    const pct = Math.abs(valor) / maxAbs;
    const tipo = valor > 0 ? 'riesgo' : 'protector';
    let nivel = '';
    if (pct >= 0.75)
      nivel =
        valor > 0
          ? 'Factor de alto impacto en el riesgo'
          : 'Factor protector de alto impacto';
    else if (pct >= 0.4)
      nivel =
        valor > 0
          ? 'Factor de impacto moderado en el riesgo'
          : 'Factor protector moderado';
    else
      nivel =
        valor > 0
          ? 'Factor de bajo impacto en el riesgo'
          : 'Factor protector leve';
    return { nivel, tipo };
  }

  // ── Cabecera estándar ─────────────────────────────────────────────────────
  private drawHeader(doc: jsPDF, subtitulo: string) {
    doc.setFillColor(...this.brandColors.primary);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('NeuroMind AI', 15, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitulo, 195, 18, { align: 'right' });
  }

  // ── Datos del paciente ────────────────────────────────────────────────────
  private drawPatientInfo(
    doc: jsPDF,
    patient: PatientPdfInfo,
    yPos: number,
  ): number {
    const edadTexto = this.calcularEdadTexto(patient);
    const nombrePaciente =
      patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 15, yPos);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${nombrePaciente}`, 15, yPos);
    doc.text(`Edad: ${edadTexto} años`, 120, yPos);
    yPos += 8;
    doc.text(`Sexo: ${patient.sexo || 'No especificado'}`, 15, yPos);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, 120, yPos);
    return yPos;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. PDF EVALUACIÓN INDIVIDUAL — resultado de una evaluación específica
  // ══════════════════════════════════════════════════════════════════════════
  generateEvaluationReport(
    patient: PatientPdfInfo,
    resultado: EvaluationResult,
    shapData: ShapData,
  ) {
    const doc = new jsPDF();
    const nombrePaciente =
      patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    this.drawHeader(doc, 'Informe de Evaluación Clínica');
    let yPos = this.drawPatientInfo(doc, patient, 40);

    // ── Resultado ──
    yPos += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('RESULTADO DEL ANÁLISIS', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 14;
    const nivel = resultado.riesgoEtiqueta.toLowerCase();
    let riesgoColor = this.brandColors.success;
    if (nivel.includes('alto') || nivel.includes('severo'))
      riesgoColor = this.brandColors.danger;
    else if (nivel.includes('leve')) riesgoColor = this.brandColors.warning;

    doc.setFillColor(...riesgoColor);
    doc.roundedRect(15, yPos, 180, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`NIVEL DE RIESGO: ${resultado.riesgoEtiqueta}`, 105, yPos + 14, {
      align: 'center',
    });

    yPos += 28;
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Resultado generado por el modelo XGBoost + SHAP de NeuroMind AI. No reemplaza el criterio clínico del especialista.',
      15,
      yPos,
    );

    // ── Factores clínicos — SIN números ──
    yPos += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('FACTORES DETERMINANTES DEL ANÁLISIS', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    if (shapData?.labels?.length && shapData.datasets?.length) {
      const valores = shapData.datasets[0].data;
      const maxAbs = Math.max(...valores.map(Math.abs)) || 1;

      const tableBody = shapData.labels.map((label: string, i: number) => {
        const { nivel, tipo } = this.shapToLabel(valores[i], maxAbs);
        const rol =
          tipo === 'riesgo' ? 'Contribuye al riesgo' : 'Factor protector';
        return [label, nivel, rol];
      });

      autoTable(doc, {
        startY: yPos + 8,
        head: [
          ['Factor Clínico', 'Nivel de Influencia', 'Rol en el Diagnóstico'],
        ],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary, fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 80 },
          2: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = String(data.cell.raw);
            data.cell.styles.textColor = val.includes('protector')
              ? this.brandColors.success
              : this.brandColors.danger;
          }
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Datos de interpretabilidad no disponibles.', 15, yPos + 10);
    }

    // ── Firma ──
    const lastY = (doc as any).lastAutoTable?.finalY || yPos + 40;
    const finalY = Math.min(lastY + 35, 270);
    doc.setDrawColor(0, 0, 0);
    doc.line(65, finalY, 145, finalY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('Firma del Especialista', 105, finalY + 5, { align: 'center' });

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Evaluacion_${filename}_${new Date().getTime()}.pdf`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. PDF INFORME CONSOLIDADO — análisis narrativo de TODAS las evaluaciones
  // ══════════════════════════════════════════════════════════════════════════
  generateConsolidatedReport(
    patient: PatientPdfInfo,
    evaluaciones: EvaluationResponse[],
  ) {
    const doc = new jsPDF();
    const nombrePaciente =
      patient.nombre_completo || patient.nombre || 'Paciente Desconocido';

    this.drawHeader(doc, 'Informe Clínico Consolidado');
    let yPos = this.drawPatientInfo(doc, patient, 40);

    // ── Análisis general ──
    const total = evaluaciones.length;
    const conRiesgo = evaluaciones.filter(
      (e) => e.model_prediction?.risk_binary === 1,
    ).length;
    const sinRiesgo = total - conRiesgo;
    const niveles = evaluaciones.map(
      (e) => e.model_prediction?.severity ?? 'Sin datos',
    );
    const ultimoNivel = niveles[0] ?? 'Sin datos';

    // Determinar tendencia comparando primeras y últimas evaluaciones
    const ordenadas = [...evaluaciones].reverse(); // de más antigua a más nueva
    const primerasMitad = ordenadas.slice(0, Math.ceil(ordenadas.length / 2));
    const segundaMitad = ordenadas.slice(Math.ceil(ordenadas.length / 2));
    const scoreMap: Record<string, number> = {
      Ninguno: 0,
      Leve: 1,
      'Moderado/Alto': 2,
    };
    const promedioInicio =
      primerasMitad.reduce(
        (s, e) =>
          s + (scoreMap[e.model_prediction?.severity ?? 'Ninguno'] ?? 0),
        0,
      ) / (primerasMitad.length || 1);
    const promedioFinal =
      segundaMitad.reduce(
        (s, e) =>
          s + (scoreMap[e.model_prediction?.severity ?? 'Ninguno'] ?? 0),
        0,
      ) / (segundaMitad.length || 1);
    // CÓDIGO CORREGIDO:
    let tendencia = 'Estable';
    let tendenciaColor = this.brandColors.textGray;
    if (promedioFinal < promedioInicio - 0.2) {
      tendencia = 'Mejora sostenida';
      tendenciaColor = this.brandColors.success;
    } else if (promedioFinal > promedioInicio + 0.2) {
      tendencia = 'Deterioro progresivo';
      tendenciaColor = this.brandColors.danger;
    }

    yPos += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('RESUMEN DEL SEGUIMIENTO CLÍNICO', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 12;
    doc.setFillColor(...this.brandColors.lightBg);
    doc.roundedRect(15, yPos, 180, 36, 3, 3, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text(`Total de evaluaciones realizadas: ${total}`, 22, yPos + 10);
    doc.text(
      `Evaluaciones con riesgo detectado: ${conRiesgo} de ${total}`,
      22,
      yPos + 19,
    );
    doc.text(`Último nivel registrado: ${ultimoNivel}`, 22, yPos + 28);
    doc.text(`Tendencia:`, 120, yPos + 10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...tendenciaColor);
    doc.text(tendencia, 145, yPos + 10);
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Evaluaciones sin riesgo: ${sinRiesgo} de ${total}`,
      120,
      yPos + 19,
    );

    // ── Factores más recurrentes ──
    yPos += 46;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('FACTORES DE RIESGO MÁS RECURRENTES', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    // Contar frecuencia de cada factor positivo en todas las evaluaciones
    const frecuencia: Record<string, number> = {};
    const evalConRiesgo = evaluaciones.filter(
      (e) => e.model_prediction?.risk_binary === 1,
    );

    evalConRiesgo.forEach((e) => {
      const shap = e.model_prediction?.shap_values;
      if (!shap) return;
      Object.entries(shap).forEach(([k, v]) => {
        if (this.LABEL_MAP[k] && v > 0) {
          frecuencia[k] = (frecuencia[k] || 0) + 1;
        }
      });
    });

    const factoresOrdenados = Object.entries(frecuencia)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    yPos += 10;
    if (factoresOrdenados.length > 0) {
      const tableBody = factoresOrdenados.map(([key, count], idx) => {
        const porcentajeAparicion = Math.round(
          (count / (evalConRiesgo.length || 1)) * 100,
        );
        let descripcion = '';

        if (porcentajeAparicion >= 80)
          descripcion =
            'Presente en casi todas las evaluaciones, requiere atención prioritaria';
        else if (porcentajeAparicion >= 50)
          descripcion =
            'Presente en la mayoría de evaluaciones, requiere seguimiento activo';
        else
          descripcion =
            'Aparece ocasionalmente, monitorear en próximas evaluaciones';

        return [
          `${idx + 1}. ${this.LABEL_MAP[key] ?? key}`,
          descripcion,
          `${count} de ${evalConRiesgo.length} eval.`,
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Factor Clínico', 'Interpretación', 'Frecuencia']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary, fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: 'bold' },
          1: { cellWidth: 108 },
          2: { cellWidth: 30, halign: 'center' },
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'No se registraron factores de riesgo en las evaluaciones.',
        15,
        yPos + 5,
      );
    }

    // ── Factores protectores ──
    const protectores: Record<string, number> = {};
    evalConRiesgo.forEach((e) => {
      const shap = e.model_prediction?.shap_values;
      if (!shap) return;
      Object.entries(shap).forEach(([k, v]) => {
        if (this.LABEL_MAP[k] && v < 0) {
          protectores[k] = (protectores[k] || 0) + 1;
        }
      });
    });

    const protectoresOrdenados = Object.entries(protectores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const lastY = (doc as any).lastAutoTable?.finalY || yPos + 40;
    yPos = lastY + 12;

    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('FACTORES PROTECTORES IDENTIFICADOS', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);
    yPos += 10;

    if (protectoresOrdenados.length > 0) {
      protectoresOrdenados.forEach(([key, count]) => {
        doc.setFillColor(...this.brandColors.success);
        doc.circle(20, yPos + 1.5, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...this.brandColors.textGray);
        doc.text(this.LABEL_MAP[key] ?? key, 25, yPos + 3);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Factor que reduce el riesgo, presente en ${count} evaluaciones.`,
          75,
          yPos + 3,
        );
        yPos += 10;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text(
        'No se identificaron factores protectores consistentes.',
        15,
        yPos,
      );
      yPos += 10;
    }

    // ── Conclusión narrativa ──
    yPos += 8;
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('CONCLUSIÓN DEL SEGUIMIENTO', 15, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    yPos += 10;
    doc.setFillColor(...this.brandColors.lightBg);
    doc.roundedRect(15, yPos, 180, 45, 3, 3, 'F');

    const topFactor = factoresOrdenados[0]
      ? (this.LABEL_MAP[factoresOrdenados[0][0]] ?? factoresOrdenados[0][0])
      : 'los factores identificados';
    const topProtector = protectoresOrdenados[0]
      ? (this.LABEL_MAP[protectoresOrdenados[0][0]] ??
        protectoresOrdenados[0][0])
      : null;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...this.brandColors.textGray);

    const texto1 = `Durante el seguimiento de ${total} evaluaciones, el modelo detectó indicadores de riesgo depresivo`;
    const texto2 = `en ${conRiesgo} oportunidades. El factor "${topFactor}" fue identificado como el de mayor`;
    const texto3 = `influencia en el diagnóstico del paciente.`;
    const texto4 = topProtector
      ? `El factor "${topProtector}" actuó como elemento protector durante el seguimiento.`
      : '';
    const texto5 = `Tendencia general: ${tendencia}. Se recomienda continuar el seguimiento clínico periódico.`;

    doc.text(texto1, 22, yPos + 9);
    doc.text(texto2, 22, yPos + 17);
    doc.text(texto3, 22, yPos + 25);
    if (texto4) doc.text(texto4, 22, yPos + 33);
    doc.text(texto5, 22, texto4 ? yPos + 41 : yPos + 33);

    // ── Firma ──
    yPos += 60;
    if (yPos > 265) {
      doc.addPage();
      yPos = 20;
    }
    doc.setDrawColor(0, 0, 0);
    doc.line(65, yPos, 145, yPos);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.brandColors.textGray);
    doc.text('Firma del Especialista', 105, yPos + 5, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      'Informe generado automáticamente por NeuroMind AI. No reemplaza el criterio clínico del especialista.',
      105,
      287,
      { align: 'center' },
    );

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Informe_Consolidado_${filename}.pdf`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. PDF HISTORIAL — tabla de todas las evaluaciones (sin porcentajes)
  // ══════════════════════════════════════════════════════════════════════════
  generateHistoryReport(patient: PatientPdfInfo, historial: HistoryItem[]) {
    const doc = new jsPDF();
    const nombrePaciente =
      patient.nombre_completo || patient.nombre || 'Paciente Desconocido';
    const edadTexto = this.calcularEdadTexto(patient);

    this.drawHeader(doc, 'Historial Clínico Completo');

    let yPos = 40;
    doc.setTextColor(...this.brandColors.textGray);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paciente: ${nombrePaciente}`, 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Edad: ${edadTexto} años   |   Sexo: ${patient.sexo || 'No especificado'}`,
      195,
      yPos,
      { align: 'right' },
    );
    yPos += 10;
    doc.setFontSize(10);
    doc.text(
      `Fecha de emisión: ${new Date().toLocaleDateString('es-PE')}`,
      15,
      yPos,
    );
    doc.text(`Total de evaluaciones: ${historial?.length || 0}`, 195, yPos, {
      align: 'right',
    });

    if (historial?.length > 0) {
      const tableBody = historial.map((item) => [
        item.fecha,
        item.doctor,
        item.severity ?? item.riesgo ?? 'Pendiente',
        item.status ?? 'Completado',
      ]);

      autoTable(doc, {
        startY: yPos + 15,
        head: [['Fecha', 'Especialista', 'Nivel de Riesgo', 'Estado']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: this.brandColors.primary, halign: 'center' },
        bodyStyles: { textColor: this.brandColors.textGray },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 72 },
          2: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 35, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const r = String(data.cell.raw).toLowerCase();
            if (r.includes('alto') || r.includes('severo'))
              data.cell.styles.textColor = this.brandColors.danger;
            else if (r.includes('leve'))
              data.cell.styles.textColor = this.brandColors.warning;
            else if (r === 'ninguno')
              data.cell.styles.textColor = this.brandColors.success;
          }
        },
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'Resumen histórico generado automáticamente por NeuroMind AI.',
      105,
      285,
      { align: 'center' },
    );

    const filename = nombrePaciente.replace(/\s+/g, '_');
    doc.save(`Historial_${filename}.pdf`);
  }
}
