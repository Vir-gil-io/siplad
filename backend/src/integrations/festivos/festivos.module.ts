import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FestivosService } from './festivos.service';

@Module({
  imports: [HttpModule.register({ timeout: 5000, maxRedirects: 3 })],
  providers: [FestivosService],
  exports: [FestivosService],
})
export class FestivosModule {}
