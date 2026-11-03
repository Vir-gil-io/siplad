/**
 * SIPLAD — Siembra de datos iniciales
 *
 * Carga usuarios de ambos roles, catalogo de materias, un periodo academico
 * activo y registros de ejemplo suficientes para que los reportes muestren
 * indicadores reales en la demostracion.
 *
 * Ejecucion:  npm run prisma:seed
 */
import {
  PrismaClient,
  Rol,
  EstadoPlaneacion,
  EstadoAvance,
  EstadoEvidencia,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando siembra de datos...');

  const hash = await bcrypt.hash('Siplad2026*', 10);

  // --------------------------- Usuarios ------------------------------------
  const coordinador = await prisma.usuario.upsert({
    where: { email: 'coordinacion@utng.edu.mx' },
    update: {},
    create: {
      email: 'coordinacion@utng.edu.mx',
      nombre: 'Laura Beatriz Mendoza Rivas',
      password: hash,
      rol: Rol.COORDINADOR,
    },
  });

  const docentes = await Promise.all(
    [
      { email: 'jcorrea@utng.edu.mx', nombre: 'Jorge Alberto Correa Nunez' },
      { email: 'mvargas@utng.edu.mx', nombre: 'Maria Fernanda Vargas Leon' },
      { email: 'rsanchez@utng.edu.mx', nombre: 'Ricardo Sanchez Delgado' },
    ].map((d) =>
      prisma.usuario.upsert({
        where: { email: d.email },
        update: {},
        create: { ...d, password: hash, rol: Rol.PROFESOR },
      }),
    ),
  );

  console.log(`  Usuarios: ${docentes.length + 1}`);

  // --------------------------- Materias ------------------------------------
  const materias = await Promise.all(
    [
      { clave: 'MAT-101', nombre: 'Matematicas I' },
      { clave: 'FIS-102', nombre: 'Fisica General' },
      { clave: 'QUI-103', nombre: 'Quimica I' },
      { clave: 'HIS-104', nombre: 'Historia de Mexico' },
      { clave: 'INF-105', nombre: 'Informatica Basica' },
    ].map((m) =>
      prisma.materia.upsert({
        where: { clave: m.clave },
        update: {},
        create: m,
      }),
    ),
  );

  console.log(`  Materias: ${materias.length}`);

  // ----------------------- Periodos academicos -----------------------------
  const periodoActivo = await prisma.periodoAcademico.upsert({
    where: { nombre: 'Agosto - Diciembre 2026' },
    update: {},
    create: {
      nombre: 'Agosto - Diciembre 2026',
      anio: 2026,
      fechaInicio: new Date('2026-08-17'),
      fechaFin: new Date('2026-12-18'),
      activo: true,
    },
  });

  const periodoAnterior = await prisma.periodoAcademico.upsert({
    where: { nombre: 'Enero - Junio 2026' },
    update: {},
    create: {
      nombre: 'Enero - Junio 2026',
      anio: 2026,
      fechaInicio: new Date('2026-01-12'),
      fechaFin: new Date('2026-06-19'),
      activo: false,
    },
  });

  console.log('  Periodos academicos: 2');

  // --------------------------- Planeaciones --------------------------------
  // Se construye una matriz de planeaciones con estados variados para que los
  // indicadores del modulo de reportes no queden en cero.
  const combinaciones: Array<{
    docente: number;
    materia: number;
    parcial: number;
    estado: EstadoPlaneacion;
    avance?: { porcentaje: number; estado: EstadoAvance };
  }> = [
    {
      docente: 0,
      materia: 0,
      parcial: 1,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 100, estado: EstadoAvance.CUMPLIDO },
    },
    {
      docente: 0,
      materia: 0,
      parcial: 2,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 75, estado: EstadoAvance.PARCIAL },
    },
    { docente: 0, materia: 0, parcial: 3, estado: EstadoPlaneacion.ENVIADA },
    {
      docente: 0,
      materia: 1,
      parcial: 1,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 100, estado: EstadoAvance.CUMPLIDO },
    },
    {
      docente: 1,
      materia: 2,
      parcial: 1,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 90, estado: EstadoAvance.CUMPLIDO },
    },
    { docente: 1, materia: 2, parcial: 2, estado: EstadoPlaneacion.AJUSTES_SOLICITADOS },
    {
      docente: 1,
      materia: 3,
      parcial: 1,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 40, estado: EstadoAvance.NO_CUMPLIDO },
    },
    {
      docente: 2,
      materia: 4,
      parcial: 1,
      estado: EstadoPlaneacion.APROBADA,
      avance: { porcentaje: 85, estado: EstadoAvance.PARCIAL },
    },
    { docente: 2, materia: 4, parcial: 2, estado: EstadoPlaneacion.ENVIADA },
  ];

  let planeacionesCreadas = 0;
  let avancesCreados = 0;

  for (const c of combinaciones) {
    const planeacion = await prisma.planeacion.upsert({
      where: {
        planeacion_unica: {
          usuarioId: docentes[c.docente].id,
          materiaId: materias[c.materia].id,
          periodoId: periodoActivo.id,
          parcial: c.parcial,
        },
      },
      update: {},
      create: {
        parcial: c.parcial,
        contenido: `Planeacion didactica del parcial ${c.parcial} de ${materias[c.materia].nombre}. Incluye objetivos de aprendizaje, secuencia didactica, recursos e instrumentos de evaluacion.`,
        estado: c.estado,
        usuarioId: docentes[c.docente].id,
        materiaId: materias[c.materia].id,
        periodoId: periodoActivo.id,
        ...(c.estado !== EstadoPlaneacion.ENVIADA && {
          revisadoPorId: coordinador.id,
          revisadoEn: new Date(),
          comentarioRevision:
            c.estado === EstadoPlaneacion.AJUSTES_SOLICITADOS
              ? 'Falta precisar los instrumentos de evaluacion del segundo bloque.'
              : null,
        }),
      },
    });
    planeacionesCreadas++;

    if (c.avance) {
      await prisma.avance.upsert({
        where: { planeacionId: planeacion.id },
        update: {},
        create: {
          planeacionId: planeacion.id,
          porcentaje: c.avance.porcentaje,
          estado: c.avance.estado,
          observaciones:
            c.avance.estado === EstadoAvance.NO_CUMPLIDO
              ? 'Se perdieron sesiones por suspension oficial de labores.'
              : null,
        },
      });
      avancesCreados++;
    }
  }

  console.log(`  Planeaciones: ${planeacionesCreadas}`);
  console.log(`  Avances: ${avancesCreados}`);

  // Planeacion de ciclo anterior, para el historial.
  await prisma.planeacion.upsert({
    where: {
      planeacion_unica: {
        usuarioId: docentes[0].id,
        materiaId: materias[0].id,
        periodoId: periodoAnterior.id,
        parcial: 1,
      },
    },
    update: {},
    create: {
      parcial: 1,
      contenido:
        'Planeacion didactica del ciclo anterior, conservada como referencia historica.',
      estado: EstadoPlaneacion.APROBADA,
      usuarioId: docentes[0].id,
      materiaId: materias[0].id,
      periodoId: periodoAnterior.id,
      revisadoPorId: coordinador.id,
      revisadoEn: new Date('2026-02-10'),
    },
  });

  // --------------------------- Evidencias ----------------------------------
  const evidencias = [
    {
      docente: 0,
      nombreCurso: 'Evaluacion formativa en el aula',
      institucion: 'CONALEP',
      horas: 40,
      estado: EstadoEvidencia.VALIDADA,
    },
    {
      docente: 0,
      nombreCurso: 'Herramientas digitales para la docencia',
      institucion: 'UTNG',
      horas: 20,
      estado: EstadoEvidencia.VALIDADA,
    },
    {
      docente: 1,
      nombreCurso: 'Diseno de secuencias didacticas',
      institucion: 'SEG',
      horas: 30,
      estado: EstadoEvidencia.PENDIENTE,
    },
    {
      docente: 1,
      nombreCurso: 'Gestion del aula inclusiva',
      institucion: 'SEP',
      horas: 25,
      estado: EstadoEvidencia.VALIDADA,
    },
    {
      docente: 2,
      nombreCurso: 'Introduccion a la ciencia de datos',
      institucion: 'Coursera',
      horas: 15,
      estado: EstadoEvidencia.RECHAZADA,
    },
  ];

  for (const e of evidencias) {
    const existente = await prisma.evidencia.findFirst({
      where: { usuarioId: docentes[e.docente].id, nombreCurso: e.nombreCurso },
    });
    if (existente) continue;

    await prisma.evidencia.create({
      data: {
        nombreCurso: e.nombreCurso,
        institucion: e.institucion,
        fecha: new Date('2026-09-15'),
        horas: e.horas,
        archivoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
        estado: e.estado,
        usuarioId: docentes[e.docente].id,
        periodoId: periodoActivo.id,
        ...(e.estado !== EstadoEvidencia.PENDIENTE && {
          validadoPorId: coordinador.id,
          validadoEn: new Date(),
          motivoRechazo:
            e.estado === EstadoEvidencia.RECHAZADA
              ? 'La constancia no indica las horas acreditadas ni el sello de la institucion.'
              : null,
        }),
      },
    });
  }

  console.log(`  Evidencias: ${evidencias.length}`);

  console.log('\nSiembra completada.');
  console.log('----------------------------------------------------');
  console.log('Credenciales de acceso (contrasena: Siplad2026*)');
  console.log('  Coordinacion : coordinacion@utng.edu.mx');
  console.log('  Docente      : jcorrea@utng.edu.mx');
  console.log('  Docente      : mvargas@utng.edu.mx');
  console.log('  Docente      : rsanchez@utng.edu.mx');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Error durante la siembra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
