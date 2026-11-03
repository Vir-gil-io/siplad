/**
 * Servidor simulado de la API, solo para la prueba de humo del frontend.
 *
 * Responde con la forma exacta de los DTO del backend, de modo que la prueba
 * verifica que la interfaz consume el contrato real y no una versión
 * aproximada. No forma parte de la aplicación entregada.
 */
import { createServer } from 'node:http';

const PUERTO = 3000;
const TOKEN = 'token-de-prueba';

const materias = [
  { id: 'm1', clave: 'MAT-101', nombre: 'Matematicas I', activa: true },
  { id: 'm2', clave: 'FIS-102', nombre: 'Fisica General', activa: true },
];

const periodo = {
  id: 'p1',
  nombre: 'Agosto - Diciembre 2026',
  anio: 2026,
  fechaInicio: '2026-08-17T00:00:00.000Z',
  fechaFin: '2026-12-18T00:00:00.000Z',
  activo: true,
};

const docente = { id: 'd1', nombre: 'Jorge Alberto Correa Nunez', email: 'jcorrea@utng.edu.mx' };
const coordinador = {
  id: 'c1',
  nombre: 'Laura Beatriz Mendoza Rivas',
  email: 'coordinacion@utng.edu.mx',
  rol: 'COORDINADOR',
};

const planeacion = (id, estado, parcial, avance) => ({
  id,
  parcial,
  contenido:
    'Objetivos de aprendizaje, secuencia didactica, recursos e instrumentos de evaluacion del parcial.',
  // 'pl3' llega con documento adjunto: es la que coordinacion tiene pendiente
  // de dictaminar, asi que la prueba comprueba el enlace en los dos lados.
  archivoUrl: id === 'pl3' ? 'https://ejemplo.test/planeacion-pl3.pdf' : null,
  estado,
  comentarioRevision:
    estado === 'AJUSTES_SOLICITADOS'
      ? 'Falta precisar los instrumentos de evaluacion del segundo bloque.'
      : null,
  revisadoEn: estado === 'ENVIADA' ? null : '2026-10-01T12:00:00.000Z',
  creadaEn: '2026-09-01T12:00:00.000Z',
  usuarioId: docente.id,
  materiaId: materias[0].id,
  periodoId: periodo.id,
  materia: materias[0],
  periodo: {
    id: periodo.id,
    nombre: periodo.nombre,
    anio: periodo.anio,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
  },
  usuario: docente,
  revisadoPor: estado === 'ENVIADA' ? null : { id: coordinador.id, nombre: coordinador.nombre },
  avance: avance ?? null,
});

const avanceDeEjemplo = {
  id: 'av1',
  porcentaje: 92,
  estado: 'CUMPLIDO',
  fechaInicio: '2026-08-17T00:00:00.000Z',
  fechaFin: '2026-09-26T23:59:59.999Z',
  diasHabiles: 27,
  observaciones: null,
  registradoEn: '2026-10-05T12:00:00.000Z',
  planeacionId: 'pl1',
};

