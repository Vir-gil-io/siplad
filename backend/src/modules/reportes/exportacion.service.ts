import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { ReportesService } from './reportes.service';
import type { FiltroReporte } from './dto/filtrar-reporte.dto';

/**
 * Exportacion de reportes institucionales a PDF y a Excel.
 *
 * Forma parte del Web Service 5. Se mantiene como clase independiente para
 * que el servicio de indicadores conserve una sola responsabilidad: calcular.
 * Esta clase solo da formato a lo ya calculado.
 */
@Injectable()
export class ExportacionService {
  private static readonly ENCABEZADO_INSTITUCIONAL =
    'Universidad Tecnologica del Norte de Guanajuato';

  constructor(private readonly reportes: ReportesService) {}

  async generarExcel(filtro: FiltroReporte = {}): Promise<Buffer> {
    const [indicadores, docentes, parciales, materias] = await Promise.all([
      this.reportes.indicadoresGlobales(filtro),
      this.reportes.porDocente(filtro),
      this.reportes.porParcial(filtro),
      this.reportes.porMateria(filtro),
    ]);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'SIPLAD';
    libro.created = new Date();

    // ----------------------------- Resumen ---------------------------------
    const resumen = libro.addWorksheet('Resumen');
    resumen.columns = [
      { header: 'Indicador', key: 'indicador', width: 46 },
      { header: 'Valor', key: 'valor', width: 18 },
    ];

    const filas: Array<[string, string | number]> = [
      ['Periodo academico', indicadores.periodo?.nombre ?? 'No definido'],
      ['Planeaciones registradas', indicadores.planeaciones.total],
      ['Planeaciones aprobadas', indicadores.planeaciones.aprobadas],
      ['Planeaciones en revision', indicadores.planeaciones.enviadas],
      [
        'Planeaciones con ajustes solicitados',
        indicadores.planeaciones.ajustesSolicitados,
      ],
      ['Cumplimiento de planeacion (%)', indicadores.planeaciones.porcentajeCumplimiento],
      ['Avances registrados', indicadores.avances.total],
      ['Avances cumplidos', indicadores.avances.cumplidos],
      ['Avances parciales', indicadores.avances.parciales],
      ['Avances no cumplidos', indicadores.avances.noCumplidos],
      ['Promedio de avance (%)', indicadores.avances.porcentajePromedio],
      ['Evidencias validadas', indicadores.capacitacion.evidenciasValidadas],
      ['Evidencias pendientes', indicadores.capacitacion.evidenciasPendientes],
      ['Evidencias rechazadas', indicadores.capacitacion.evidenciasRechazadas],
      ['Horas de capacitacion acreditadas', indicadores.capacitacion.horasAcreditadas],
      [
        'Docentes con capacitacion acreditada',
        indicadores.capacitacion.docentesConCapacitacion,
      ],
      ['Dias habiles del periodo', indicadores.diasHabilesDelPeriodo ?? 'No disponible'],
    ];

    filas.forEach(([indicador, valor]) => resumen.addRow({ indicador, valor }));

    // -------------------------- Por docente --------------------------------
    const hojaDocentes = libro.addWorksheet('Por docente');
    hojaDocentes.columns = [
      { header: 'Docente', key: 'docente', width: 36 },
      { header: 'Correo', key: 'email', width: 30 },
      { header: 'Planeaciones', key: 'planeacionesRegistradas', width: 14 },
      { header: 'Aprobadas', key: 'planeacionesAprobadas', width: 12 },
      { header: 'Cumplimiento (%)', key: 'porcentajeCumplimientoPlaneacion', width: 18 },
      { header: 'Avances', key: 'avancesRegistrados', width: 10 },
      { header: 'Promedio avance (%)', key: 'promedioAvance', width: 20 },
      { header: 'Horas acreditadas', key: 'horasAcreditadas', width: 18 },
    ];
    docentes.forEach((d) => hojaDocentes.addRow(d));

    // -------------------------- Por parcial --------------------------------
    const hojaParciales = libro.addWorksheet('Por parcial');
    hojaParciales.columns = [
      { header: 'Parcial', key: 'parcial', width: 10 },
      { header: 'Planeaciones', key: 'planeaciones', width: 14 },
      { header: 'Aprobadas', key: 'aprobadas', width: 12 },
      { header: 'Avances', key: 'avancesRegistrados', width: 10 },
      { header: 'Cumplidos', key: 'cumplidos', width: 12 },
      { header: 'Parciales', key: 'parciales', width: 12 },
      { header: 'No cumplidos', key: 'noCumplidos', width: 14 },
      { header: 'Promedio avance (%)', key: 'promedioAvance', width: 20 },
    ];
    parciales.forEach((p) => hojaParciales.addRow(p));

    // -------------------------- Por materia --------------------------------
    const hojaMaterias = libro.addWorksheet('Por materia');
    hojaMaterias.columns = [
      { header: 'Clave', key: 'clave', width: 12 },
      { header: 'Materia', key: 'materia', width: 34 },
      { header: 'Planeaciones', key: 'planeaciones', width: 14 },
      { header: 'Aprobadas', key: 'aprobadas', width: 12 },
      { header: 'Promedio avance (%)', key: 'promedioAvance', width: 20 },
    ];
    materias.forEach((m) => hojaMaterias.addRow(m));

    // Formato uniforme de los encabezados en todas las hojas.
    libro.eachSheet((hoja) => {
      const encabezado = hoja.getRow(1);
      encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      encabezado.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F3864' },
      };
      encabezado.alignment = { vertical: 'middle', horizontal: 'center' };
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
    });

