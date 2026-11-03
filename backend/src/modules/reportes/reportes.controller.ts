import { Controller, Get, Query, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Rol } from '@prisma/client';

import { ReportesService } from './reportes.service';
import { ExportacionService } from './exportacion.service';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Web Service 5 de 5 — Reportes y seguimiento institucional.
 *
 * Todas las rutas estan reservadas al rol COORDINADOR: los indicadores
 * agregados contienen informacion de todo el personal docente.
 */
@ApiTags('5. Reportes institucionales')
@ApiBearerAuth()
@Roles(Rol.COORDINADOR)
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly exportacion: ExportacionService,
  ) {}

  @Get('indicadores')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({
    summary: 'Indicadores globales de cumplimiento del periodo',
  })
  indicadores(@Query('periodoId') periodoId?: string) {
    return this.reportes.indicadoresGlobales(periodoId);
  }

  @Get('por-docente')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Cumplimiento desglosado por docente' })
  porDocente(@Query('periodoId') periodoId?: string) {
    return this.reportes.porDocente(periodoId);
  }

  @Get('por-parcial')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Cumplimiento de avances desglosado por parcial' })
  porParcial(@Query('periodoId') periodoId?: string) {
    return this.reportes.porParcial(periodoId);
  }

  @Get('por-materia')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Cumplimiento desglosado por materia' })
  porMateria(@Query('periodoId') periodoId?: string) {
    return this.reportes.porMateria(periodoId);
  }

  @Get('exportar/excel')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Descarga el reporte institucional en formato Excel' })
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportarExcel(
    @Res() respuesta: Response,
    @Query('periodoId') periodoId?: string,
  ) {
    const archivo = await this.exportacion.generarExcel(periodoId);
    const nombre = `siplad-reporte-${this.marcaDeTiempo()}.xlsx`;

    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    respuesta.setHeader('Content-Length', archivo.length);
    respuesta.end(archivo);
  }

  @Get('exportar/pdf')
  @ApiQuery({ name: 'periodoId', required: false })
  @ApiOperation({ summary: 'Descarga el reporte institucional en formato PDF' })
  @Header('Content-Type', 'application/pdf')
  async exportarPdf(@Res() respuesta: Response, @Query('periodoId') periodoId?: string) {
    const archivo = await this.exportacion.generarPdf(periodoId);
    const nombre = `siplad-reporte-${this.marcaDeTiempo()}.pdf`;

    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    respuesta.setHeader('Content-Length', archivo.length);
    respuesta.end(archivo);
  }

  private marcaDeTiempo(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
