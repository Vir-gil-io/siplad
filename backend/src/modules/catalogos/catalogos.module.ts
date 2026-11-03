import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { FestivosModule } from '../../integrations/festivos/festivos.module';

@Module({
  imports: [FestivosModule],
  controllers: [CatalogosController],
  providers: [CatalogosService],
})
export class CatalogosModule {}
