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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

import { AvancesService } from './avances.service';
import { CrearAvanceDto } from './dto/crear-avance.dto';
import { ActualizarAvanceDto } from './dto/actualizar-avance.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UsuarioActual,
  UsuarioAutenticado,
} from '../../common/decorators/usuario-actual.decorator';

/** Web Service 3 de 5 — Control de avances por parcial. */
@ApiTags('3. Avances por parcial')
@ApiBearerAuth()
@Controller('avances')
export class AvancesController {
  constructor(private readonly servicio: AvancesService) {}

  @Roles(Rol.PROFESOR)
  @Post()
  @ApiOperation({
    summary: 'Registra el avance logrado respecto a una planeacion aprobada',
  })
  crear(@Body() dto: CrearAvanceDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.servicio.crear(dto, usuario);
  }

  @Get()
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Lista los avances registrados' })
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('periodoId') periodoId?: string,
  ) {
    return this.servicio.listar(usuario, periodoId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta un avance por identificador' })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.obtenerPorId(id, usuario);
  }

  @Roles(Rol.PROFESOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Modifica el avance registrado' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAvanceDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina el avance registrado' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.eliminar(id, usuario);
  }
}
