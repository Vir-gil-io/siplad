import { Test, TestingModule } from '@nestjs/testing';
import { EstadoAvance, EstadoEvidencia, EstadoPlaneacion } from '@prisma/client';

import { ReportesService } from './reportes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';

/**
 * Pruebas unitarias del Web Service 5 — Reportes institucionales.
 *
 * Verifican la correccion de las agregaciones y la degradacion controlada
 * cuando el servicio externo de dias festivos no responde.
 */
describe('ReportesService', () => {
  let servicio: ReportesService;
  let prisma: any;
  let festivos: { contarDiasHabiles: jest.Mock; obtenerFestivos: jest.Mock };

  const periodo = {
    id: 'per-1',
    nombre: 'Agosto - Diciembre 2026',
    anio: 2026,
    fechaInicio: new Date('2026-08-17'),
    fechaFin: new Date('2026-12-18'),
    activo: true,
  };

  beforeEach(async () => {
    prisma = {
      periodoAcademico: {
        findFirst: jest.fn(() => Promise.resolve(periodo)),
        findUnique: jest.fn(() => Promise.resolve(periodo)),
      },
      planeacion: { findMany: jest.fn(() => Promise.resolve([])) },
      avance: { findMany: jest.fn(() => Promise.resolve([])) },
      evidencia: { findMany: jest.fn(() => Promise.resolve([])) },
      usuario: { findMany: jest.fn(() => Promise.resolve([])) },
      materia: { findMany: jest.fn(() => Promise.resolve([])) },
    };

    festivos = {
      contarDiasHabiles: jest.fn(() => Promise.resolve(88)),
      obtenerFestivos: jest.fn(() => Promise.resolve([])),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        ReportesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FestivosService, useValue: festivos },
      ],
    }).compile();

    servicio = modulo.get<ReportesService>(ReportesService);
  });

  describe('indicadoresGlobales', () => {
    it('calcula el porcentaje de cumplimiento de planeaciones', async () => {
      prisma.planeacion.findMany.mockResolvedValue([
        { estado: EstadoPlaneacion.APROBADA },
        { estado: EstadoPlaneacion.APROBADA },
        { estado: EstadoPlaneacion.APROBADA },
        { estado: EstadoPlaneacion.ENVIADA },
      ]);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.planeaciones.total).toBe(4);
      expect(resultado.planeaciones.aprobadas).toBe(3);
      expect(resultado.planeaciones.porcentajeCumplimiento).toBe(75);
    });

    it('informa cero por ciento de cumplimiento sin dividir entre cero', async () => {
      prisma.planeacion.findMany.mockResolvedValue([]);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.planeaciones.porcentajeCumplimiento).toBe(0);
      expect(resultado.avances.porcentajePromedio).toBe(0);
    });

    it('promedia el avance registrado y clasifica por estado', async () => {
      prisma.avance.findMany.mockResolvedValue([
        { estado: EstadoAvance.CUMPLIDO, porcentaje: 100 },
        { estado: EstadoAvance.PARCIAL, porcentaje: 70 },
        { estado: EstadoAvance.NO_CUMPLIDO, porcentaje: 40 },
      ]);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.avances.porcentajePromedio).toBe(70);
      expect(resultado.avances.cumplidos).toBe(1);
      expect(resultado.avances.parciales).toBe(1);
      expect(resultado.avances.noCumplidos).toBe(1);
    });

    it('suma horas unicamente de las evidencias validadas', async () => {
      prisma.evidencia.findMany.mockResolvedValue([
        { estado: EstadoEvidencia.VALIDADA, horas: 40, usuarioId: 'doc-1' },
        { estado: EstadoEvidencia.VALIDADA, horas: 20, usuarioId: 'doc-1' },
        { estado: EstadoEvidencia.PENDIENTE, horas: 30, usuarioId: 'doc-2' },
        { estado: EstadoEvidencia.RECHAZADA, horas: 15, usuarioId: 'doc-3' },
      ]);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.capacitacion.horasAcreditadas).toBe(60);
      expect(resultado.capacitacion.evidenciasPendientes).toBe(1);
      expect(resultado.capacitacion.evidenciasRechazadas).toBe(1);
    });

    it('cuenta cada docente una sola vez aunque acredite varios cursos', async () => {
      prisma.evidencia.findMany.mockResolvedValue([
        { estado: EstadoEvidencia.VALIDADA, horas: 40, usuarioId: 'doc-1' },
        { estado: EstadoEvidencia.VALIDADA, horas: 20, usuarioId: 'doc-1' },
        { estado: EstadoEvidencia.VALIDADA, horas: 25, usuarioId: 'doc-2' },
      ]);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.capacitacion.docentesConCapacitacion).toBe(2);
    });

    it('incorpora los dias habiles obtenidos de la capa de integracion', async () => {
      const resultado = await servicio.indicadoresGlobales();

      expect(festivos.contarDiasHabiles).toHaveBeenCalledWith(
        periodo.fechaInicio,
        periodo.fechaFin,
      );
      expect(resultado.diasHabilesDelPeriodo).toBe(88);
    });

    it('informa el indicador como no disponible si el servicio externo falla', async () => {
      // Degradacion controlada: el reporte se entrega aunque la integracion
      // no responda.
      festivos.contarDiasHabiles.mockResolvedValue(0);

      const resultado = await servicio.indicadoresGlobales();

      expect(resultado.diasHabilesDelPeriodo).toBeNull();
    });

    it('resuelve el periodo activo cuando no se indica uno', async () => {
      await servicio.indicadoresGlobales();

      expect(prisma.periodoAcademico.findFirst).toHaveBeenCalledWith({
        where: { activo: true },
      });
    });

    it('usa el periodo indicado cuando se especifica', async () => {
      await servicio.indicadoresGlobales('per-9');

      expect(prisma.periodoAcademico.findUnique).toHaveBeenCalledWith({
        where: { id: 'per-9' },
      });
    });
  });

  describe('porDocente', () => {
    it('agrega los indicadores de cada docente', async () => {
      prisma.usuario.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          nombre: 'Docente Uno',
          email: 'uno@utng.edu.mx',
          planeaciones: [
            { estado: EstadoPlaneacion.APROBADA, avance: { porcentaje: 100 } },
            { estado: EstadoPlaneacion.APROBADA, avance: { porcentaje: 80 } },
            { estado: EstadoPlaneacion.ENVIADA, avance: null },
          ],
          evidencias: [{ horas: 40 }, { horas: 20 }],
        },
      ]);

      const [fila] = await servicio.porDocente();

      expect(fila.planeacionesRegistradas).toBe(3);
      expect(fila.planeacionesAprobadas).toBe(2);
      expect(fila.porcentajeCumplimientoPlaneacion).toBe(66.7);
      expect(fila.avancesRegistrados).toBe(2);
      expect(fila.promedioAvance).toBe(90);
      expect(fila.horasAcreditadas).toBe(60);
    });

    it('devuelve ceros para un docente sin registros', async () => {
      prisma.usuario.findMany.mockResolvedValue([
        {
          id: 'doc-2',
          nombre: 'Docente Dos',
          email: 'dos@utng.edu.mx',
          planeaciones: [],
          evidencias: [],
        },
      ]);

      const [fila] = await servicio.porDocente();

      expect(fila.porcentajeCumplimientoPlaneacion).toBe(0);
      expect(fila.promedioAvance).toBe(0);
      expect(fila.horasAcreditadas).toBe(0);
    });
  });

  describe('porParcial', () => {
    it('devuelve una fila por cada uno de los tres parciales', async () => {
      prisma.planeacion.findMany.mockResolvedValue([
        {
          parcial: 1,
          estado: EstadoPlaneacion.APROBADA,
          avance: { estado: EstadoAvance.CUMPLIDO, porcentaje: 100 },
        },
        {
          parcial: 1,
          estado: EstadoPlaneacion.APROBADA,
          avance: { estado: EstadoAvance.PARCIAL, porcentaje: 70 },
        },
        { parcial: 2, estado: EstadoPlaneacion.ENVIADA, avance: null },
      ]);

      const filas = await servicio.porParcial();

      expect(filas).toHaveLength(3);
      expect(filas[0].parcial).toBe(1);
      expect(filas[0].planeaciones).toBe(2);
      expect(filas[0].cumplidos).toBe(1);
      expect(filas[0].parciales).toBe(1);
      expect(filas[0].promedioAvance).toBe(85);
      expect(filas[1].planeaciones).toBe(1);
      expect(filas[2].planeaciones).toBe(0);
    });
  });
});
