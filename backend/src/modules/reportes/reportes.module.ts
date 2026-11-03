import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ExportacionService } from './exportacion.service';
import { FestivosModule } from '../../integrations/festivos/festivos.module';

@Module({
  imports: [FestivosModule],
  controllers: [ReportesController],
  providers: [ReportesService, ExportacionService],
  exports: [ReportesService],
})
export class ReportesModule {}
