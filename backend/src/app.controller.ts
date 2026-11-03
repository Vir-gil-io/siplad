import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Publico } from './common/decorators/publico.decorator';

@ApiTags('Estado del servicio')
@Controller()
export class AppController {
  @Publico()
  @Get('salud')
  @ApiOperation({ summary: 'Verifica que la API esta operativa' })
  salud() {
    return {
      servicio: 'SIPLAD API',
      estado: 'operativo',
      version: '1.0.0',
      instancia: process.env.HOSTNAME ?? 'local',
      fecha: new Date().toISOString(),
    };
  }
}
