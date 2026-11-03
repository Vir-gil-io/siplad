import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Rol } from '@prisma/client';

import { PlaneacionesService } from './planeaciones.service';
import { CrearPlaneacionDto } from './dto/crear-planeacion.dto';
import { ActualizarPlaneacionDto } from './dto/actualizar-planeacion.dto';
import { RevisarPlaneacionDto } from './dto/revisar-planeacion.dto';
import { FiltrarPlaneacionesDto } from './dto/filtrar-planeaciones.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UsuarioActual,
  UsuarioAutenticado,
} from '../../common/decorators/usuario-actual.decorator';

/**
 * Esquemas del cuerpo multipart para la documentacion.
 *
 * Swagger deduce el cuerpo del DTO, pero el DTO no declara el adjunto a
 * proposito: la direccion del archivo no se acepta desde el cliente. Sin estos
 * esquemas la documentacion mostraria la operacion sin selector de archivo y
 * nadie podria probarla desde ahi.
 */
const CUERPO_CON_ADJUNTO: SchemaObject = {
  type: 'object',
  required: ['materiaId', 'periodoId', 'parcial', 'contenido'],
  properties: {
    materiaId: { type: 'string', format: 'uuid' },
    periodoId: { type: 'string', format: 'uuid' },
    parcial: { type: 'integer', minimum: 1, maximum: 3 },
    contenido: { type: 'string', minLength: 20, maxLength: 5000 },
    archivo: {
      type: 'string',
      format: 'binary',
      description: 'Opcional. PDF, DOC o DOCX de hasta 5 MB.',
    },
  },
};

const CUERPO_CORRECCION: SchemaObject = {
  type: 'object',
  properties: {
    contenido: { type: 'string', minLength: 20, maxLength: 5000 },
    archivo: {
      type: 'string',
      format: 'binary',
      description: 'Opcional. Sustituye al documento adjunto anterior.',
    },
  },
};

/** Web Service 2 de 5 — Gestion de planeacion didactica. */
@ApiTags('2. Planeacion didactica')
@ApiBearerAuth()
@Controller('planeaciones')
export class PlaneacionesController {
  constructor(private readonly servicio: PlaneacionesService) {}

  /**
   * El interceptor solo actua sobre peticiones multipart. Una peticion en
   * JSON sin adjunto sigue funcionando igual, de modo que la coleccion de
   * Postman y los clientes existentes no cambian.
   */
  @Roles(Rol.PROFESOR)
  @Post()
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ schema: CUERPO_CON_ADJUNTO })
  @ApiOperation({
    summary: 'Registra la planeacion de una materia y parcial, con adjunto opcional',
  })
  crear(
    @Body() dto: CrearPlaneacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.servicio.crear(dto, usuario, archivo);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista las planeaciones. El docente solo obtiene las propias',
  })
  listar(
    @Query() filtros: FiltrarPlaneacionesDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.listar(filtros, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta una planeacion por identificador' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.obtenerPorId(id, usuario);
  }

  @Roles(Rol.PROFESOR)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ schema: CUERPO_CORRECCION })
  @ApiOperation({
    summary: 'Modifica una planeacion no aprobada y permite sustituir el adjunto',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlaneacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.servicio.actualizar(id, dto, usuario, archivo);
  }

  @Roles(Rol.COORDINADOR)
  @Patch(':id/revision')
  @ApiOperation({
    summary: 'Aprueba la planeacion o solicita ajustes. Exclusivo de coordinacion',
  })
  revisar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisarPlaneacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.revisar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina una planeacion no aprobada' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.eliminar(id, usuario);
  }
}
