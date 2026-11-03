import { Module } from '@nestjs/common';
import { AvancesController } from './avances.controller';
import { AvancesService } from './avances.service';
import { FestivosModule } from '../../integrations/festivos/festivos.module';

@Module({
  imports: [FestivosModule],
  controllers: [AvancesController],
  providers: [AvancesService],
  exports: [AvancesService],
})
export class AvancesModule {}
