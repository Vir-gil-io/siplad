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


  // --- Adjunto y validaciones ----------------------------------------------
  // Lo que se comprueba aqui no lo ve el compilador: que el enlace al
  // documento aparezca de los dos lados, y que el formulario se niegue a
  // enviar lo que el servidor rechazaria.
  await pagina.click('nav >> text=Revisión de planeaciones');
  await pagina.waitForURL('**/revision', { timeout: 10000 });
  await pagina.waitForSelector('button:has-text("Dictaminar")', { timeout: 10000 });

  registrar(
    'Coordinación ve el documento que adjuntó el docente',
    (await pagina.locator('button:has-text("Ver documento adjunto")').count()) > 0,
  );

  // El documento se abre en un visor dentro de la misma pantalla.
  await pagina.click('button:has-text("Ver documento adjunto")');
  await pagina.waitForSelector('[role="dialog"][aria-label*="Documento de la planeación"]', {
    timeout: 10000,
  });

  registrar(
    'El documento se muestra en un visor, sin salir de la pantalla',
    (await pagina.locator('[role="dialog"] iframe[src*="planeacion-pl3.pdf"]').count()) > 0,
  );

  const rotulo = await pagina
    .locator('[role="dialog"][aria-label*="Documento de la planeación"]')
    .getAttribute('aria-label');
  registrar(
    'El visor indica qué documento se está viendo',
    (rotulo ?? '').includes('Parcial'),
    rotulo ?? 'sin rótulo',
  );

  await pagina.screenshot({ path: 'pruebas/captura-visor.png' });

  registrar(
    'El visor ofrece abrirlo aparte si no puede incrustarse',
    (await pagina.locator('[role="dialog"] a:has-text("Abrir en pestaña nueva")').count()) > 0,
  );

  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
  registrar(
    'Al cerrar el visor se vuelve a la bandeja',
    (await pagina.locator('[role="dialog"]').count()) === 0,
  );

  await pagina.click('button:has-text("Dictaminar")');
  await pagina.waitForSelector('[role="dialog"]', { timeout: 10000 });
  registrar(
    'El acceso al documento también está en el diálogo de dictamen',
    (await pagina.locator('[role="dialog"] button:has-text("Ver el documento")').count()) > 0,
  );

  // El visor se abre encima del dictamen; cerrarlo debe devolver el
  // formulario intacto, no cerrar los dos de una pulsación. El campo de
  // comentario solo existe tras elegir «Solicitar ajustes».
  await pagina
    .locator('[role="dialog"] label:has-text("Solicitar ajustes") input')
    .check();
  await pagina.waitForSelector('[role="dialog"] #comentario', { timeout: 10000 });
  await pagina.fill('[role="dialog"] #comentario', 'texto en curso de captura');
  await pagina.click('[role="dialog"] button:has-text("Ver el documento")');
  await pagina.waitForSelector('[role="dialog"][aria-label*="Documento de la planeación"]', {
    timeout: 10000,
  });
  registrar(
    'El visor se abre encima del diálogo de dictamen',
    (await pagina.locator('[role="dialog"]').count()) === 2,
  );

  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
  registrar(
    'Escape cierra solo el visor y conserva el dictamen a medio capturar',
    (await pagina.locator('[role="dialog"]').count()) === 1 &&
      (await pagina.inputValue('[role="dialog"] #comentario')) ===
        'texto en curso de captura',
  );
  // Solicitar ajustes exige un comentario; el DTO pide al menos 10 caracteres.
  await pagina.fill('[role="dialog"] #comentario', 'corto');
  await pagina.click('[role="dialog"] button[type="submit"]');
  await pagina.waitForTimeout(300);
  registrar(
    'Un comentario demasiado corto no se envía y se avisa en el campo',
    (await pagina.locator('[role="dialog"] [role="alert"]').count()) > 0 &&
      (await pagina.locator('[role="dialog"]').count()) > 0,
    (await pagina.locator('[role="dialog"] [role="alert"]').first().innerText()).trim(),
  );
  registrar(
    'El campo con error queda marcado para lectores de pantalla',
    (await pagina.locator('[role="dialog"] #comentario[aria-invalid="true"]').count()) > 0,
  );
  await pagina.screenshot({ path: 'pruebas/captura-validacion.png' });
  await pagina.click('[role="dialog"] button[aria-label="Cerrar"]');
  await pagina.waitForTimeout(300);

  // El alta de planeación, del lado del docente.
  await pagina.evaluate(() => localStorage.clear());
  await entrar('docente@utng.edu.mx');
  await pagina.waitForURL('**/planeaciones', { timeout: 10000 });
  await pagina.waitForSelector('button:has-text("Registrar planeación")', {
    timeout: 10000,
  });

  registrar(
    'El docente ve su propio documento adjunto',
    (await pagina.locator('button:has-text("Ver documento adjunto")').count()) > 0,
  );

  await pagina.click('button:has-text("Registrar planeación")');
  await pagina.waitForSelector('[role="dialog"]', { timeout: 10000 });

  registrar(
    'El alta ofrece adjuntar el documento de la planeación',
    (await pagina.locator('[role="dialog"] input#archivo[type="file"]').count()) > 0,
  );

  // Enviar en blanco no debe llegar al servidor.
  await pagina.click('[role="dialog"] button[type="submit"]');
  await pagina.waitForTimeout(300);
  registrar(
    'Un formulario vacío no se envía',
    (await pagina.locator('[role="dialog"] #contenido[aria-invalid="true"]').count()) > 0,
  );

  // Una cadena mas larga que el limite del DTO tampoco.
  await pagina.fill('[role="dialog"] #contenido', 'x'.repeat(5100));
  await pagina.click('[role="dialog"] button[type="submit"]');
  await pagina.waitForTimeout(300);
  const avisoLargo = await pagina
    .locator('[role="dialog"] #contenido-error')
    .first()
    .innerText();
  registrar(
    'Una cadena más larga que el límite se detiene antes de salir',
    avisoLargo.includes('5000'),
    avisoLargo.trim(),
  );

  // Y el contador refleja lo escrito.
  registrar(
    'El contador de caracteres muestra el límite',
    (await pagina.locator('[role="dialog"] >> text=/5100 \\/ 5000/').count()) > 0,
  );
  await pagina.click('[role="dialog"] button[aria-label="Cerrar"]');
  await pagina.waitForTimeout(300);
  await pagina.screenshot({ path: 'pruebas/captura-planeaciones.png', fullPage: true });


  // --- Tramo informado del avance -----------------------------------------
  // El porcentaje solo es interpretable si se sabe a que intervalo
  // corresponde: se comprueba que el tramo viaje y se muestre en los dos
  // lados, y que el formulario lo acote al periodo academico.
  await pagina.evaluate(() => localStorage.clear());
  await entrar('docente@utng.edu.mx');
  await pagina.waitForURL('**/planeaciones', { timeout: 10000 });
  await pagina.click('nav >> text=Mis avances');
  await pagina.waitForURL('**/avances', { timeout: 10000 });
  await pagina.waitForSelector('text=/Informado del/', { timeout: 10000 });

  registrar(
    'El docente ve el tramo informado de su avance',
    (await pagina.locator('text=/Informado del .* al /').count()) > 0,
  );

  registrar(
    'El tramo viene acompanado de sus dias habiles',
    (await pagina.locator('text=/dias h|días h/').count()) > 0,
  );

  await pagina.click('button:has-text("Registrar avance")');
  await pagina.waitForSelector('[role="dialog"]', { timeout: 10000 });

  const desde = await pagina.inputValue('[role="dialog"] #fechaInicio');
  registrar(
    'El formulario propone el tramo desde el inicio del periodo',
    desde === '2026-08-17',
    desde,
  );

  const topeDesde = await pagina.getAttribute('[role="dialog"] #fechaInicio', 'min');
  registrar(
    'El campo de inicio queda acotado por el periodo academico',
    topeDesde === '2026-08-17',
    topeDesde ?? 'sin atributo',
  );

  // Un tramo invertido no debe salir del navegador.
  await pagina.fill('[role="dialog"] #fechaInicio', '2026-09-26');
  await pagina.fill('[role="dialog"] #fechaFin', '2026-08-17');
  await pagina.fill('[role="dialog"] #porcentaje', '70');
  await pagina.click('[role="dialog"] button[type="submit"]');
  await pagina.waitForTimeout(300);
  registrar(
    'Un tramo invertido se detiene antes de enviarse',
    (await pagina.locator('[role="dialog"] #fechaFin[aria-invalid="true"]').count()) > 0,
  );

  // Un tramo fuera del periodo tampoco.
  await pagina.fill('[role="dialog"] #fechaInicio', '2026-08-17');
  await pagina.fill('[role="dialog"] #fechaFin', '2026-12-31');
  await pagina.click('[role="dialog"] button[type="submit"]');
  await pagina.waitForTimeout(300);
  registrar(
    'Un tramo que excede el periodo se detiene antes de enviarse',
    (await pagina.locator('[role="dialog"] #fechaFin[aria-invalid="true"]').count()) > 0,
  );
  await pagina.screenshot({ path: 'pruebas/captura-avance-tramo.png' });
  await pagina.click('[role="dialog"] button[aria-label="Cerrar"]');
  await pagina.waitForTimeout(300);

  // --- Seguimiento de avances, del lado de coordinacion --------------------
  await pagina.evaluate(() => localStorage.clear());
  await entrar('coordinacion@utng.edu.mx');
  await pagina.waitForURL('**/revision', { timeout: 10000 });
  await pagina.click('nav >> text=Seguimiento de avances');
  await pagina.waitForURL('**/seguimiento', { timeout: 10000 });
  await pagina.waitForSelector('text=/Informado del/', { timeout: 10000 });

  registrar(
    'Coordinacion ve el registro individual de cada avance',
    (await pagina.locator('text=/Informado del .* al /').count()) >= 2,
  );

  registrar(
    'El seguimiento ofrece filtrar por periodo y por cumplimiento',
    (await pagina.locator('#filtroPeriodo').count()) > 0 &&
      (await pagina.locator('#filtroEstado').count()) > 0,
  );

  await pagina.selectOption('#filtroEstado', 'CUMPLIDO');
  await pagina.waitForTimeout(300);
  registrar(
    'El filtro de cumplimiento reduce el listado',
    (await pagina.locator('text=/Informado del .* al /').count()) === 1,
  );
  await pagina.screenshot({ path: 'pruebas/captura-seguimiento.png', fullPage: true });

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
