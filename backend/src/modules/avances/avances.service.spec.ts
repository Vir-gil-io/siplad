import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAvance, EstadoPlaneacion, Rol } from '@prisma/client';

import { AvancesService } from './avances.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Pruebas unitarias del Web Service 3 — Control de avances por parcial.
 */
describe('AvancesService', () => {
  let servicio: AvancesService;
  let prisma: {
    planeacion: { findUnique: jest.Mock };
    periodoAcademico: { findUniqueOrThrow: jest.Mock };
    avance: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let festivos: { contarDiasHabiles: jest.Mock };

  /** Periodo academico de referencia para las pruebas del tramo informado. */
  const periodo = {
    id: 'per-1',
    nombre: 'Agosto - Diciembre 2026',
    fechaInicio: new Date('2026-08-17T00:00:00.000Z'),
    fechaFin: new Date('2026-12-18T23:59:59.999Z'),
  };

  /** Tramo valido, dentro del periodo y ya concluido. */
  const tramo = { fechaInicio: '2026-08-17', fechaFin: '2026-09-26' };

  const docente: UsuarioAutenticado = {
    id: 'doc-1',
    email: 'docente@utng.edu.mx',
    nombre: 'Docente Uno',
    rol: Rol.PROFESOR,
  };

  const coordinador: UsuarioAutenticado = {
    id: 'coord-1',
    email: 'coordinacion@utng.edu.mx',
    nombre: 'Coordinacion',
    rol: Rol.COORDINADOR,
  };

  const planeacionAprobada = {
    id: 'plan-1',
    parcial: 2,
    usuarioId: 'doc-1',
    periodoId: 'per-1',
    estado: EstadoPlaneacion.APROBADA,
    avance: null,
    periodo,
  };

  beforeEach(async () => {
    prisma = {
      planeacion: { findUnique: jest.fn() },
      periodoAcademico: { findUniqueOrThrow: jest.fn(() => Promise.resolve(periodo)) },
      avance: {
        create: jest.fn((args) => Promise.resolve({ id: 'av-1', ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(),
        update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve(undefined)),
      },
    };

    festivos = { contarDiasHabiles: jest.fn(() => Promise.resolve(28)) };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        AvancesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FestivosService, useValue: festivos },
      ],
    }).compile();

    servicio = modulo.get<AvancesService>(AvancesService);
  });

  describe('clasificar', () => {
    it('clasifica como CUMPLIDO desde el umbral de 85 por ciento', () => {
      expect(AvancesService.clasificar(100)).toBe(EstadoAvance.CUMPLIDO);
      expect(AvancesService.clasificar(85)).toBe(EstadoAvance.CUMPLIDO);
    });

    it('clasifica como PARCIAL entre 60 y 84 por ciento', () => {
      expect(AvancesService.clasificar(84)).toBe(EstadoAvance.PARCIAL);
      expect(AvancesService.clasificar(60)).toBe(EstadoAvance.PARCIAL);
    });

    it('clasifica como NO_CUMPLIDO por debajo de 60 por ciento', () => {
      expect(AvancesService.clasificar(59)).toBe(EstadoAvance.NO_CUMPLIDO);
      expect(AvancesService.clasificar(0)).toBe(EstadoAvance.NO_CUMPLIDO);
    });
  });

  describe('crear', () => {
    it('deriva el estado a partir del porcentaje informado', async () => {
      prisma.planeacion.findUnique.mockResolvedValue(planeacionAprobada);

      await servicio.crear({ planeacionId: 'plan-1', porcentaje: 70, ...tramo }, docente);

      expect(prisma.avance.create.mock.calls[0][0].data.estado).toBe(
        EstadoAvance.PARCIAL,
      );
    });

    it('rechaza el registro sobre una planeacion que no esta aprobada', async () => {
      prisma.planeacion.findUnique.mockResolvedValue({
        ...planeacionAprobada,
        estado: EstadoPlaneacion.ENVIADA,
      });

      await expect(
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90, ...tramo }, docente),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza el registro sobre la planeacion de otro docente', async () => {
      prisma.planeacion.findUnique.mockResolvedValue({
        ...planeacionAprobada,
        usuarioId: 'doc-2',
      });

      await expect(
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90, ...tramo }, docente),
      ).rejects.toThrow(ForbiddenException);
    });

    it('impide registrar dos avances para el mismo parcial', async () => {
      prisma.planeacion.findUnique.mockResolvedValue({
        ...planeacionAprobada,
        avance: { id: 'av-existente' },
      });

      await expect(
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90, ...tramo }, docente),
      ).rejects.toThrow(BadRequestException);
    });

    it('informa que no existe cuando la planeacion indicada no se encuentra', async () => {
      prisma.planeacion.findUnique.mockResolvedValue(null);

      await expect(
        servicio.crear(
          { planeacionId: 'inexistente', porcentaje: 90, ...tramo },
          docente,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('tramo informado', () => {
    beforeEach(() => {
      prisma.planeacion.findUnique.mockResolvedValue(planeacionAprobada);
    });

    it('guarda el tramo con los limites del dia en UTC', async () => {
      await servicio.crear({ planeacionId: 'plan-1', porcentaje: 70, ...tramo }, docente);

      const guardado = prisma.avance.create.mock.calls[0][0].data;
      expect(guardado.fechaInicio.toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(guardado.fechaFin.toISOString()).toBe('2026-09-26T23:59:59.999Z');
    });

    it('rechaza un tramo invertido', async () => {
      await expect(
        servicio.crear(
          {
            planeacionId: 'plan-1',
            porcentaje: 70,
            fechaInicio: '2026-09-26',
            fechaFin: '2026-08-17',
          },
          docente,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.avance.create).not.toHaveBeenCalled();
    });

    it('rechaza un tramo que comienza antes del periodo academico', async () => {
      await expect(
        servicio.crear(
          {
            planeacionId: 'plan-1',
            porcentaje: 70,
            fechaInicio: '2026-07-01',
            fechaFin: '2026-09-26',
          },
          docente,
        ),
      ).rejects.toThrow(/Agosto - Diciembre 2026/);
    });

    it('rechaza un tramo que termina despues del periodo academico', async () => {
      await expect(
        servicio.crear(
          {
            planeacionId: 'plan-1',
            porcentaje: 70,
            fechaInicio: '2026-08-17',
            fechaFin: '2027-01-15',
          },
          docente,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un tramo que comienza en el futuro', async () => {
      const futuro = new Date(Date.now() + 86_400_000 * 10).toISOString().slice(0, 10);

      await expect(
        servicio.crear(
          {
            planeacionId: 'plan-1',
            porcentaje: 70,
            fechaInicio: futuro,
            fechaFin: futuro,
          },
          docente,
        ),
      ).rejects.toThrow(/futuro/);
    });

    it('acompana el avance con los dias habiles del tramo', async () => {
      const creado = await servicio.crear(
        { planeacionId: 'plan-1', porcentaje: 70, ...tramo },
        docente,
      );

      expect(festivos.contarDiasHabiles).toHaveBeenCalled();
      expect(creado.diasHabiles).toBe(28);
    });
  });

  describe('listar', () => {
    it('restringe el resultado a los avances propios cuando el rol es PROFESOR', async () => {
      await servicio.listar(docente);

      expect(prisma.avance.findMany.mock.calls[0][0].where).toEqual({
        planeacion: { usuarioId: 'doc-1' },
      });
    });

    it('no impone filtro de propiedad cuando consulta el COORDINADOR', async () => {
      await servicio.listar(coordinador);

      expect(prisma.avance.findMany.mock.calls[0][0].where).toEqual({
        planeacion: {},
      });
    });
  });

  describe('actualizar', () => {
    it('recalcula el estado cuando cambia el porcentaje', async () => {
      prisma.avance.findUnique.mockResolvedValue({
        id: 'av-1',
        porcentaje: 50,
        planeacion: { usuarioId: 'doc-1' },
      });

      await servicio.actualizar('av-1', { porcentaje: 95 }, docente);

      expect(prisma.avance.update.mock.calls[0][0].data.estado).toBe(
        EstadoAvance.CUMPLIDO,
      );
    });

    it('niega la modificacion del avance de otro docente', async () => {
      prisma.avance.findUnique.mockResolvedValue({
        id: 'av-1',
        planeacion: { usuarioId: 'doc-2' },
      });

      await expect(
        servicio.actualizar('av-1', { porcentaje: 95 }, docente),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
