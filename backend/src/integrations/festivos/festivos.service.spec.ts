import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

import { FestivosService } from './festivos.service';

/**
 * Pruebas unitarias de la capa de integracion — servicio de dias festivos.
 *
 * Ninguna prueba realiza peticiones de red: el cliente HTTP se sustituye por
 * un doble de prueba.
 */
describe('FestivosService', () => {
  let servicio: FestivosService;
  let http: { get: jest.Mock };

  const respuestaExterna = {
    data: [
      {
        date: '2026-09-16',
        name: 'Independence Day',
        localName: 'Dia de la Independencia',
      },
      { date: '2026-11-16', name: 'Revolution Day', localName: 'Dia de la Revolucion' },
      { date: '2026-12-25', name: 'Christmas Day', localName: 'Navidad' },
    ],
  };

  beforeEach(async () => {
    http = { get: jest.fn(() => of(respuestaExterna)) };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        FestivosService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((clave: string) =>
              clave === 'NAGER_DATE_PAIS' ? 'MX' : 'https://date.nager.at/api/v3',
            ),
          },
        },
      ],
    }).compile();

    servicio = modulo.get<FestivosService>(FestivosService);
  });

  describe('obtenerFestivos', () => {
    it('traduce la respuesta del proveedor al modelo del dominio', async () => {
      const festivos = await servicio.obtenerFestivos(2026);

      expect(festivos).toHaveLength(3);
      expect(festivos[0]).toEqual({
        fecha: '2026-09-16',
        nombre: 'Independence Day',
        nombreLocal: 'Dia de la Independencia',
      });
    });

    it('consulta el servicio externo con el anio y el pais indicados', async () => {
      await servicio.obtenerFestivos(2026, 'ES');

      expect(http.get).toHaveBeenCalledWith(
        'https://date.nager.at/api/v3/PublicHolidays/2026/ES',
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('reutiliza el resultado en memoria y no repite la peticion', async () => {
      await servicio.obtenerFestivos(2026);
      await servicio.obtenerFestivos(2026);

      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('devuelve una lista vacia cuando el proveedor no responde', async () => {
      // Degradacion controlada: el fallo de la integracion no se propaga a la
      // capa de logica de negocio.
      http.get.mockReturnValue(throwError(() => new Error('Tiempo de espera agotado')));

      const festivos = await servicio.obtenerFestivos(2026);

      expect(festivos).toEqual([]);
    });

    it('tolera una respuesta sin cuerpo', async () => {
      http.get.mockReturnValue(of({ data: null }));

      const festivos = await servicio.obtenerFestivos(2026);

      expect(festivos).toEqual([]);
    });
  });

  describe('contarDiasHabiles', () => {
    it('excluye sabados y domingos', async () => {
      http.get.mockReturnValue(of({ data: [] }));

      // Del lunes 2 al domingo 8 de noviembre de 2026: cinco dias habiles.
      const habiles = await servicio.contarDiasHabiles(
        new Date('2026-11-02T00:00:00Z'),
        new Date('2026-11-08T00:00:00Z'),
      );

      expect(habiles).toBe(5);
    });

    it('excluye los dias inhabiles oficiales que caen en dia de semana', async () => {
      http.get.mockReturnValue(
        of({
          data: [
            { date: '2026-11-04', name: 'Dia de prueba', localName: 'Dia de prueba' },
          ],
        }),
      );

      const habiles = await servicio.contarDiasHabiles(
        new Date('2026-11-02T00:00:00Z'),
        new Date('2026-11-08T00:00:00Z'),
      );

      expect(habiles).toBe(4);
    });

    it('devuelve cero cuando el rango no contiene dias habiles', async () => {
      http.get.mockReturnValue(of({ data: [] }));

      // Sabado 7 y domingo 8 de noviembre de 2026.
      const habiles = await servicio.contarDiasHabiles(
        new Date('2026-11-07T00:00:00Z'),
        new Date('2026-11-08T00:00:00Z'),
      );

      expect(habiles).toBe(0);
    });

    it('arroja el mismo resultado sea cual sea la zona horaria del servidor', async () => {
      http.get.mockReturnValue(of({ data: [] }));

      const zonaOriginal = process.env.TZ;
      const medir = async () =>
        servicio.contarDiasHabiles(
          new Date('2026-11-02T00:00:00Z'),
          new Date('2026-11-08T00:00:00Z'),
        );

      process.env.TZ = 'UTC';
      const enUtc = await medir();

      process.env.TZ = 'America/Mexico_City';
      const enMexico = await medir();

      process.env.TZ = 'Asia/Tokyo';
      const enTokio = await medir();

      process.env.TZ = zonaOriginal;

      expect(enUtc).toBe(5);
      expect(enMexico).toBe(5);
      expect(enTokio).toBe(5);
    });
  });
});
