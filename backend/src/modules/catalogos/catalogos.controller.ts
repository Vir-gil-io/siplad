import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';

/** Catalogos de apoyo para la capa de presentacion. */
@ApiTags('6. Catalogos')
@ApiBearerAuth()
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly servicio: CatalogosService) {}

  @Get('materias')
  @ApiOperation({ summary: 'Lista las materias activas' })
  materias() {
    return this.servicio.listarMaterias();
  }

  @Get('periodos')
  @ApiOperation({ summary: 'Lista los periodos academicos' })
  periodos() {
    return this.servicio.listarPeriodos();
  }

  @Get('periodos/activo')
  @ApiOperation({ summary: 'Devuelve el periodo academico en curso' })
  periodoActivo() {
    return this.servicio.periodoActivo();
  }

  @Get('periodos/:id')
  @ApiOperation({
    summary: 'Detalle del periodo con sus dias habiles e inhabiles oficiales',
  })
  detallePeriodo(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.detallePeriodo(id);
  }
}
