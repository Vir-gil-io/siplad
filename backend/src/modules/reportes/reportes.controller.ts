import { Controller, Get, Query, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { Rol } from '@prisma/client';

import { ReportesService } from './reportes.service';
import { ExportacionService } from './exportacion.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { FiltrarReporteDto } from './dto/filtrar-reporte.dto';

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
  @ApiOperation({
    summary: 'Indicadores globales de cumplimiento del periodo',
  })
  indicadores(@Query() filtro: FiltrarReporteDto) {
    return this.reportes.indicadoresGlobales(filtro);
  }

  @Get('por-docente')
  @ApiOperation({ summary: 'Cumplimiento desglosado por docente' })
  porDocente(@Query() filtro: FiltrarReporteDto) {
    return this.reportes.porDocente(filtro);
  }

  @Get('por-parcial')
  @ApiOperation({ summary: 'Cumplimiento de avances desglosado por parcial' })
  porParcial(@Query() filtro: FiltrarReporteDto) {
    return this.reportes.porParcial(filtro);
  }

  @Get('por-materia')
  @ApiOperation({ summary: 'Cumplimiento desglosado por materia' })
  porMateria(@Query() filtro: FiltrarReporteDto) {
    return this.reportes.porMateria(filtro);
  }

  @Get('exportar/excel')
  @ApiOperation({
    summary: 'Descarga el reporte institucional en formato Excel',
    description:
      'Admite acotar por periodo, por parcial y por docente. Sin filtros, abarca el periodo activo completo.',
  })
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportarExcel(@Res() respuesta: Response, @Query() filtro: FiltrarReporteDto) {
    const archivo = await this.exportacion.generarExcel(filtro);
    const nombre = `siplad-reporte${this.sufijo(filtro)}-${this.marcaDeTiempo()}.xlsx`;

    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    respuesta.setHeader('Content-Length', archivo.length);
    respuesta.end(archivo);
  }

  @Get('exportar/pdf')
  @ApiOperation({
    summary: 'Descarga el reporte institucional en formato PDF',
    description:
      'Admite acotar por periodo, por parcial y por docente. Sin filtros, abarca el periodo activo completo.',
  })
  @Header('Content-Type', 'application/pdf')
  async exportarPdf(@Res() respuesta: Response, @Query() filtro: FiltrarReporteDto) {
    const archivo = await this.exportacion.generarPdf(filtro);
    const nombre = `siplad-reporte${this.sufijo(filtro)}-${this.marcaDeTiempo()}.pdf`;

    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    respuesta.setHeader('Content-Length', archivo.length);
    respuesta.end(archivo);
  }

  private marcaDeTiempo(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Sufijo del nombre del archivo.
   *
   * Un reporte acotado y uno completo se descargarian con el mismo nombre y
   * acabarian confundidos en la carpeta de descargas. El sufijo deja constancia
   * de la acotacion sin obligar a abrirlo.
   */
  private sufijo(filtro: FiltrarReporteDto): string {
    const partes: string[] = [];
    if (filtro.parcial) partes.push(`parcial${filtro.parcial}`);
    if (filtro.docenteId) partes.push('docente');
    return partes.length ? `-${partes.join('-')}` : '';
  }
}
