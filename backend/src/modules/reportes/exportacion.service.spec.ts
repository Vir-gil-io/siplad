import { Test, TestingModule } from '@nestjs/testing';

import { ExportacionService } from './exportacion.service';
import { ReportesService } from './reportes.service';

/**
 * Pruebas unitarias de la exportacion de reportes.
 *
 * Verifican que los archivos producidos sean documentos validos de su formato
 * y que el servicio de calculo se invoque con el periodo solicitado.
 */
describe('ExportacionService', () => {
  let servicio: ExportacionService;
  let reportes: {
    indicadoresGlobales: jest.Mock;
    porDocente: jest.Mock;
    porParcial: jest.Mock;
    porMateria: jest.Mock;
  };

  const indicadores = {
    periodo: { id: 'per-1', nombre: 'Agosto - Diciembre 2026', anio: 2026 },
    planeaciones: {
      total: 9,
      aprobadas: 6,
      enviadas: 2,
      ajustesSolicitados: 1,
      porcentajeCumplimiento: 66.7,
    },
    avances: {
      total: 6,
      cumplidos: 3,
      parciales: 2,
      noCumplidos: 1,
      porcentajePromedio: 81.7,
    },
    capacitacion: {
      evidenciasValidadas: 3,
      evidenciasPendientes: 1,
      evidenciasRechazadas: 1,
      horasAcreditadas: 85,
      docentesConCapacitacion: 2,
    },
    diasHabilesDelPeriodo: 88,
  };

  const docentes = [
    {
      docenteId: 'doc-1',
      docente: 'Jorge Alberto Correa Nunez',
      email: 'jcorrea@utng.edu.mx',
      planeacionesRegistradas: 4,
      planeacionesAprobadas: 3,
      porcentajeCumplimientoPlaneacion: 75,
      avancesRegistrados: 3,
      promedioAvance: 91.7,
      horasAcreditadas: 60,
    },
  ];

  const parciales = [
    {
      parcial: 1,
      planeaciones: 4,
      aprobadas: 4,
      avancesRegistrados: 4,
      cumplidos: 3,
      parciales: 1,
      noCumplidos: 0,
      promedioAvance: 93.8,
    },
  ];

  const materias = [
    {
      materiaId: 'mat-1',
      clave: 'MAT-101',
      materia: 'Matematicas I',
      planeaciones: 3,
      aprobadas: 2,
      promedioAvance: 87.5,
    },
  ];

  beforeEach(async () => {
    reportes = {
      indicadoresGlobales: jest.fn(() => Promise.resolve(indicadores)),
      porDocente: jest.fn(() => Promise.resolve(docentes)),
      porParcial: jest.fn(() => Promise.resolve(parciales)),
      porMateria: jest.fn(() => Promise.resolve(materias)),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [ExportacionService, { provide: ReportesService, useValue: reportes }],
    }).compile();

    servicio = modulo.get<ExportacionService>(ExportacionService);
  });

  describe('generarExcel', () => {
    it('produce un libro de trabajo valido', async () => {
      const archivo = await servicio.generarExcel();

      expect(Buffer.isBuffer(archivo)).toBe(true);
      expect(archivo.length).toBeGreaterThan(1000);
      // Un archivo xlsx es un contenedor comprimido: empieza con "PK".
      expect(archivo.subarray(0, 2).toString()).toBe('PK');
    });

    it('consulta las cuatro vistas del reporte', async () => {
      await servicio.generarExcel({ periodoId: 'per-1' });

      expect(reportes.indicadoresGlobales).toHaveBeenCalledWith({ periodoId: 'per-1' });
      expect(reportes.porDocente).toHaveBeenCalledWith({ periodoId: 'per-1' });
      expect(reportes.porParcial).toHaveBeenCalledWith({ periodoId: 'per-1' });
      expect(reportes.porMateria).toHaveBeenCalledWith({ periodoId: 'per-1' });
    });

    it('genera el libro aunque no existan registros en el periodo', async () => {
      reportes.porDocente.mockResolvedValue([]);
      reportes.porParcial.mockResolvedValue([]);
      reportes.porMateria.mockResolvedValue([]);

      const archivo = await servicio.generarExcel();

      expect(archivo.subarray(0, 2).toString()).toBe('PK');
    });
  });

  describe('acotacion del reporte', () => {
    it('traslada parcial y docente a las cuatro vistas', async () => {
      const filtro = { periodoId: 'per-1', parcial: 2, docenteId: 'doc-7' };

      await servicio.generarExcel(filtro);

      for (const vista of [
        reportes.indicadoresGlobales,
        reportes.porDocente,
        reportes.porParcial,
        reportes.porMateria,
      ]) {
        expect(vista).toHaveBeenCalledWith(filtro);
      }
    });
  });

  describe('generarPdf', () => {
    it('produce un documento PDF valido', async () => {
      const archivo = await servicio.generarPdf();

      expect(Buffer.isBuffer(archivo)).toBe(true);
      expect(archivo.length).toBeGreaterThan(500);
      // Todo PDF comienza con la firma "%PDF".
      expect(archivo.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('respeta el periodo solicitado', async () => {
      await servicio.generarPdf({ periodoId: 'per-9' });

      expect(reportes.indicadoresGlobales).toHaveBeenCalledWith({ periodoId: 'per-9' });
      expect(reportes.porDocente).toHaveBeenCalledWith({ periodoId: 'per-9' });
    });

    it('genera el documento aunque no existan registros en el periodo', async () => {
      reportes.porDocente.mockResolvedValue([]);
      reportes.porParcial.mockResolvedValue([]);

      const archivo = await servicio.generarPdf();

      expect(archivo.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('tolera un periodo no definido', async () => {
      reportes.indicadoresGlobales.mockResolvedValue({
        ...indicadores,
        periodo: null,
        diasHabilesDelPeriodo: null,
      });

      const archivo = await servicio.generarPdf();

      expect(archivo.subarray(0, 4).toString()).toBe('%PDF');
    });
  });
});
