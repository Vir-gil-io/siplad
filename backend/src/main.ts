/**
 * SIPLAD — Punto de entrada de la aplicacion.
 *
 * Configura los controles transversales de seguridad que operan en el borde de
 * la capa de logica de negocio: cabeceras HTTP endurecidas, politica de origen
 * cruzado y validacion estricta de toda entrada.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('SIPLAD');

  // OWASP A05 — Configuracion de seguridad por defecto en las cabeceras HTTP.
  app.use(helmet());

  // Prefijo unico para todos los Web Services de autoria propia.
  app.setGlobalPrefix('api');

  // OWASP A01 — Solo los origenes declarados pueden consumir la API.
  const origenes = (process.env.CORS_ORIGENES ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origenes,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // OWASP A03 — Toda entrada se valida y se despoja de propiedades no
  // declaradas antes de alcanzar la capa de logica de negocio.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Traduce los errores del ORM a respuestas HTTP sin filtrar detalles internos.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Respaldo de almacenamiento: cuando el proveedor externo no esta
  // configurado, las constancias se guardan en disco y se sirven desde aqui.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Documentacion del contrato de los Web Services.
  const config = new DocumentBuilder()
    .setTitle('SIPLAD — API REST')
    .setDescription(
      'Sistema Institucional de Planeacion y Avance Docente. ' +
        'Web Services de autoria propia: autenticacion, planeaciones, avances, evidencias y reportes.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto, '0.0.0.0');

  logger.log(`API escuchando en el puerto ${puerto}`);
  logger.log(`Documentacion disponible en /api/docs`);
}

void bootstrap();
