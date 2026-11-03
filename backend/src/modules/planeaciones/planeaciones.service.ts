import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPlaneacion, Prisma, Rol } from '@prisma/client';

import { PlaneacionesRepository } from './planeaciones.repository';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CrearPlaneacionDto } from './dto/crear-planeacion.dto';
import { ActualizarPlaneacionDto } from './dto/actualizar-planeacion.dto';
import { RevisarPlaneacionDto } from './dto/revisar-planeacion.dto';
import { FiltrarPlaneacionesDto } from './dto/filtrar-planeaciones.dto';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Web Service 2 de 5 — Gestion de planeacion didactica.
 *
 * Capa de logica de negocio. Concentra las reglas del dominio: unicidad por
 * docente, materia, periodo y parcial; transiciones de estado validas; y
 * propiedad del recurso.
 */
@Injectable()
export class PlaneacionesService {
  constructor(
    private readonly repositorio: PlaneacionesRepository,
    private readonly almacenamiento: CloudinaryService,
  ) {}

  /**
   * El archivo es opcional: una planeacion breve puede escribirse en el
   * campo de texto, y una extensa adjuntarse como documento. Cuando viene
   * adjunto, el envio al proveedor se delega por completo en la capa de
   * integracion, que valida tipo y tamano antes de mover un solo byte.
   */
  async crear(
    dto: CrearPlaneacionDto,
    usuario: UsuarioAutenticado,
    archivo?: Express.Multer.File,
  ) {
    const duplicada = await this.repositorio.buscarDuplicada({
      usuarioId: usuario.id,
      materiaId: dto.materiaId,
      periodoId: dto.periodoId,
      parcial: dto.parcial,
    });

    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una planeacion registrada para el parcial ${dto.parcial} de esa materia en el periodo seleccionado.`,
      );
    }

    const archivoUrl = archivo ? await this.guardarArchivo(archivo) : null;

    return this.repositorio.crear({
      parcial: dto.parcial,
      contenido: dto.contenido,
      archivoUrl,
      usuarioId: usuario.id,
      materiaId: dto.materiaId,
      periodoId: dto.periodoId,
      estado: EstadoPlaneacion.ENVIADA,
    });
  }

  /** Envia el documento de planeacion al almacenamiento configurado. */
  private async guardarArchivo(archivo: Express.Multer.File): Promise<string> {
    const subido = await this.almacenamiento.subir(
      archivo,
      'siplad/planeaciones',
      CloudinaryService.TIPOS_PLANEACION,
    );
    return subido.url;
  }

  /**
   * OWASP A01 — Un docente solo obtiene sus propios registros. El filtro por
   * usuario se impone en el servidor y no puede sobrescribirse desde la
   * peticion.
   */
  async listar(filtros: FiltrarPlaneacionesDto, usuario: UsuarioAutenticado) {
    const condiciones: Prisma.PlaneacionWhereInput = {
      ...(filtros.periodoId && { periodoId: filtros.periodoId }),
      ...(filtros.materiaId && { materiaId: filtros.materiaId }),
      ...(filtros.estado && { estado: filtros.estado }),
      ...(filtros.parcial && { parcial: filtros.parcial }),
    };

    if (usuario.rol === Rol.PROFESOR) {
      condiciones.usuarioId = usuario.id;
    } else if (filtros.usuarioId) {
      condiciones.usuarioId = filtros.usuarioId;
    }

    return this.repositorio.listar(condiciones);
  }

  async obtenerPorId(id: string, usuario: UsuarioAutenticado) {
    const planeacion = await this.repositorio.buscarPorId(id);

    if (!planeacion) {
      throw new NotFoundException('La planeacion solicitada no existe.');
    }

    this.verificarAcceso(planeacion.usuarioId, usuario);
    return planeacion;
  }

  /**
   * Una planeacion aprobada queda inmutable: modificarla invalidaria la
   * revision ya emitida por la coordinacion.
   */
  async actualizar(
    id: string,
    dto: ActualizarPlaneacionDto,
    usuario: UsuarioAutenticado,
    archivo?: Express.Multer.File,
  ) {
    const planeacion = await this.obtenerPorId(id, usuario);

    if (planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo el autor de la planeacion puede modificarla.');
    }

    if (planeacion.estado === EstadoPlaneacion.APROBADA) {
      throw new BadRequestException('Una planeacion aprobada no puede modificarse.');
    }

    // Si se adjunta un documento nuevo, sustituye al anterior. El archivo
    // viejo permanece en el proveedor: conservarlo deja rastro de lo que el
    // docente entrego en cada version.
    const archivoUrl = archivo ? await this.guardarArchivo(archivo) : undefined;

    // Al corregir una planeacion con ajustes solicitados, vuelve a revision.
    return this.repositorio.actualizar(id, {
      ...dto,
      ...(archivoUrl !== undefined && { archivoUrl }),
      estado: EstadoPlaneacion.ENVIADA,
      comentarioRevision: null,
      revisadoEn: null,
      revisadoPor: { disconnect: true },
    });
  }

  /**
   * Transicion de estado reservada al rol COORDINADOR. La solicitud de
   * ajustes exige un comentario que explique el motivo.
   */
  async revisar(id: string, dto: RevisarPlaneacionDto, usuario: UsuarioAutenticado) {
    if (dto.estado === EstadoPlaneacion.ENVIADA) {
      throw new BadRequestException(
        'La revision debe concluir en aprobacion o en solicitud de ajustes.',
      );
    }

    if (dto.estado === EstadoPlaneacion.AJUSTES_SOLICITADOS && !dto.comentarioRevision) {
      throw new BadRequestException(
        'Debe indicar el motivo por el cual solicita ajustes.',
      );
    }

    const planeacion = await this.repositorio.buscarPorId(id);
    if (!planeacion) {
      throw new NotFoundException('La planeacion solicitada no existe.');
    }

    return this.repositorio.actualizar(id, {
      estado: dto.estado,
      comentarioRevision: dto.comentarioRevision ?? null,
      revisadoEn: new Date(),
      revisadoPor: { connect: { id: usuario.id } },
    });
  }

  async eliminar(id: string, usuario: UsuarioAutenticado) {
    const planeacion = await this.obtenerPorId(id, usuario);

    if (planeacion.usuarioId !== usuario.id && usuario.rol !== Rol.COORDINADOR) {
      throw new ForbiddenException(
        'Solo el autor o la coordinacion pueden eliminar la planeacion.',
      );
    }

    if (planeacion.estado === EstadoPlaneacion.APROBADA) {
      throw new BadRequestException('Una planeacion aprobada no puede eliminarse.');
    }

    await this.repositorio.eliminar(id);
    return { mensaje: 'Planeacion eliminada.' };
  }

  /** OWASP A01 — Prevencion de referencia directa insegura a objetos. */
  private verificarAcceso(propietarioId: string, usuario: UsuarioAutenticado) {
    if (usuario.rol === Rol.COORDINADOR) return;

    if (propietarioId !== usuario.id) {
      throw new ForbiddenException('No tiene acceso a la informacion de otro docente.');
    }
  }
}
