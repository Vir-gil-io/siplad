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

  /** OWASP A04 — Lista blanca de tipos y limite de tamano. */
  private static readonly TIPOS_PERMITIDOS = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
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
   */
  validar(archivo: Express.Multer.File): void {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar el archivo de la constancia.');
    }

    if (!CloudinaryService.TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException('Solo se admiten archivos PDF, JPG o PNG.');
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
  ): Promise<ArchivoSubido> {
    this.validar(archivo);

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

  private enviarAProveedor(
    archivo: Express.Multer.File,
    carpeta: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolver, rechazar) => {
      const flujo = cloudinary.uploader.upload_stream(
        { folder: carpeta, resource_type: 'auto' },
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
    };
    return mapa[tipo] ?? '.bin';
  }
}
