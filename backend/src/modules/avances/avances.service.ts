import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAvance, EstadoPlaneacion, Rol } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CrearAvanceDto } from './dto/crear-avance.dto';
import { ActualizarAvanceDto } from './dto/actualizar-avance.dto';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Web Service 3 de 5 — Control de avances por parcial.
 *
 * Capa de logica de negocio. Deriva el estado de cumplimiento a partir del
 * porcentaje informado y garantiza que el avance se registre unicamente sobre
 * planeaciones ya aprobadas por la coordinacion.
 */
@Injectable()
export class AvancesService {
  /** Umbrales institucionales de clasificacion del cumplimiento. */
  private static readonly UMBRAL_CUMPLIDO = 85;
  private static readonly UMBRAL_PARCIAL = 60;

  private readonly relaciones = {
    planeacion: {
      include: {
        materia: { select: { id: true, clave: true, nombre: true } },
        periodo: { select: { id: true, nombre: true, anio: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Regla de negocio central del modulo: la clasificacion no la decide el
   * usuario, se deriva del porcentaje para que el indicador institucional sea
   * comparable entre docentes.
   */
  static clasificar(porcentaje: number): EstadoAvance {
    if (porcentaje >= AvancesService.UMBRAL_CUMPLIDO) return EstadoAvance.CUMPLIDO;
    if (porcentaje >= AvancesService.UMBRAL_PARCIAL) return EstadoAvance.PARCIAL;
    return EstadoAvance.NO_CUMPLIDO;
  }

  async crear(dto: CrearAvanceDto, usuario: UsuarioAutenticado) {
    const planeacion = await this.prisma.planeacion.findUnique({
      where: { id: dto.planeacionId },
      include: { avance: true },
    });

    if (!planeacion) {
      throw new NotFoundException('La planeacion indicada no existe.');
    }

    if (planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException(
        'Solo puede registrar avances sobre sus propias planeaciones.',
      );
    }

    if (planeacion.estado !== EstadoPlaneacion.APROBADA) {
      throw new BadRequestException(
        'El avance solo puede registrarse sobre una planeacion aprobada.',
      );
    }

    if (planeacion.avance) {
      throw new BadRequestException(
        `Ya existe un avance registrado para el parcial ${planeacion.parcial} de esa materia.`,
      );
    }

    return this.prisma.avance.create({
      data: {
        planeacionId: dto.planeacionId,
        porcentaje: dto.porcentaje,
        estado: AvancesService.clasificar(dto.porcentaje),
        observaciones: dto.observaciones,
      },
      include: this.relaciones,
    });
  }

  async listar(usuario: UsuarioAutenticado, periodoId?: string) {
    return this.prisma.avance.findMany({
      where: {
        planeacion: {
          ...(usuario.rol === Rol.PROFESOR && { usuarioId: usuario.id }),
          ...(periodoId && { periodoId }),
        },
      },
      include: this.relaciones,
      orderBy: { registradoEn: 'desc' },
    });
  }

  async obtenerPorId(id: string, usuario: UsuarioAutenticado) {
    const avance = await this.prisma.avance.findUnique({
      where: { id },
      include: this.relaciones,
    });

    if (!avance) {
      throw new NotFoundException('El avance solicitado no existe.');
    }

    if (usuario.rol === Rol.PROFESOR && avance.planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException('No tiene acceso a la informacion de otro docente.');
    }

    return avance;
  }

  async actualizar(id: string, dto: ActualizarAvanceDto, usuario: UsuarioAutenticado) {
    const avance = await this.obtenerPorId(id, usuario);

    if (avance.planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo el autor puede modificar el avance registrado.');
    }

    return this.prisma.avance.update({
      where: { id },
      data: {
        ...(dto.porcentaje !== undefined && {
          porcentaje: dto.porcentaje,
          estado: AvancesService.clasificar(dto.porcentaje),
        }),
        ...(dto.observaciones !== undefined && {
          observaciones: dto.observaciones,
        }),
      },
      include: this.relaciones,
    });
  }

  async eliminar(id: string, usuario: UsuarioAutenticado) {
    const avance = await this.obtenerPorId(id, usuario);

    if (avance.planeacion.usuarioId !== usuario.id && usuario.rol !== Rol.COORDINADOR) {
      throw new ForbiddenException(
        'Solo el autor o la coordinacion pueden eliminar el avance.',
      );
    }

    await this.prisma.avance.delete({ where: { id } });
    return { mensaje: 'Avance eliminado.' };
  }
}
