/**
 * Prueba de humo del frontend contra la API simulada.
 *
 * Verifica lo que la compilación no puede ver: que las pantallas se rendericen
 * sin reventar, que la navegación por rol funcione, que los datos de la API
 * aparezcan con el nombre de campo correcto y que las gráficas se dibujen.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const resultados = [];
const erroresDeConsola = [];

function registrar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

// El contenedor enruta todo por un proxy; las peticiones a localhost deben
// omitirlo, mientras las tipografias siguen pasando por el.
// El contenedor enruta todo por un proxy que no alcanza localhost, asi que el
// navegador de la prueba se lanza sin proxy. Las tipografias remotas no cargan
// durante la prueba y el navegador usa las de respaldo; no afecta lo que se
// verifica aqui.
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();

pagina.on('console', (mensaje) => {
  if (mensaje.type() !== 'error') return;
  const texto = mensaje.text();
  // Las tipografias se sirven desde un dominio externo que el contenedor de
  // la prueba no alcanza; no es un defecto de la aplicacion.
  if (texto.includes('ERR_TUNNEL_CONNECTION_FAILED')) return;
  erroresDeConsola.push(texto);
});
pagina.on('pageerror', (error) => erroresDeConsola.push(`pageerror: ${error.message}`));

async function entrar(email) {
  await pagina.goto(`${BASE}/acceso`, { waitUntil: 'networkidle' });
  await pagina.fill('#email', email);
  await pagina.fill('#password', 'Siplad2026*');
  await pagina.click('button[type="submit"]');
}

try {
  // --- Pantalla de acceso --------------------------------------------------
  await pagina.goto(`${BASE}/acceso`, { waitUntil: 'networkidle' });
  registrar(
    'La pantalla de acceso muestra el bloque institucional',
    (await pagina.locator('text=Sistema Institucional de Planeación y Avance Docente').count()) > 0,
  );
  registrar(
    'Ofrece el acceso federado con Google',
    (await pagina.locator('text=Entrar con mi cuenta de Google').count()) > 0,
  );

  // --- Una ruta protegida redirige al acceso ------------------------------
  await pagina.goto(`${BASE}/reportes`, { waitUntil: 'networkidle' });
  registrar(
    'Una ruta protegida sin sesión redirige al acceso',
    pagina.url().includes('/acceso'),
    pagina.url(),
  );

  // --- Sesión de docente --------------------------------------------------
  await entrar('jcorrea@utng.edu.mx');
  await pagina.waitForURL('**/planeaciones', { timeout: 10000 });
  registrar('El docente entra a sus planeaciones', pagina.url().includes('/planeaciones'));

  await pagina.waitForSelector('text=Matematicas I', { timeout: 10000 });
  registrar(
    'Se listan las planeaciones con su materia',
    (await pagina.locator('text=Matematicas I').count()) > 0,
  );
  registrar(
    'El sello muestra el estado aprobado',
    (await pagina.locator('.sello', { hasText: 'Aprobada' }).count()) > 0,
  );
  registrar(
    'El comentario de revisión aparece cuando hay ajustes',
    (await pagina.locator('text=Falta precisar los instrumentos').count()) > 0,
  );

  // El docente no debe ver la navegación de coordinación.
  registrar(
    'El docente no ve la navegación de coordinación',
    (await pagina.locator('nav >> text=Reportes').count()) === 0,
  );

  // --- El diálogo de alta abre y cierra -----------------------------------
  await pagina.click('button:has-text("Registrar planeación")');
  await pagina.waitForSelector('[role="dialog"]', { timeout: 5000 });
  registrar(
    'El diálogo de registro abre con el catálogo de materias',
    (await pagina.locator('#materia option').count()) === 2,
  );
  await pagina.keyboard.press('Escape');
  await pagina.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 });
  registrar('El diálogo cierra con Escape', true);

  // --- Avances -------------------------------------------------------------
  await pagina.click('nav >> text=Mis avances');
  await pagina.waitForURL('**/avances', { timeout: 10000 });
  // Se espera por un elemento exclusivo de esta vista ya con datos: 'MAT-101'
  // tambien aparece en la pantalla anterior y coincidiria antes de que React
  // desmonte la vista previa.
  await pagina.waitForSelector('button:has-text("Registrar avance")', {
    timeout: 15000,
  });
  const textoAvances = await pagina.locator('main').innerText();
  registrar(
    'La vista de avances muestra el porcentaje registrado',
    textoAvances.includes('92%'),
  );
  registrar(
    'El avance ya registrado muestra su sello de cumplimiento',
    (await pagina.locator('.sello', { hasText: 'Cumplido' }).count()) > 0,
  );

  // --- Constancias ---------------------------------------------------------
  await pagina.click('nav >> text=Mis constancias');
  await pagina.waitForURL('**/evidencias', { timeout: 10000 });
  await pagina.waitForSelector('text=Evaluacion formativa en el aula', { timeout: 10000 });
  registrar(
    'Las constancias muestran las horas acreditadas en el encabezado',
    (await pagina.locator('text=40 horas acreditadas en el periodo').count()) > 0,
  );

  // --- Un docente no alcanza las vistas de coordinación -------------------
  await pagina.goto(`${BASE}/reportes`, { waitUntil: 'networkidle' });
  registrar(
    'Un docente que escribe la URL de reportes es devuelto a su panel',
    pagina.url().includes('/planeaciones'),
    pagina.url(),
  );

  // --- Sesión de coordinación ---------------------------------------------
  await pagina.evaluate(() => localStorage.clear());
  await entrar('coordinacion@utng.edu.mx');
  await pagina.waitForURL('**/revision', { timeout: 10000 });
  registrar('Coordinación entra a la bandeja de revisión', pagina.url().includes('/revision'));

  await pagina.waitForSelector('text=Jorge Alberto Correa Nunez', { timeout: 10000 });
  registrar(
    'La bandeja abre filtrada en lo que está en revisión',
    (await pagina.locator('button:has-text("Dictaminar")').count()) > 0,
  );

  // --- El diálogo de dictamen pide motivo al solicitar ajustes ------------
  await pagina.click('button:has-text("Dictaminar")');
  await pagina.waitForSelector('[role="dialog"]', { timeout: 5000 });
  registrar(
    'El dictamen ofrece aprobar y solicitar ajustes',
    (await pagina.locator('[role="dialog"] input[type="radio"]').count()) === 2,
  );
  await pagina.locator('[role="dialog"] input[type="radio"]').nth(1).check();
  await pagina.waitForSelector('#comentario', { timeout: 5000 });
  registrar('Al solicitar ajustes aparece el campo de observaciones', true);
  await pagina.keyboard.press('Escape');

  // --- Reportes y gráficas -------------------------------------------------
  await pagina.click('nav >> text=Reportes');
  await pagina.waitForURL('**/reportes', { timeout: 10000 });
  await pagina.waitForSelector('text=Seguimiento institucional', { timeout: 15000 });

  registrar(
    'Los indicadores muestran el cumplimiento calculado',
    (await pagina.locator('text=66.7').count()) > 0,
  );
  registrar(
    'Los días hábiles vienen de la capa de integración',
    (await pagina.locator('text=88').count()) > 0,
  );

  // Recharts dibuja en SVG: si hay rectángulos, la gráfica se renderizó.
  await pagina.waitForSelector('svg .recharts-bar-rectangle', { timeout: 15000 });
  const barras = await pagina.locator('svg .recharts-bar-rectangle').count();
  registrar('Las gráficas se dibujan', barras > 0, `${barras} barras`);

  registrar(
    'La leyenda nombra los tres estados de cumplimiento',
    (await pagina.locator('text=No cumplido').count()) > 0,
  );
  registrar(
    'La tabla de detalle acompaña a las gráficas',
    (await pagina.locator('table tbody tr').count()) === 2,
  );
  registrar(
    'Ofrece la exportación a Excel y a PDF',
    (await pagina.locator('button:has-text("Descargar Excel")').count()) > 0 &&
      (await pagina.locator('button:has-text("Descargar PDF")').count()) > 0,
  );

  // --- Diseño adaptable ----------------------------------------------------
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(400);
  const desbordamiento = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  registrar('No hay desplazamiento horizontal a 390 px de ancho', !desbordamiento);

  // --- Captura para la documentación --------------------------------------
  await pagina.setViewportSize({ width: 1280, height: 900 });
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: 'pruebas/captura-reportes.png', fullPage: true });

  await pagina.click('nav >> text=Revisión de planeaciones');
  await pagina.waitForURL('**/revision', { timeout: 10000 });
  await pagina.waitForSelector('button:has-text("Dictaminar")', { timeout: 10000 });
  const navRevision = await pagina.locator('nav a[aria-current="page"]').innerText();
  registrar(
    'La sección activa cambia al navegar',
    navRevision.trim() === 'Revisión de planeaciones',
    navRevision.trim(),
  );
  await pagina.screenshot({ path: 'pruebas/captura-revision.png', fullPage: true });

  await pagina.evaluate(() => localStorage.clear());
  await pagina.goto(`${BASE}/acceso`, { waitUntil: 'networkidle' });
  await pagina.screenshot({ path: 'pruebas/captura-acceso.png' });
} catch (fallo) {
  registrar('Ejecución completa de la prueba', false, fallo.message);
} finally {
  await navegador.close();
}

// --- Resumen ---------------------------------------------------------------
registrar('La consola del navegador no reporta errores', erroresDeConsola.length === 0,
  erroresDeConsola.slice(0, 3).join(' | '));

const fallidas = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - fallidas.length} de ${resultados.length} verificaciones correctas`,
);
process.exit(fallidas.length === 0 ? 0 : 1);