const RUTAS = {
  'POST /api/auth/login': (cuerpo) => {
    const esCoordinador = cuerpo.email === coordinador.email;
    return {
      estado: 200,
      datos: {
        accessToken: TOKEN,
        usuario: esCoordinador
          ? coordinador
          : { ...docente, rol: 'PROFESOR' },
      },
    };
  },

  'GET /api/auth/perfil': (_c, autorizacion) => {
    if (autorizacion !== `Bearer ${TOKEN}`) {
      return { estado: 401, datos: { statusCode: 401, message: 'No autorizado' } };
    }
    return { estado: 200, datos: perfilActual };
  },

  'GET /api/catalogos/materias': () => ({ estado: 200, datos: materias }),
  'GET /api/catalogos/periodos/activo': () => ({ estado: 200, datos: periodo }),
  'GET /api/catalogos/periodos': () => ({ estado: 200, datos: [periodo] }),

  'GET /api/avances': () => ({
    estado: 200,
    datos: [
      {
        ...avanceDeEjemplo,
        planeacion: planeacion('pl1', 'APROBADA', 1, null),
      },
      {
        ...avanceDeEjemplo,
        id: 'av2',
        porcentaje: 55,
        estado: 'NO_CUMPLIDO',
        fechaInicio: '2026-09-28T00:00:00.000Z',
        fechaFin: '2026-10-23T23:59:59.999Z',
        diasHabiles: 18,
        observaciones: 'Se perdieron sesiones por suspension oficial de labores.',
        planeacionId: 'pl2',
        planeacion: planeacion('pl2', 'APROBADA', 2, null),
      },
    ],
  }),

  'GET /api/planeaciones': (_c, _a, consulta) => {
    const todas = [
      planeacion('pl1', 'APROBADA', 1, avanceDeEjemplo),
      planeacion('pl2', 'APROBADA', 2, null),
      planeacion('pl3', 'ENVIADA', 3, null),
      planeacion('pl4', 'AJUSTES_SOLICITADOS', 1, null),
    ];
    const estado = consulta.get('estado');
    return { estado: 200, datos: estado ? todas.filter((p) => p.estado === estado) : todas };
  },

  'GET /api/evidencias': (_c, _a, consulta) => {
    const todas = [
      {
        id: 'ev1',
        nombreCurso: 'Evaluacion formativa en el aula',
        institucion: 'Secretaria de Educacion de Guanajuato',
        fecha: '2026-09-15T00:00:00.000Z',
        horas: 40,
        archivoUrl: 'https://ejemplo.test/constancia.pdf',
        estado: 'VALIDADA',
        motivoRechazo: null,
        validadoEn: '2026-09-20T12:00:00.000Z',
        creadaEn: '2026-09-16T12:00:00.000Z',
        usuarioId: docente.id,
        usuario: docente,
        periodo: {
    id: periodo.id,
    nombre: periodo.nombre,
    anio: periodo.anio,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
  },
        validadoPor: { id: coordinador.id, nombre: coordinador.nombre },
      },
      {
        id: 'ev2',
        nombreCurso: 'Herramientas digitales para la docencia',
        institucion: 'UTNG',
        fecha: '2026-10-02T00:00:00.000Z',
        horas: 20,
        archivoUrl: 'https://ejemplo.test/constancia2.pdf',
        estado: 'PENDIENTE',
        motivoRechazo: null,
        validadoEn: null,
        creadaEn: '2026-10-03T12:00:00.000Z',
        usuarioId: docente.id,
        usuario: docente,
        periodo: {
    id: periodo.id,
    nombre: periodo.nombre,
    anio: periodo.anio,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
  },
        validadoPor: null,
      },
    ];
    const estado = consulta.get('estado');
    return { estado: 200, datos: estado ? todas.filter((e) => e.estado === estado) : todas };
  },

  'GET /api/reportes/indicadores': () => ({
    estado: 200,
    datos: {
      periodo: {
    id: periodo.id,
    nombre: periodo.nombre,
    anio: periodo.anio,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
  },
      planeaciones: {
        total: 9,
        aprobadas: 6,
        enviadas: 2,
        ajustesSolicitados: 1,
        porcentajeCumplimiento: 66.7,
      },
      avances: {
        total: 6,
        cumplidos: 3,
        parciales: 2,
        noCumplidos: 1,
        porcentajePromedio: 81.7,
      },
      capacitacion: {
        evidenciasValidadas: 3,
        evidenciasPendientes: 1,
        evidenciasRechazadas: 1,
        horasAcreditadas: 85,
        docentesConCapacitacion: 2,
      },
      diasHabilesDelPeriodo: 88,
    },
  }),

  'GET /api/reportes/por-docente': () => ({
    estado: 200,
    datos: [
      {
        docenteId: 'd1',
        docente: 'Jorge Alberto Correa Nunez',
        email: 'jcorrea@utng.edu.mx',
        planeacionesRegistradas: 4,
        planeacionesAprobadas: 3,
        porcentajeCumplimientoPlaneacion: 75,
        avancesRegistrados: 3,
        promedioAvance: 91.7,
        horasAcreditadas: 60,
      },
      {
        docenteId: 'd2',
        docente: 'Maria Fernanda Vargas Leon',
        email: 'mvargas@utng.edu.mx',
        planeacionesRegistradas: 3,
        planeacionesAprobadas: 2,
        porcentajeCumplimientoPlaneacion: 66.7,
        avancesRegistrados: 2,
        promedioAvance: 65,
        horasAcreditadas: 25,
      },
    ],
  }),

  'GET /api/reportes/por-parcial': () => ({
    estado: 200,
    datos: [
      { parcial: 1, planeaciones: 4, aprobadas: 4, avancesRegistrados: 4, cumplidos: 3, parciales: 1, noCumplidos: 0, promedioAvance: 93.8 },
      { parcial: 2, planeaciones: 3, aprobadas: 2, avancesRegistrados: 2, cumplidos: 0, parciales: 1, noCumplidos: 1, promedioAvance: 57.5 },
      { parcial: 3, planeaciones: 2, aprobadas: 0, avancesRegistrados: 0, cumplidos: 0, parciales: 0, noCumplidos: 0, promedioAvance: 0 },
    ],
  }),
};

let perfilActual = { ...docente, rol: 'PROFESOR' };

const servidor = createServer((peticion, respuesta) => {
  const url = new URL(peticion.url, `http://localhost:${PUERTO}`);
  const clave = `${peticion.method} ${url.pathname}`;

  let cuerpo = '';
  peticion.on('data', (trozo) => (cuerpo += trozo));
  peticion.on('end', () => {
    const datosEntrada = cuerpo ? JSON.parse(cuerpo) : {};

    // El perfil que devuelve /auth/perfil depende de quien inicio sesion.
    if (clave === 'POST /api/auth/login') {
      perfilActual =
        datosEntrada.email === coordinador.email
          ? coordinador
          : { ...docente, rol: 'PROFESOR' };
    }

    const manejador = RUTAS[clave];

    respuesta.setHeader('Access-Control-Allow-Origin', '*');
    respuesta.setHeader('Access-Control-Allow-Headers', '*');
    respuesta.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    respuesta.setHeader('Content-Type', 'application/json');

    // El preflight de CORS debe responderse antes de buscar el manejador.
    if (peticion.method === 'OPTIONS') {
      respuesta.statusCode = 204;
      respuesta.end();
      return;
    }

    if (!manejador) {
      respuesta.statusCode = 404;
      respuesta.end(JSON.stringify({ statusCode: 404, message: 'No encontrado' }));
      return;
    }

    const resultado = manejador(
      datosEntrada,
      peticion.headers.authorization,
      url.searchParams,
    );
    respuesta.statusCode = resultado.estado;
    respuesta.end(JSON.stringify(resultado.datos));
  });
});

servidor.listen(PUERTO, () => {
  console.log(`API simulada en http://localhost:${PUERTO}`);
});
