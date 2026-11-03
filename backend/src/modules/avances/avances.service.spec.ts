import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAvance, EstadoPlaneacion, Rol } from '@prisma/client';

import { AvancesService } from './avances.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Pruebas unitarias del Web Service 3 — Control de avances por parcial.
 */
describe('AvancesService', () => {
  let servicio: AvancesService;
  let prisma: {
    planeacion: { findUnique: jest.Mock };
    avance: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

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
    estado: EstadoPlaneacion.APROBADA,
    avance: null,
  };

  beforeEach(async () => {
    prisma = {
      planeacion: { findUnique: jest.fn() },
      avance: {
        create: jest.fn((args) => Promise.resolve({ id: 'av-1', ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(),
        update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve(undefined)),
      },
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [AvancesService, { provide: PrismaService, useValue: prisma }],
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

      await servicio.crear({ planeacionId: 'plan-1', porcentaje: 70 }, docente);

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
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90 }, docente),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza el registro sobre la planeacion de otro docente', async () => {
      prisma.planeacion.findUnique.mockResolvedValue({
        ...planeacionAprobada,
        usuarioId: 'doc-2',
      });

      await expect(
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90 }, docente),
      ).rejects.toThrow(ForbiddenException);
    });

    it('impide registrar dos avances para el mismo parcial', async () => {
      prisma.planeacion.findUnique.mockResolvedValue({
        ...planeacionAprobada,
        avance: { id: 'av-existente' },
      });

      await expect(
        servicio.crear({ planeacionId: 'plan-1', porcentaje: 90 }, docente),
      ).rejects.toThrow(BadRequestException);
    });

    it('informa que no existe cuando la planeacion indicada no se encuentra', async () => {
      prisma.planeacion.findUnique.mockResolvedValue(null);

      await expect(
        servicio.crear({ planeacionId: 'inexistente', porcentaje: 90 }, docente),
      ).rejects.toThrow(NotFoundException);
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
