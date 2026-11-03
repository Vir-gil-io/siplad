import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ArchivoSubido {
  url: string;
  proveedor: 'cloudinary' | 'local';
  identificador: string;
}

/**
 * Integracion 2 de 3 con servicios de terceros — Cloudinary.
 *
 * Capa de integracion. Patron estructural aplicado: Adapter. La capa de logica
 * de negocio solicita "almacenar un archivo" y recibe una referencia
 * normalizada; desconoce por completo la estructura de respuesta del
 * proveedor. Sustituirlo afecta unicamente a esta clase.
 *
 * Si las credenciales no estan configuradas, el servicio degrada a
 * almacenamiento en disco local para que la aplicacion siga operando.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly habilitado: boolean;
  private readonly directorioLocal = join(process.cwd(), 'uploads');

  /**
   * OWASP A04 — Listas blancas de tipos y limite de tamano.
   *
   * Cada modulo declara que admite: una constancia de capacitacion es un
   * documento escaneado, mientras que una planeacion didactica suele venir
   * como documento de texto. Ampliar una lista no debe ampliar la otra.
   */
  static readonly TIPOS_CONSTANCIA = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  static readonly TIPOS_PLANEACION = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  private static readonly TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

  constructor(private readonly config: ConfigService) {
    const nombre = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const clave = this.config.get<string>('CLOUDINARY_API_KEY');
    const secreto = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.habilitado = Boolean(nombre && clave && secreto);

    if (this.habilitado) {
      cloudinary.config({
        cloud_name: nombre,
        api_key: clave,
        api_secret: secreto,
        secure: true,
      });
      this.logger.log('Almacenamiento externo configurado.');
    } else {
      this.logger.warn(
        'Credenciales de almacenamiento externo ausentes; se usara el disco local.',
      );
    }
  }

  /**
   * OWASP A04 — La validacion ocurre antes de enviar el archivo a cualquier
   * destino, no despues.
   *
   * La lista se recibe como argumento en lugar de leerse de una constante
   * unica, para que cada modulo imponga la suya. El valor por omision es el de
   * las constancias porque fue el primer modulo en usar esta capa; quien
   * necesite otra lista la declara al llamar.
   */
  validar(
    archivo: Express.Multer.File | undefined,
    tiposPermitidos: readonly string[] = CloudinaryService.TIPOS_CONSTANCIA,
  ): void {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar el archivo.');
    }

    if (!tiposPermitidos.includes(archivo.mimetype)) {
      throw new BadRequestException(
        `Solo se admiten archivos ${CloudinaryService.describir(tiposPermitidos)}.`,
      );
    }

    if (archivo.size > CloudinaryService.TAMANO_MAXIMO) {
      throw new BadRequestException(
        'El archivo excede el tamano maximo permitido de 5 MB.',
      );
    }
  }

  async subir(
    archivo: Express.Multer.File,
    carpeta = 'siplad/evidencias',
    tiposPermitidos: readonly string[] = CloudinaryService.TIPOS_CONSTANCIA,
  ): Promise<ArchivoSubido> {
    this.validar(archivo, tiposPermitidos);

    if (!this.habilitado) {
      return this.guardarEnDiscoLocal(archivo);
    }

    try {
      const resultado = await this.enviarAProveedor(archivo, carpeta);
      return {
        url: resultado.secure_url,
        proveedor: 'cloudinary',
        identificador: resultado.public_id,
      };
    } catch (error) {
      // Si el proveedor externo falla, la carga no se pierde: se conserva en
      // disco y la operacion de negocio concluye correctamente.
      this.logger.error(
        `El proveedor externo rechazo la carga: ${(error as Error).message}`,
      );
      return this.guardarEnDiscoLocal(archivo);
    }
  }

  /**
   * El modo de acceso y el tipo de entrega se declaran de forma explicita en
   * lugar de confiar en el valor por omision de la cuenta: si el entorno
   * estuviera configurado para subir como restringido o autenticado, la
   * direccion devuelta respondria 401 al abrirse desde el navegador.
   *
   * Nota sobre los PDF: Cloudinary los clasifica como recurso de tipo imagen
   * y bloquea su entrega por omision en cuentas nuevas. Eso se habilita una
   * sola vez en la consola —Settings, Security, "PDF and ZIP files delivery"—
   * y no hay forma de activarlo desde el codigo. Los DOC y DOCX viajan como
   * recurso 'raw' y no estan sujetos a esa restriccion.
   */
  private enviarAProveedor(
    archivo: Express.Multer.File,
    carpeta: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolver, rechazar) => {
      const flujo = cloudinary.uploader.upload_stream(
        {
          folder: carpeta,
          resource_type: 'auto',
          type: 'upload',
          access_mode: 'public',
        },
        (error, resultado) => {
          if (error || !resultado) {
            // El proveedor devuelve su propio objeto de error; se normaliza a
            // Error para que la traza sea util y el tipo, predecible.
            rechazar(
              new Error(
                error?.message ?? 'Respuesta vacia del proveedor de almacenamiento.',
              ),
            );
            return;
          }
          resolver(resultado);
        },
      );
      flujo.end(archivo.buffer);
    });
  }

  private async guardarEnDiscoLocal(
    archivo: Express.Multer.File,
  ): Promise<ArchivoSubido> {
    await fs.mkdir(this.directorioLocal, { recursive: true });

    // El nombre original del archivo nunca se usa como ruta, para evitar el
    // recorrido de directorios.
    const extension = this.extensionSegura(archivo.mimetype);
    const nombre = `${randomUUID()}${extension}`;

    await fs.writeFile(join(this.directorioLocal, nombre), archivo.buffer);

    return {
      url: `/uploads/${nombre}`,
      proveedor: 'local',
      identificador: nombre,
    };
  }

  private extensionSegura(tipo: string): string {
    const mapa: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return mapa[tipo] ?? '.bin';
  }

  /** Traduce los tipos MIME a algo que el usuario reconozca en el mensaje. */
  private static describir(tipos: readonly string[]): string {
    const nombres: Record<string, string> = {
      'application/pdf': 'PDF',
      'image/jpeg': 'JPG',
      'image/jpg': 'JPG',
      'image/png': 'PNG',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    };
    return [...new Set(tipos.map((t) => nombres[t] ?? t))].join(', ');
  }
}