    const datos = await libro.xlsx.writeBuffer();
    return Buffer.from(datos);
  }

  async generarPdf(filtro: FiltroReporte = {}): Promise<Buffer> {
    const [indicadores, docentes, parciales] = await Promise.all([
      this.reportes.indicadoresGlobales(filtro),
      this.reportes.porDocente(filtro),
      this.reportes.porParcial(filtro),
    ]);

    return new Promise((resolver, rechazar) => {
      try {
        const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
        const trozos: Buffer[] = [];

        doc.on('data', (t: Buffer) => trozos.push(t));
        doc.on('end', () => resolver(Buffer.concat(trozos)));
        doc.on('error', rechazar);

        // ------------------------- Encabezado ------------------------------
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(ExportacionService.ENCABEZADO_INSTITUCIONAL, { align: 'center' });
        doc
          .fontSize(12)
          .font('Helvetica')
          .text('Sistema Institucional de Planeacion y Avance Docente', {
            align: 'center',
          });
        doc.moveDown(0.3);
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('Reporte de seguimiento institucional', { align: 'center' });
        doc.moveDown(0.2);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#555555')
          .text(
            `Periodo: ${indicadores.periodo?.nombre ?? 'No definido'}   |   ` +
              `Generado el ${new Date().toLocaleString('es-MX')}`,
            { align: 'center' },
          );

        // Un reporte acotado debe decirlo en la portada: de otro modo es
        // indistinguible de uno completo y quien lo recibe lee cifras
        // parciales creyendolas totales.
        const acotacion = ExportacionService.describirAcotacion(filtro, docentes);
        if (acotacion) {
          doc.text(acotacion, { align: 'center' });
        }

        doc.fillColor('#000000');
        doc.moveDown(1);

        // ------------------------- Indicadores -----------------------------
        this.tituloSeccion(doc, 'Indicadores globales');

        const resumen: Array<[string, string]> = [
          ['Planeaciones registradas', String(indicadores.planeaciones.total)],
          ['Planeaciones aprobadas', String(indicadores.planeaciones.aprobadas)],
          [
            'Cumplimiento de planeacion',
            `${indicadores.planeaciones.porcentajeCumplimiento} %`,
          ],
          ['Avances registrados', String(indicadores.avances.total)],
          ['Promedio de avance', `${indicadores.avances.porcentajePromedio} %`],
          [
            'Horas de capacitacion acreditadas',
            String(indicadores.capacitacion.horasAcreditadas),
          ],
          [
            'Docentes con capacitacion acreditada',
            String(indicadores.capacitacion.docentesConCapacitacion),
          ],
        ];

        doc.fontSize(9).font('Helvetica');
        resumen.forEach(([etiqueta, valor]) => {
          doc.text(`${etiqueta}:`, { continued: true }).font('Helvetica-Bold');
          doc.text(`  ${valor}`).font('Helvetica');
        });
        doc.moveDown(1);

        // ------------------------ Tabla docentes ---------------------------
        this.tituloSeccion(doc, 'Cumplimiento por docente');
        this.dibujarTabla(
          doc,
          ['Docente', 'Plan.', 'Aprob.', 'Cumpl.%', 'Avances', 'Prom.%', 'Horas'],
          [180, 40, 46, 54, 50, 50, 44],
          docentes.map((d) => [
            d.docente,
            String(d.planeacionesRegistradas),
            String(d.planeacionesAprobadas),
            String(d.porcentajeCumplimientoPlaneacion),
            String(d.avancesRegistrados),
            String(d.promedioAvance),
            String(d.horasAcreditadas),
          ]),
        );

        doc.moveDown(1);

        // ------------------------ Tabla parciales --------------------------
        this.tituloSeccion(doc, 'Cumplimiento de avances por parcial');
        this.dibujarTabla(
          doc,
          ['Parcial', 'Plan.', 'Aprob.', 'Cumplidos', 'Parciales', 'No cumpl.', 'Prom.%'],
          [52, 44, 50, 66, 62, 66, 52],
          parciales.map((p) => [
            String(p.parcial),
            String(p.planeaciones),
            String(p.aprobadas),
            String(p.cumplidos),
            String(p.parciales),
            String(p.noCumplidos),
            String(p.promedioAvance),
          ]),
        );

        doc.end();
      } catch (error) {
        rechazar(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Titulo de seccion.
   *
   * Se devuelve el cursor al margen izquierdo antes de escribir. Las tablas
   * situan cada celda con coordenadas absolutas, y PDFKit conserva como
   * posicion actual la de la ultima celda dibujada: sin este reajuste, el
   * titulo siguiente aparece desplazado al extremo derecho de la hoja.
   */
  private tituloSeccion(doc: PDFKit.PDFDocument, texto: string) {
    doc.x = doc.page.margins.left;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1F3864')
      .text(texto, {
        align: 'left',
        width: ExportacionService.anchoUtil(doc),
      });
    doc.fillColor('#000000').moveDown(0.4);
  }

  /**
   * Enuncia la acotacion aplicada, para imprimirla bajo el titulo.
   *
   * El docente se nombra a partir de las filas ya calculadas: cuando el
   * reporte viene acotado a uno solo, esa lista trae exactamente su fila, de
   * modo que no hace falta una consulta adicional para conocer su nombre.
   */
  private static describirAcotacion(
    filtro: FiltroReporte,
    docentes: { docenteId: string; docente: string }[],
  ): string | null {
    const partes: string[] = [];
    if (filtro.parcial) partes.push(`Parcial ${filtro.parcial}`);
    if (filtro.docenteId) {
      const fila = docentes.find((d) => d.docenteId === filtro.docenteId);
      partes.push(`Docente: ${fila?.docente ?? 'no encontrado'}`);
    }
    return partes.length > 0 ? `Reporte acotado a  ${partes.join('   |   ')}` : null;
  }

  /** Ancho disponible entre margenes. */
  private static anchoUtil(doc: PDFKit.PDFDocument): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  private dibujarTabla(
    doc: PDFKit.PDFDocument,
    encabezados: string[],
    anchos: number[],
    filas: string[][],
  ) {
    const inicioX = doc.page.margins.left;
    const alturaFila = 16;

    const escribirFila = (celdas: string[], negrita: boolean) => {
      // Salto de pagina cuando ya no cabe otra fila.
      if (doc.y + alturaFila > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      const y = doc.y;
      doc.fontSize(8).font(negrita ? 'Helvetica-Bold' : 'Helvetica');

      let x = inicioX;
      celdas.forEach((celda, i) => {
        doc.text(celda, x + 3, y + 4, {
          width: anchos[i] - 6,
          height: alturaFila,
          ellipsis: true,
          lineBreak: false,
        });
        x += anchos[i];
      });

      const total = anchos.reduce((a, b) => a + b, 0);
      doc
        .moveTo(inicioX, y + alturaFila)
        .lineTo(inicioX + total, y + alturaFila)
        .strokeColor('#CCCCCC')
        .lineWidth(0.5)
        .stroke();

      // Se restituyen ambas coordenadas: el posicionamiento absoluto de las
      // celdas deja el cursor en la ultima columna, y lo que venga despues
      // debe arrancar del margen.
      doc.x = inicioX;
      doc.y = y + alturaFila;
    };

    escribirFila(encabezados, true);

    if (filas.length === 0) {
      doc.x = inicioX;
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('Sin registros en el periodo.', {
          width: ExportacionService.anchoUtil(doc),
        });
      doc.x = inicioX;
      return;
    }

    filas.forEach((fila) => escribirFila(fila, false));
    doc.x = inicioX;
  }
}
