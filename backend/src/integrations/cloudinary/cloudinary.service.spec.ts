import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

import { CloudinaryService } from './cloudinary.service';

/**
 * Pruebas unitarias de la capa de integracion — almacenamiento de archivos.
 *
 * Verifican la validacion previa al envio (OWASP A04) y la degradacion a
 * disco local cuando el proveedor externo no esta configurado.
 */
describe('CloudinaryService', () => {
  const construirArchivo = (
    sobrescribir: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      originalname: 'constancia.pdf',
      mimetype: 'application/pdf',
      size: 100_000,
      buffer: Buffer.from('contenido de la constancia'),
      ...sobrescribir,
    }) as Express.Multer.File;

  const crearServicio = async (
    configuracion: Record<string, string> = {},
  ): Promise<CloudinaryService> => {
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((clave: string) => configuracion[clave]) },
        },
      ],
    }).compile();

    return modulo.get<CloudinaryService>(CloudinaryService);
  };

  describe('validar', () => {
    let servicio: CloudinaryService;

    beforeEach(async () => {
      servicio = await crearServicio();
    });

    it('acepta un PDF dentro del tamano permitido', () => {
      expect(() => servicio.validar(construirArchivo())).not.toThrow();
    });

    it('acepta imagenes JPG y PNG', () => {
      expect(() =>
        servicio.validar(construirArchivo({ mimetype: 'image/jpeg' })),
      ).not.toThrow();
      expect(() =>
        servicio.validar(construirArchivo({ mimetype: 'image/png' })),
      ).not.toThrow();
    });

    it('rechaza un tipo de archivo no permitido', () => {
      expect(() =>
        servicio.validar(construirArchivo({ mimetype: 'application/x-msdownload' })),
      ).toThrow(BadRequestException);
    });

    it('rechaza un archivo que excede los 5 MB', () => {
      expect(() => servicio.validar(construirArchivo({ size: 6 * 1024 * 1024 }))).toThrow(
        'El archivo excede el tamano maximo permitido de 5 MB.',
      );
    });

    it('rechaza la ausencia de archivo', () => {
      expect(() => servicio.validar(undefined)).toThrow(
        'Debe adjuntar el archivo de la constancia.',
      );
    });
  });

  describe('subir', () => {
    it('guarda en disco local cuando el proveedor externo no esta configurado', async () => {
      const servicio = await crearServicio();

      const resultado = await servicio.subir(construirArchivo());

      expect(resultado.proveedor).toBe('local');
      expect(resultado.url).toMatch(/^\/uploads\//);
    });

    it('no usa el nombre original del archivo como ruta', async () => {
      const servicio = await crearServicio();

      // Prevencion de recorrido de directorios: el nombre se descarta y se
      // sustituye por un identificador generado.
      const resultado = await servicio.subir(
        construirArchivo({ originalname: '../../etc/passwd.pdf' }),
      );

      expect(resultado.url).not.toContain('..');
      expect(resultado.url).not.toContain('passwd');
      expect(resultado.url).toMatch(/\.pdf$/);
    });

    it('valida antes de intentar cualquier escritura', async () => {
      const servicio = await crearServicio();

      await expect(
        servicio.subir(construirArchivo({ mimetype: 'text/html' })),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
