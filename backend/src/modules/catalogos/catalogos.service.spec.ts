import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { CatalogosService } from './catalogos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';

/** Pruebas unitarias de los catalogos de apoyo. */
describe('CatalogosService', () => {
  let servicio: CatalogosService;
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
      materia: { findMany: jest.fn(() => Promise.resolve([])) },
      periodoAcademico: {
        findMany: jest.fn(() => Promise.resolve([periodo])),
        findFirst: jest.fn(() => Promise.resolve(periodo)),
        findUnique: jest.fn(() => Promise.resolve(periodo)),
      },
    };

    festivos = {
      contarDiasHabiles: jest.fn(() => Promise.resolve(88)),
      obtenerFestivos: jest.fn(() =>
        Promise.resolve([
          {
            fecha: '2026-09-16',
            nombre: 'Independence Day',
            nombreLocal: 'Independencia',
          },
          { fecha: '2026-11-16', nombre: 'Revolution Day', nombreLocal: 'Revolucion' },
          {
            fecha: '2026-02-05',
            nombre: 'Constitution Day',
            nombreLocal: 'Constitucion',
          },
        ]),
      ),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogosService,
        { provide: PrismaService, useValue: prisma },
        { provide: FestivosService, useValue: festivos },
      ],
    }).compile();

    servicio = modulo.get<CatalogosService>(CatalogosService);
  });

  it('lista unicamente las materias activas', async () => {
    await servicio.listarMaterias();

    expect(prisma.materia.findMany).toHaveBeenCalledWith({
      where: { activa: true },
      orderBy: { clave: 'asc' },
    });
  });

  it('devuelve el periodo academico en curso', async () => {
    const resultado = await servicio.periodoActivo();

    expect(prisma.periodoAcademico.findFirst).toHaveBeenCalledWith({
      where: { activo: true },
    });
    expect(resultado.id).toBe('per-1');
  });

  it('lista los periodos ordenados del mas reciente al mas antiguo', async () => {
    await servicio.listarPeriodos();

    expect(prisma.periodoAcademico.findMany).toHaveBeenCalledWith({
      orderBy: [{ anio: 'desc' }, { fechaInicio: 'desc' }],
    });
  });

  describe('detallePeriodo', () => {
    it('incorpora los dias habiles del periodo', async () => {
      const resultado = await servicio.detallePeriodo('per-1');

      expect(resultado.diasHabiles).toBe(88);
    });

    it('informa solo los dias inhabiles comprendidos en el periodo', async () => {
      const resultado = await servicio.detallePeriodo('per-1');

      // El 5 de febrero queda fuera del periodo agosto-diciembre.
      expect(resultado.diasInhabiles).toHaveLength(2);
      expect(resultado.diasInhabiles.map((d) => d.fecha)).toEqual([
        '2026-09-16',
        '2026-11-16',
      ]);
    });

    it('informa que no existe cuando el periodo no se encuentra', async () => {
      prisma.periodoAcademico.findUnique.mockResolvedValue(null);

      await expect(servicio.detallePeriodo('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
