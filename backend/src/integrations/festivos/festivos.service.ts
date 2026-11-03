import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface DiaFestivo {
  fecha: string;
  nombre: string;
  nombreLocal: string;
}

/**
 * Contrato del proveedor externo, declarado de forma explicita.
 *
 * Tipar la respuesta ajena es parte del patron Adapter: el limite entre el
 * servicio de terceros y el dominio queda documentado en el codigo y no se
 * manipulan estructuras sin tipo.
 */
interface RespuestaNagerDate {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
}

/**
 * Integracion 3 de 3 con servicios de terceros — Nager.Date.
 *
 * Capa de integracion. Obtiene los dias inhabiles oficiales del pais para
 * descontarlos del calculo de los periodos de cada parcial.
 *
 * Patron estructural aplicado: Adapter, con degradacion controlada. Si el
 * servicio externo no responde, el metodo devuelve una lista vacia y el
 * calculo continua sin dias inhabiles, en lugar de propagar el fallo a la
 * capa de logica de negocio.
 */
@Injectable()
export class FestivosService {
  private readonly logger = new Logger(FestivosService.name);
  private readonly cache = new Map<string, DiaFestivo[]>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async obtenerFestivos(anio: number, pais?: string): Promise<DiaFestivo[]> {
    const codigoPais = pais ?? this.config.get<string>('NAGER_DATE_PAIS') ?? 'MX';
    const clave = `${codigoPais}-${anio}`;

    if (this.cache.has(clave)) {
      return this.cache.get(clave);
    }

    const base =
      this.config.get<string>('NAGER_DATE_URL') ?? 'https://date.nager.at/api/v3';

    try {
      const respuesta = await firstValueFrom(
        this.http.get<RespuestaNagerDate[]>(
          `${base}/PublicHolidays/${anio}/${codigoPais}`,
          { timeout: 5000 },
        ),
      );

      // Traduccion del contrato externo al modelo del dominio.
      const festivos: DiaFestivo[] = (respuesta.data ?? []).map((d) => ({
        fecha: d.date,
        nombre: d.name,
        nombreLocal: d.localName,
      }));

      this.cache.set(clave, festivos);
      this.logger.log(`Dias inhabiles obtenidos para ${clave}: ${festivos.length}`);
      return festivos;
    } catch (error) {
      this.logger.warn(
        `El servicio de dias festivos no respondio (${(error as Error).message}). ` +
          'El calculo continua sin dias inhabiles.',
      );
      return [];
    }
  }

  /**
   * Cuenta los dias habiles entre dos fechas, excluyendo sabados, domingos y
   * los dias inhabiles oficiales. Se emplea para informar la carga real de
   * cada parcial.
   *
   * Todo el calculo se realiza en UTC de forma deliberada. Las fechas de los
   * periodos se persisten como medianoche UTC y el servicio externo entrega
   * los dias inhabiles en formato ISO, tambien UTC. Emplear la hora local
   * desplazaria el dia de la semana en los husos con desplazamiento negativo
   * y el resultado dependeria de la zona horaria del servidor.
   */
  async contarDiasHabiles(desde: Date, hasta: Date): Promise<number> {
    const festivos = await this.obtenerFestivos(desde.getUTCFullYear());
    const inhabiles = new Set(festivos.map((f) => f.fecha));

    let habiles = 0;
    const cursor = new Date(desde);

    while (cursor <= hasta) {
      const diaSemana = cursor.getUTCDay();
      const iso = cursor.toISOString().slice(0, 10);

      if (diaSemana !== 0 && diaSemana !== 6 && !inhabiles.has(iso)) {
        habiles++;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return habiles;
  }
}
