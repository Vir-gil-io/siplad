import { Module } from '@nestjs/common';
import { PlaneacionesController } from './planeaciones.controller';
import { PlaneacionesService } from './planeaciones.service';
import { PlaneacionesRepository } from './planeaciones.repository';

@Module({
  controllers: [PlaneacionesController],
  providers: [PlaneacionesService, PlaneacionesRepository],
  exports: [PlaneacionesService, PlaneacionesRepository],
})
export class PlaneacionesModule {}
