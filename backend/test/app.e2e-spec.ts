import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Pruebas funcionales automatizadas — arranque de la aplicacion y contrato de
 * seguridad de los Web Services.
 *
 * Se levanta la aplicacion completa con su grafo real de modulos, guards,
 * pipes y controladores. La capa de datos se sustituye por un doble de prueba
 * para que la suite no dependa de una base de datos en ejecucion.
 */
describe('SIPLAD API (funcional)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Doble de prueba de la capa de datos: evita la conexion real.
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        usuario: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
        materia: { findMany: jest.fn(() => Promise.resolve([])) },
        periodoAcademico: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
        },
        planeacion: { findMany: jest.fn(), findUnique: jest.fn() },
        avance: { findMany: jest.fn(), findUnique: jest.fn() },
        evidencia: { findMany: jest.fn(), findUnique: jest.fn() },
      })
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Arranque', () => {
    it('resuelve el grafo completo de dependencias', () => {
      // Si algun modulo declarara un proveedor sin registrar, beforeAll habria
      // fallado antes de llegar aqui.
      expect(app).toBeDefined();
    });

    it('responde en el endpoint publico de salud', async () => {
      const respuesta = await request(app.getHttpServer()).get('/api/salud').expect(200);

      expect(respuesta.body.servicio).toBe('SIPLAD API');
      expect(respuesta.body.estado).toBe('operativo');
    });
  });

  describe('Control de acceso de los Web Services', () => {
    const rutasProtegidas = [
      '/api/auth/perfil',
      '/api/planeaciones',
      '/api/avances',
      '/api/evidencias',
      '/api/reportes/indicadores',
      '/api/catalogos/materias',
    ];

    it.each(rutasProtegidas)('exige token en %s', async (ruta) => {
      await request(app.getHttpServer()).get(ruta).expect(401);
    });

    it.each(rutasProtegidas)('rechaza un token invalido en %s', async (ruta) => {
      await request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', 'Bearer token-falsificado')
        .expect(401);
    });
  });

  describe('Validacion de entrada', () => {
    it('rechaza un correo con formato invalido', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-es-un-correo', password: 'Siplad2026*' })
        .expect(400);

      expect(respuesta.body.message).toContain(
        'El correo electronico no tiene un formato valido.',
      );
    });

    it('rechaza una contrasena demasiado corta', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'docente@utng.edu.mx', password: 'corta' })
        .expect(400);

      expect(respuesta.body.message).toContain(
        'La contrasena debe tener al menos 8 caracteres.',
      );
    });

    it('rechaza propiedades no declaradas en el contrato', async () => {
      // OWASP A03 — Previene la asignacion masiva de atributos.
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'docente@utng.edu.mx',
          password: 'Siplad2026*',
          rol: 'COORDINADOR',
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body.message)).toContain('rol');
    });

    it('rechaza una peticion sin cuerpo', async () => {
      await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
    });
  });

  describe('Rutas inexistentes', () => {
    it('devuelve 404 sin revelar detalles internos', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/ruta-que-no-existe')
        .expect(404);

      expect(JSON.stringify(respuesta.body)).not.toContain('prisma');
      expect(JSON.stringify(respuesta.body)).not.toMatch(/at .*\.ts:/);
    });
  });
});
