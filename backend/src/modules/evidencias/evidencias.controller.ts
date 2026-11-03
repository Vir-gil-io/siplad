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
  ApiQuery,
} from '@nestjs/swagger';
import { EstadoEvidencia, Rol } from '@prisma/client';

import { EvidenciasService } from './evidencias.service';
import { CrearEvidenciaDto } from './dto/crear-evidencia.dto';
import { ValidarEvidenciaDto } from './dto/validar-evidencia.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UsuarioActual,
  UsuarioAutenticado,
} from '../../common/decorators/usuario-actual.decorator';

/** Web Service 4 de 5 — Evidencias de capacitacion. */
@ApiTags('4. Evidencias de capacitacion')
@ApiBearerAuth()
@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly servicio: EvidenciasService) {}

  @Roles(Rol.PROFESOR)
  @Post()
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombreCurso', 'institucion', 'fecha', 'horas', 'periodoId', 'archivo'],
      properties: {
        nombreCurso: { type: 'string' },
        institucion: { type: 'string' },
        fecha: { type: 'string', format: 'date' },
        horas: { type: 'integer' },
        periodoId: { type: 'string', format: 'uuid' },
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Carga una constancia de capacitacion' })
  crear(
    @Body() dto: CrearEvidenciaDto,
    @UploadedFile() archivo: Express.Multer.File,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, archivo, usuario);
  }

  @Get()
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoEvidencia })
  @ApiOperation({ summary: 'Lista las evidencias de capacitacion' })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('periodoId') periodoId?: string,
    @Query('estado') estado?: EstadoEvidencia,
  ) {
    return this.servicio.listar(usuario, { periodoId, estado });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta una evidencia por identificador' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.obtenerPorId(id, usuario);
  }

  @Roles(Rol.COORDINADOR)
  @Patch(':id/validacion')
  @ApiOperation({
    summary: 'Valida o rechaza una evidencia. Exclusivo de coordinacion',
  })
  validar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidarEvidenciaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.validar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina una evidencia no validada' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.eliminar(id, usuario);
  }
}
