import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoEvidencia, Rol } from '@prisma/client';

import { EvidenciasService } from './evidencias.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Pruebas unitarias del Web Service 4 — Evidencias de capacitacion.
 *
 * La capa de integracion se sustituye por un doble de prueba: ninguna prueba
 * envia archivos al proveedor externo de almacenamiento.
 */
describe('EvidenciasService', () => {
  let servicio: EvidenciasService;
  let prisma: {
    evidencia: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let almacenamiento: { subir: jest.Mock };

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

  const archivo = {
    originalname: 'constancia.pdf',
    mimetype: 'application/pdf',
    size: 120_000,
    buffer: Buffer.from('contenido'),
  } as Express.Multer.File;

  const datosAlta = {
    nombreCurso: 'Evaluacion formativa en el aula',
    institucion: 'Secretaria de Educacion de Guanajuato',
    fecha: '2026-09-15',
    horas: 40,
    periodoId: 'per-1',
  };

  beforeEach(async () => {
    prisma = {
      evidencia: {
        create: jest.fn((args) => Promise.resolve({ id: 'ev-1', ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(),
        update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve(undefined)),
      },
    };

    almacenamiento = {
      subir: jest.fn(() =>
        Promise.resolve({
          url: 'https://almacenamiento.ejemplo/constancia.pdf',
          proveedor: 'cloudinary',
          identificador: 'siplad/evidencias/abc',
        }),
      ),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenciasService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: almacenamiento },
      ],
    }).compile();

    servicio = modulo.get<EvidenciasService>(EvidenciasService);
  });

  describe('crear', () => {
    it('delega el almacenamiento del archivo en la capa de integracion', async () => {
      await servicio.crear(datosAlta, archivo, docente);

      expect(almacenamiento.subir).toHaveBeenCalledWith(archivo);
    });

    it('persiste solo la referencia devuelta por el proveedor, no el archivo', async () => {
      await servicio.crear(datosAlta, archivo, docente);

      const guardado = prisma.evidencia.create.mock.calls[0][0].data;
      expect(guardado.archivoUrl).toBe('https://almacenamiento.ejemplo/constancia.pdf');
      expect(guardado).not.toHaveProperty('buffer');
    });

    it('registra la evidencia en estado PENDIENTE y la atribuye al autor', async () => {
      await servicio.crear(datosAlta, archivo, docente);

      const guardado = prisma.evidencia.create.mock.calls[0][0].data;
      expect(guardado.estado).toBe(EstadoEvidencia.PENDIENTE);
      expect(guardado.usuarioId).toBe('doc-1');
    });
  });

  describe('listar', () => {
    it('restringe el resultado a las evidencias propias cuando el rol es PROFESOR', async () => {
      await servicio.listar(docente);

      expect(prisma.evidencia.findMany.mock.calls[0][0].where).toEqual({
        usuarioId: 'doc-1',
      });
    });

    it('no impone filtro de propiedad cuando consulta el COORDINADOR', async () => {
      await servicio.listar(coordinador);

      expect(prisma.evidencia.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('obtenerPorId', () => {
    it('niega el acceso a la evidencia de otro docente', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({
        id: 'ev-1',
        usuarioId: 'doc-2',
      });

      await expect(servicio.obtenerPorId('ev-1', docente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('informa que no existe cuando el identificador no corresponde a ningun registro', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(null);

      await expect(servicio.obtenerPorId('inexistente', docente)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validar', () => {
    it('valida la evidencia y registra quien la valido', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({ id: 'ev-1', usuarioId: 'doc-1' });

      await servicio.validar('ev-1', { estado: EstadoEvidencia.VALIDADA }, coordinador);

      const cambios = prisma.evidencia.update.mock.calls[0][0].data;
      expect(cambios.estado).toBe(EstadoEvidencia.VALIDADA);
      expect(cambios.validadoPorId).toBe('coord-1');
      expect(cambios.validadoEn).toBeInstanceOf(Date);
    });

    it('exige el motivo cuando la evidencia se rechaza', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({ id: 'ev-1', usuarioId: 'doc-1' });

      await expect(
        servicio.validar('ev-1', { estado: EstadoEvidencia.RECHAZADA }, coordinador),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta el rechazo cuando se indica el motivo', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({ id: 'ev-1', usuarioId: 'doc-1' });

      await servicio.validar(
        'ev-1',
        {
          estado: EstadoEvidencia.RECHAZADA,
          motivoRechazo: 'La constancia no indica las horas acreditadas.',
        },
        coordinador,
      );

      expect(prisma.evidencia.update.mock.calls[0][0].data.motivoRechazo).toBe(
        'La constancia no indica las horas acreditadas.',
      );
    });

    it('rechaza una validacion que concluya en el estado inicial', async () => {
      await expect(
        servicio.validar('ev-1', { estado: EstadoEvidencia.PENDIENTE }, coordinador),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('eliminar', () => {
    it('elimina una evidencia propia aun pendiente', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({
        id: 'ev-1',
        usuarioId: 'doc-1',
        estado: EstadoEvidencia.PENDIENTE,
      });

      const resultado = await servicio.eliminar('ev-1', docente);

      expect(prisma.evidencia.delete).toHaveBeenCalledWith({ where: { id: 'ev-1' } });
      expect(resultado.mensaje).toBe('Evidencia eliminada.');
    });

    it('impide eliminar una evidencia ya validada, porque suma horas en los indicadores', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({
        id: 'ev-1',
        usuarioId: 'doc-1',
        estado: EstadoEvidencia.VALIDADA,
      });

      await expect(servicio.eliminar('ev-1', docente)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.evidencia.delete).not.toHaveBeenCalled();
    });
  });
});
