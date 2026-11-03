/**
 * Modulo raiz de la aplicacion.
 *
 * Patron emergente aplicado: modularidad por dominio. Cada modulo declara de
 * forma explicita lo que consume y lo que expone, lo que permite extraer
 * cualquiera de ellos como servicio independiente sin reescribir el resto.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlaneacionesModule } from './modules/planeaciones/planeaciones.module';
import { AvancesModule } from './modules/avances/avances.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Patron creacional: configuracion externalizada e inyectada por entorno.
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    PrismaModule,
    AuthModule,
    PlaneacionesModule,
    AvancesModule,
    EvidenciasModule,
    ReportesModule,
    CatalogosModule,
  ],
  controllers: [AppController],
  providers: [
    // OWASP A01 — Cadena de responsabilidad: toda ruta esta protegida por
    // omision. El acceso publico debe declararse de forma explicita con el
    // decorador @Publico().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
