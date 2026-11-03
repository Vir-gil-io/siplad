import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Capa de datos — cliente unico de persistencia.
 *
 * Patron creacional aplicado: Singleton gestionado por el contenedor de
 * inyeccion de dependencias. Una sola instancia atiende a todos los
 * repositorios de la aplicacion.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
