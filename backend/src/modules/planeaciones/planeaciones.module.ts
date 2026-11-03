import { Module } from '@nestjs/common';
import { PlaneacionesController } from './planeaciones.controller';
import { PlaneacionesService } from './planeaciones.service';
import { PlaneacionesRepository } from './planeaciones.repository';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [PlaneacionesController],
  providers: [PlaneacionesService, PlaneacionesRepository],
  exports: [PlaneacionesService, PlaneacionesRepository],
})
export class PlaneacionesModule {}
