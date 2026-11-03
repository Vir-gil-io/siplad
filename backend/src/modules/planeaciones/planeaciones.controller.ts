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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

/** Web Service 2 de 5 — Gestion de planeacion didactica. */
@ApiTags('2. Planeacion didactica')
@ApiBearerAuth()
@Controller('planeaciones')
export class PlaneacionesController {
  constructor(private readonly servicio: PlaneacionesService) {}

  @Roles(Rol.PROFESOR)
  @Post()
  @ApiOperation({ summary: 'Registra la planeacion de una materia y parcial' })
  crear(@Body() dto: CrearPlaneacionDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.servicio.crear(dto, usuario);
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
  @ApiOperation({ summary: 'Modifica una planeacion no aprobada' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlaneacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario);
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
