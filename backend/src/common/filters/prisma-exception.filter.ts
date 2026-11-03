import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduce los errores del ORM a respuestas HTTP controladas.
 *
 * OWASP A09 — El detalle tecnico se registra en el servidor; al cliente solo
 * se le devuelve un mensaje interpretable, sin nombres de tabla, consultas ni
 * trazas de pila que revelen la estructura interna del sistema.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(excepcion: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();

    this.logger.error(`Error de persistencia ${excepcion.code}: ${excepcion.message}`);

    let estado = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensaje = 'Ocurrio un error al procesar la solicitud.';

    switch (excepcion.code) {
      case 'P2002':
        estado = HttpStatus.CONFLICT;
        mensaje = 'Ya existe un registro con esos datos.';
        break;
      case 'P2003':
        estado = HttpStatus.BAD_REQUEST;
        mensaje = 'La referencia indicada no corresponde a un registro valido.';
        break;
      case 'P2025':
        estado = HttpStatus.NOT_FOUND;
        mensaje = 'El registro solicitado no existe.';
        break;
    }

    respuesta.status(estado).json({
      statusCode: estado,
      message: mensaje,
      timestamp: new Date().toISOString(),
    });
  }
}
