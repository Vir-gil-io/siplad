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
const docenteDos = { id: 'd2', nombre: 'Maria Fernanda Vargas Leon', email: 'mvargas@utng.edu.mx' };
const coordinador = {
  id: 'c1',
  nombre: 'Laura Beatriz Mendoza Rivas',
  email: 'coordinacion@utng.edu.mx',
  rol: 'COORDINADOR',
};

const planeacion = (id, estado, parcial, avance, autor = docente) => ({
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
  usuarioId: autor.id,
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
  usuario: autor,
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

/**
 * Los seis avances del periodo.
 *
 * Las cifras agregadas de los reportes se calculan a partir de esta lista, no
 * se escriben a mano: asi el desglose que abre una barra de la grafica coincide
 * siempre con la cifra que la barra muestra, que es justo lo que el desglose
 * tiene que demostrar.
 */
const AVANCES = [
  { id: 'av1', parcial: 1, autor: docente, porcentaje: 92, estado: 'CUMPLIDO' },
  { id: 'av2', parcial: 1, autor: docente, porcentaje: 88, estado: 'CUMPLIDO' },
  { id: 'av3', parcial: 1, autor: docenteDos, porcentaje: 95, estado: 'CUMPLIDO' },
  { id: 'av4', parcial: 1, autor: docente, porcentaje: 71, estado: 'PARCIAL',
    observaciones: 'Falto cubrir el ultimo bloque por suspension oficial de labores.' },
  { id: 'av5', parcial: 2, autor: docente, porcentaje: 68, estado: 'PARCIAL' },
  { id: 'av6', parcial: 2, autor: docenteDos, porcentaje: 47, estado: 'NO_CUMPLIDO',
    observaciones: 'Se perdieron sesiones por el periodo de evaluaciones extraordinarias.' },
].map((a) => ({
  ...avanceDeEjemplo,
  id: a.id,
  porcentaje: a.porcentaje,
  estado: a.estado,
  observaciones: a.observaciones ?? null,
  planeacionId: `pl-${a.id}`,
  planeacion: planeacion(`pl-${a.id}`, 'APROBADA', a.parcial, null, a.autor),
}));

/** Acota la lista por lo mismo que el servidor real: parcial y docente. */
const acotar = (consulta) =>
  AVANCES.filter(
    (a) =>
      (!consulta.get('parcial') || a.planeacion.parcial === Number(consulta.get('parcial'))) &&
      (!consulta.get('docenteId') || a.planeacion.usuarioId === consulta.get('docenteId')),
  );

const contar = (lista, estado) => lista.filter((a) => a.estado === estado).length;
const promediar = (lista) =>
  lista.length === 0
    ? 0
    : Math.round((lista.reduce((t, a) => t + a.porcentaje, 0) / lista.length) * 10) / 10;

/** El bloque de avances de los indicadores, calculado sobre la lista acotada. */
const bloqueDeAvances = (consulta) => {
  const lista = acotar(consulta);
  return {
    total: lista.length,
    cumplidos: contar(lista, 'CUMPLIDO'),
    parciales: contar(lista, 'PARCIAL'),
    noCumplidos: contar(lista, 'NO_CUMPLIDO'),
    porcentajePromedio: promediar(lista),
  };
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

  'GET /api/avances': () => ({ estado: 200, datos: AVANCES }),

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

  // La exportacion solo necesita responder algo descargable: lo que la prueba
  // comprueba es que la acotacion elegida en pantalla viaje en la peticion.
  'GET /api/reportes/exportar/excel': () => ({ estado: 200, datos: { archivo: 'simulado' } }),
  'GET /api/reportes/exportar/pdf': () => ({ estado: 200, datos: { archivo: 'simulado' } }),

  'GET /api/reportes/indicadores': (_c, _a, consulta) => ({
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
      avances: bloqueDeAvances(consulta),
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

  'GET /api/reportes/por-docente': (_c, _a, consulta) => {
    const filas = [docente, docenteDos]
      .filter((d) => !consulta.get('docenteId') || d.id === consulta.get('docenteId'))
      .map((d) => {
        const suyos = acotar(consulta).filter((a) => a.planeacion.usuarioId === d.id);
        const registradas = d.id === 'd1' ? 4 : 3;
        const aprobadas = d.id === 'd1' ? 3 : 2;
        return {
          docenteId: d.id,
          docente: d.nombre,
          email: d.email,
          planeacionesRegistradas: registradas,
          planeacionesAprobadas: aprobadas,
          porcentajeCumplimientoPlaneacion:
            Math.round((aprobadas / registradas) * 1000) / 10,
          avancesRegistrados: suyos.length,
          promedioAvance: promediar(suyos),
          horasAcreditadas: d.id === 'd1' ? 60 : 25,
        };
      });
    return { estado: 200, datos: filas };
  },

  'GET /api/reportes/por-parcial': (_c, _a, consulta) => {
    const pedido = consulta.get('parcial');
    const parciales = pedido ? [Number(pedido)] : [1, 2, 3];
    const lista = acotar(consulta);

    return {
      estado: 200,
      datos: parciales.map((parcial) => {
        const delParcial = lista.filter((a) => a.planeacion.parcial === parcial);
        return {
          parcial,
          planeaciones: { 1: 4, 2: 3, 3: 2 }[parcial] ?? 0,
          aprobadas: { 1: 4, 2: 2, 3: 0 }[parcial] ?? 0,
          avancesRegistrados: delParcial.length,
          cumplidos: contar(delParcial, 'CUMPLIDO'),
          parciales: contar(delParcial, 'PARCIAL'),
          noCumplidos: contar(delParcial, 'NO_CUMPLIDO'),
          promedioAvance: promediar(delParcial),
        };
      }),
    };
  },
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
