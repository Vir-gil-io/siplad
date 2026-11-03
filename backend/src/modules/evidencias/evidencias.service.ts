import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoEvidencia, Rol } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CrearEvidenciaDto } from './dto/crear-evidencia.dto';
import { ValidarEvidenciaDto } from './dto/validar-evidencia.dto';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Web Service 4 de 5 — Evidencias de capacitacion.
 *
 * Capa de logica de negocio. Orquesta la validacion del archivo, su envio a
 * la capa de integracion y el flujo de validacion por parte de la
 * coordinacion. Solo las evidencias validadas suman horas en los indicadores.
 */
@Injectable()
export class EvidenciasService {
  private readonly relaciones = {
    usuario: { select: { id: true, nombre: true, email: true } },
    periodo: { select: { id: true, nombre: true, anio: true } },
    validadoPor: { select: { id: true, nombre: true } },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: CloudinaryService,
  ) {}

  async crear(
    dto: CrearEvidenciaDto,
    archivo: Express.Multer.File,
    usuario: UsuarioAutenticado,
  ) {
    // La validacion y el envio del archivo se delegan por completo en la capa
    // de integracion; este servicio no conoce al proveedor.
    const subido = await this.almacenamiento.subir(archivo);

    return this.prisma.evidencia.create({
      data: {
        nombreCurso: dto.nombreCurso.trim(),
        institucion: dto.institucion.trim(),
        fecha: new Date(dto.fecha),
        horas: dto.horas,
        archivoUrl: subido.url,
        usuarioId: usuario.id,
        periodoId: dto.periodoId,
        estado: EstadoEvidencia.PENDIENTE,
      },
      include: this.relaciones,
    });
  }

  async listar(
    usuario: UsuarioAutenticado,
    filtros: { periodoId?: string; estado?: EstadoEvidencia } = {},
  ) {
    return this.prisma.evidencia.findMany({
      where: {
        ...(usuario.rol === Rol.PROFESOR && { usuarioId: usuario.id }),
        ...(filtros.periodoId && { periodoId: filtros.periodoId }),
        ...(filtros.estado && { estado: filtros.estado }),
      },
      include: this.relaciones,
      orderBy: { creadaEn: 'desc' },
    });
  }

  async obtenerPorId(id: string, usuario: UsuarioAutenticado) {
    const evidencia = await this.prisma.evidencia.findUnique({
      where: { id },
      include: this.relaciones,
    });

    if (!evidencia) {
      throw new NotFoundException('La evidencia solicitada no existe.');
    }

    if (usuario.rol === Rol.PROFESOR && evidencia.usuarioId !== usuario.id) {
      throw new ForbiddenException('No tiene acceso a la informacion de otro docente.');
    }

    return evidencia;
  }

  /** Transicion de estado reservada al rol COORDINADOR. */
  async validar(id: string, dto: ValidarEvidenciaDto, usuario: UsuarioAutenticado) {
    if (dto.estado === EstadoEvidencia.PENDIENTE) {
      throw new BadRequestException(
        'La validacion debe concluir en evidencia validada o rechazada.',
      );
    }

    if (dto.estado === EstadoEvidencia.RECHAZADA && !dto.motivoRechazo) {
      throw new BadRequestException(
        'Debe indicar el motivo del rechazo de la evidencia.',
      );
    }

    const evidencia = await this.prisma.evidencia.findUnique({ where: { id } });
    if (!evidencia) {
      throw new NotFoundException('La evidencia solicitada no existe.');
    }

    return this.prisma.evidencia.update({
      where: { id },
      data: {
        estado: dto.estado,
        motivoRechazo: dto.motivoRechazo ?? null,
        validadoPorId: usuario.id,
        validadoEn: new Date(),
      },
      include: this.relaciones,
    });
  }

  async eliminar(id: string, usuario: UsuarioAutenticado) {
    const evidencia = await this.obtenerPorId(id, usuario);

    if (evidencia.usuarioId !== usuario.id && usuario.rol !== Rol.COORDINADOR) {
      throw new ForbiddenException(
        'Solo el autor o la coordinacion pueden eliminar la evidencia.',
      );
    }

    if (evidencia.estado === EstadoEvidencia.VALIDADA) {
      throw new BadRequestException('Una evidencia ya validada no puede eliminarse.');
    }

    await this.prisma.evidencia.delete({ where: { id } });
    return { mensaje: 'Evidencia eliminada.' };
  }
}
