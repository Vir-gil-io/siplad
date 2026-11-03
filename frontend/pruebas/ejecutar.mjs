/**
 * Orquestador de la prueba de humo.
 *
 * La prueba necesita dos procesos levantados: la API simulada y el servidor
 * que sirve la aplicacion compilada. Arrancarlos a mano en tres terminales es
 * una fuente de errores, asi que se hace aqui: compila, levanta, espera a que
 * los puertos respondan, ejecuta la prueba y apaga todo.
 *
 *   npm run test:humo
 */
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync } from 'node:fs';

const PUERTO_API = 3000;
const PUERTO_WEB = 4173;
const ESPERA_MAXIMA = 60_000;

const enWindows = process.platform === 'win32';
const procesos = [];

/**
 * Lanza un proceso hijo y lo registra para apagarlo al final.
 *
 * La salida se reenvia con una marca delante en lugar de descartarse: si el
 * proceso no llega a escuchar, el motivo lo dice el propio proceso, y un
 * conducto que nadie lee acaba por llenarse y bloquear al hijo.
 */
function lanzar(etiqueta, comando, argumentos) {
  const hijo = spawn(comando, argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });

  const reenviar = (flujo) => {
    flujo.setEncoding('utf8');
    flujo.on('data', (texto) => {
      for (const linea of texto.split('\n')) {
        if (linea.trim()) console.log(`  [${etiqueta}] ${linea.trim()}`);
      }
    });
  };

  reenviar(hijo.stdout);
  reenviar(hijo.stderr);

  hijo.on('error', (fallo) => {
    console.error(`  [${etiqueta}] no se pudo iniciar: ${fallo.message}`);
  });

  hijo.on('exit', (codigo) => {
    if (codigo) console.error(`  [${etiqueta}] termino con codigo ${codigo}`);
  });

  procesos.push({ etiqueta, hijo });
  return hijo;
}

/**
 * Apaga los procesos auxiliares.
 *
 * En Windows se usa taskkill con /T porque npm y vite corren como procesos
 * anidados: matar solo al padre dejaria el puerto ocupado y la siguiente
 * ejecucion fallaria sin motivo aparente.
 */
function apagar() {
  for (const { hijo } of procesos) {
    if (hijo.exitCode !== null || hijo.pid === undefined) continue;

    if (enWindows) {
      spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: true,
      });
    } else {
      hijo.kill('SIGTERM');
    }
  }
}

/** Una sola tentativa de conexion contra un host concreto. */
function tocarPuerto(host, puerto) {
  return new Promise((resolver) => {
    const zocalo = connect({ host, port: puerto });
    const cerrar = (exito) => {
      zocalo.destroy();
      resolver(exito);
    };
    zocalo.once('connect', () => cerrar(true));
    zocalo.once('error', () => cerrar(false));
    zocalo.setTimeout(2000, () => cerrar(false));
  });
}

/**
 * Espera a que un puerto acepte conexiones.
 *
 * Se comprueba con una conexion TCP y no con una peticion HTTP para no
 * depender de la configuracion de proxy del equipo.
 *
 * Se prueban las dos familias de direcciones porque 'localhost' no resuelve
 * igual en todos los sistemas: en Windows suele resolver primero a ::1, de
 * modo que un servidor enlazado ahi es invisible para quien solo consulta
 * 127.0.0.1. El navegador de la prueba resuelve el nombre igual que el
 * sistema, asi que basta con que una de las dos responda.
 */
function esperarPuerto(puerto, etiqueta) {
  const limite = Date.now() + ESPERA_MAXIMA;

  return new Promise((resolver, rechazar) => {
    const intentar = async () => {
      for (const host of ['127.0.0.1', '::1']) {
        if (await tocarPuerto(host, puerto)) {
          resolver();
          return;
        }
      }

      if (Date.now() > limite) {
        rechazar(
          new Error(
            `${etiqueta} no respondio en el puerto ${puerto}. ` +
              'Revisa las lineas marcadas arriba; si el puerto ya estaba ocupado, ' +
              'cierra el proceso que lo retiene y vuelve a intentar.',
          ),
        );
        return;
      }

      setTimeout(() => void intentar(), 300);
    };

    void intentar();
  });
}

/** Ejecuta un comando y resuelve con su codigo de salida. */
function ejecutar(comando, argumentos) {
  return new Promise((resolver) => {
    const hijo = spawn(comando, argumentos, { stdio: 'inherit', shell: enWindows });
    hijo.on('close', (codigo) => resolver(codigo ?? 1));
    hijo.on('error', () => resolver(1));
  });
}

let codigoFinal = 1;

try {
  if (!existsSync('node_modules/playwright')) {
    console.error(
      '\nFalta Playwright. Instalalo con:\n' +
        '  npm install\n' +
        '  npx playwright install chromium\n',
    );
    process.exit(1);
  }

  console.log('Compilando la aplicacion…');
  const compilacion = await ejecutar('npm', ['run', 'build']);
  if (compilacion !== 0) {
    console.error('La compilacion fallo; la prueba no puede continuar.');
    process.exit(compilacion);
  }

  console.log('Levantando la API simulada y el servidor de vista previa…');
  lanzar('API simulada', 'node', ['pruebas/api-simulada.mjs']);

  // Se invoca el archivo de Vite con node en lugar de pasar por npx: asi no
  // dependemos de la resolucion de npx ni del interprete de comandos, que es
  // donde se rompe en Windows. 'strictPort' hace que, si el puerto ya esta
  // ocupado, Vite falle diciendolo en vez de moverse a otro en silencio.
  lanzar('vista previa', process.execPath, [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--port',
    String(PUERTO_WEB),
    '--strictPort',
  ]);

  await Promise.all([
    esperarPuerto(PUERTO_API, 'La API simulada'),
    esperarPuerto(PUERTO_WEB, 'El servidor de vista previa'),
  ]);

  console.log('');
  codigoFinal = await ejecutar('node', ['pruebas/prueba-humo.mjs']);
} catch (fallo) {
  console.error(`\n${fallo.message}`);
} finally {
  apagar();
}

// Las capturas quedan en pruebas/ y sirven como evidencia de la ejecucion.
process.exit(codigoFinal);
