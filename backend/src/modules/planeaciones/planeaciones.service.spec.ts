import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPlaneacion, Rol } from '@prisma/client';

import { PlaneacionesService } from './planeaciones.service';
import { PlaneacionesRepository } from './planeaciones.repository';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Pruebas unitarias del Web Service 2 — Planeacion didactica.
 *
 * Verifican las reglas del dominio en aislamiento: el repositorio se sustituye
 * por un doble de prueba y no se establece ninguna conexion a base de datos.
 */
describe('PlaneacionesService', () => {
  let servicio: PlaneacionesService;
  let repositorio: {
    crear: jest.Mock;
    buscarPorId: jest.Mock;
    buscarDuplicada: jest.Mock;
    listar: jest.Mock;
    actualizar: jest.Mock;
    eliminar: jest.Mock;
  };

  const docente: UsuarioAutenticado = {
    id: 'doc-1',
    email: 'docente@utng.edu.mx',
    nombre: 'Docente Uno',
    rol: Rol.PROFESOR,
  };

  const otroDocente: UsuarioAutenticado = {
    id: 'doc-2',
    email: 'otro@utng.edu.mx',
    nombre: 'Docente Dos',
    rol: Rol.PROFESOR,
  };

  const coordinador: UsuarioAutenticado = {
    id: 'coord-1',
    email: 'coordinacion@utng.edu.mx',
    nombre: 'Coordinacion',
    rol: Rol.COORDINADOR,
  };

  const datosAlta = {
    parcial: 1,
    contenido: 'Objetivos, secuencia didactica, recursos e instrumentos de evaluacion.',
    materiaId: 'mat-1',
    periodoId: 'per-1',
  };

  const planeacionDelDocente = {
    id: 'plan-1',
    parcial: 1,
    usuarioId: 'doc-1',
    materiaId: 'mat-1',
    periodoId: 'per-1',
    estado: EstadoPlaneacion.ENVIADA,
  };

  beforeEach(async () => {
    repositorio = {
      crear: jest.fn((d) => Promise.resolve({ id: 'plan-nueva', ...d })),
      buscarPorId: jest.fn(),
      buscarDuplicada: jest.fn(),
      listar: jest.fn(() => Promise.resolve([])),
      actualizar: jest.fn((id, d) => Promise.resolve({ id, ...d })),
      eliminar: jest.fn(() => Promise.resolve(undefined)),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        PlaneacionesService,
        { provide: PlaneacionesRepository, useValue: repositorio },
      ],
    }).compile();

    servicio = modulo.get<PlaneacionesService>(PlaneacionesService);
  });

  describe('crear', () => {
    it('registra la planeacion en estado ENVIADA y la atribuye al autor', async () => {
      repositorio.buscarDuplicada.mockResolvedValue(null);

      await servicio.crear(datosAlta, docente);

      const guardado = repositorio.crear.mock.calls[0][0];
      expect(guardado.estado).toBe(EstadoPlaneacion.ENVIADA);
      expect(guardado.usuarioId).toBe('doc-1');
    });

    it('rechaza una segunda planeacion para la misma materia, periodo y parcial', async () => {
      repositorio.buscarDuplicada.mockResolvedValue(planeacionDelDocente);

      await expect(servicio.crear(datosAlta, docente)).rejects.toThrow(
        BadRequestException,
      );
      expect(repositorio.crear).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('restringe el resultado a las planeaciones propias cuando el rol es PROFESOR', async () => {
      await servicio.listar({}, docente);

      expect(repositorio.listar).toHaveBeenCalledWith({ usuarioId: 'doc-1' });
    });

    it('ignora el filtro de usuario que envie un PROFESOR e impone el propio', async () => {
      // OWASP A01 — El filtro de propiedad se decide en el servidor.
      await servicio.listar({ usuarioId: 'doc-2' }, docente);

      expect(repositorio.listar).toHaveBeenCalledWith({ usuarioId: 'doc-1' });
    });

    it('permite al COORDINADOR consultar las planeaciones de un docente concreto', async () => {
      await servicio.listar({ usuarioId: 'doc-2' }, coordinador);

      expect(repositorio.listar).toHaveBeenCalledWith({ usuarioId: 'doc-2' });
    });

    it('no impone filtro de usuario cuando consulta el COORDINADOR sin especificarlo', async () => {
      await servicio.listar({ periodoId: 'per-1' }, coordinador);

      expect(repositorio.listar).toHaveBeenCalledWith({ periodoId: 'per-1' });
    });
  });

  describe('obtenerPorId', () => {
    it('devuelve la planeacion propia', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      const resultado = await servicio.obtenerPorId('plan-1', docente);

      expect(resultado.id).toBe('plan-1');
    });

    it('niega el acceso a la planeacion de otro docente', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      await expect(servicio.obtenerPorId('plan-1', otroDocente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite al COORDINADOR consultar la planeacion de cualquier docente', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      const resultado = await servicio.obtenerPorId('plan-1', coordinador);

      expect(resultado.id).toBe('plan-1');
    });

    it('informa que no existe cuando el identificador no corresponde a ningun registro', async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.obtenerPorId('inexistente', docente)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('actualizar', () => {
    it('devuelve la planeacion a revision al corregirla', async () => {
      repositorio.buscarPorId.mockResolvedValue({
        ...planeacionDelDocente,
        estado: EstadoPlaneacion.AJUSTES_SOLICITADOS,
      });

      await servicio.actualizar(
        'plan-1',
        { contenido: 'Contenido corregido conforme a la observacion recibida.' },
        docente,
      );

      const cambios = repositorio.actualizar.mock.calls[0][1];
      expect(cambios.estado).toBe(EstadoPlaneacion.ENVIADA);
      expect(cambios.comentarioRevision).toBeNull();
    });

    it('impide modificar una planeacion ya aprobada', async () => {
      repositorio.buscarPorId.mockResolvedValue({
        ...planeacionDelDocente,
        estado: EstadoPlaneacion.APROBADA,
      });

      await expect(
        servicio.actualizar(
          'plan-1',
          { contenido: 'Intento de modificacion posterior a la aprobacion.' },
          docente,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revisar', () => {
    it('aprueba la planeacion y registra quien la reviso', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      await servicio.revisar(
        'plan-1',
        { estado: EstadoPlaneacion.APROBADA },
        coordinador,
      );

      const cambios = repositorio.actualizar.mock.calls[0][1];
      expect(cambios.estado).toBe(EstadoPlaneacion.APROBADA);
      expect(cambios.revisadoPor).toEqual({ connect: { id: 'coord-1' } });
      expect(cambios.revisadoEn).toBeInstanceOf(Date);
    });

    it('exige un comentario cuando se solicitan ajustes', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      await expect(
        servicio.revisar(
          'plan-1',
          { estado: EstadoPlaneacion.AJUSTES_SOLICITADOS },
          coordinador,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta la solicitud de ajustes cuando se indica el motivo', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      await servicio.revisar(
        'plan-1',
        {
          estado: EstadoPlaneacion.AJUSTES_SOLICITADOS,
          comentarioRevision: 'Falta precisar los instrumentos de evaluacion.',
        },
        coordinador,
      );

      expect(repositorio.actualizar.mock.calls[0][1].comentarioRevision).toBe(
        'Falta precisar los instrumentos de evaluacion.',
      );
    });

    it('rechaza una revision que concluya en el estado inicial', async () => {
      await expect(
        servicio.revisar('plan-1', { estado: EstadoPlaneacion.ENVIADA }, coordinador),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('eliminar', () => {
    it('elimina una planeacion propia no aprobada', async () => {
      repositorio.buscarPorId.mockResolvedValue(planeacionDelDocente);

      const resultado = await servicio.eliminar('plan-1', docente);

      expect(repositorio.eliminar).toHaveBeenCalledWith('plan-1');
      expect(resultado.mensaje).toBe('Planeacion eliminada.');
    });

    it('impide eliminar una planeacion aprobada', async () => {
      repositorio.buscarPorId.mockResolvedValue({
        ...planeacionDelDocente,
        estado: EstadoPlaneacion.APROBADA,
      });

      await expect(servicio.eliminar('plan-1', docente)).rejects.toThrow(
        BadRequestException,
      );
      expect(repositorio.eliminar).not.toHaveBeenCalled();
    });
  });
});
