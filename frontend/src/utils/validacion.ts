/**
 * Validación de formularios.
 *
 * ## Qué protege esto y qué no
 *
 * Estas reglas son para el usuario, no para el servidor. Existen para que un
 * error se vea antes de enviar y no después de esperar la respuesta, y para
 * que los límites que la interfaz muestra coincidan exactamente con los que
 * el backend impone.
 *
 * La seguridad real vive en el servidor: lista blanca de propiedades,
 * longitudes máximas, consultas parametrizadas por el ORM y control de acceso
 * por rol. Cualquiera puede saltarse esta capa con una petición directa, así
 * que tratarla como defensa sería un error.
 *
 * Por el mismo motivo aquí no se filtran "caracteres peligrosos". React
 * escapa todo lo que renderiza y el ORM parametriza todo lo que consulta, de
 * modo que un signo de menor-que no representa riesgo alguno; prohibirlo solo
 * impediría escribir una planeación que mencione una desigualdad matemática.
 */

/** Límites tomados uno a uno de los DTO del backend. */
export const LIMITES = {
  contenidoPlaneacion: { minimo: 20, maximo: 5000 },
  comentarioRevision: { minimo: 10, maximo: 1000 },
  motivoRechazo: { minimo: 10, maximo: 1000 },
  observacionesAvance: { minimo: 0, maximo: 1000 },
  nombreCurso: { minimo: 5, maximo: 200 },
  institucion: { minimo: 3, maximo: 200 },
  password: { minimo: 8, maximo: 72 },
  email: { minimo: 0, maximo: 120 },
} as const;

export const ARCHIVO = {
  tamanoMaximo: 5 * 1024 * 1024,
  planeacion: {
    tipos: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    accept: '.pdf,.doc,.docx',
    descripcion: 'PDF, DOC o DOCX',
  },
  constancia: {
    tipos: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    accept: '.pdf,.jpg,.jpeg,.png',
    descripcion: 'PDF, JPG o PNG',
  },
} as const;

export interface ReglaTexto {
  etiqueta: string;
  requerido?: boolean;
  minimo?: number;
  maximo?: number;
}

/**
 * Devuelve el mensaje de error, o null si el valor es aceptable.
 *
 * El valor se compara ya recortado: una cadena de espacios no satisface un
 * campo obligatorio, que es justo lo que un usuario apurado intentaría.
 */
export function validarTexto(valor: string, regla: ReglaTexto): string | null {
  const limpio = valor.trim();

  if (regla.requerido && limpio.length === 0) {
    return `${regla.etiqueta} es obligatorio.`;
  }

  if (limpio.length === 0) return null;

  if (regla.minimo !== undefined && limpio.length < regla.minimo) {
    return `${regla.etiqueta} debe tener al menos ${regla.minimo} caracteres. Llevas ${limpio.length}.`;
  }

  if (regla.maximo !== undefined && limpio.length > regla.maximo) {
    return `${regla.etiqueta} no puede exceder ${regla.maximo} caracteres. Llevas ${limpio.length}.`;
  }

  return null;
}

/** Comprobación de formato de correo, deliberadamente permisiva. */
export function validarCorreo(valor: string, requerido = true): string | null {
  const limpio = valor.trim();

  if (limpio.length === 0) {
    return requerido ? 'El correo electrónico es obligatorio.' : null;
  }

  if (limpio.length > LIMITES.email.maximo) {
    return `El correo no puede exceder ${LIMITES.email.maximo} caracteres.`;
  }

  // Una expresión estricta rechaza correos válidos poco comunes. Basta con
  // detectar lo que es claramente un error de captura; el servidor aplica la
  // validación que cuenta.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) {
    return 'El correo electrónico no tiene un formato válido.';
  }

  return null;
}

export function validarEntero(
  valor: string,
  regla: { etiqueta: string; minimo: number; maximo: number; requerido?: boolean },
): string | null {
  const limpio = valor.trim();

  if (limpio.length === 0) {
    return regla.requerido ? `${regla.etiqueta} es obligatorio.` : null;
  }

  if (!/^\d+$/.test(limpio)) {
    return `${regla.etiqueta} debe ser un número entero.`;
  }

  const numero = Number(limpio);

  if (numero < regla.minimo || numero > regla.maximo) {
    return `${regla.etiqueta} debe estar entre ${regla.minimo} y ${regla.maximo}.`;
  }

  return null;
}

export function validarFecha(valor: string, etiqueta: string): string | null {
  if (!valor) return `${etiqueta} es obligatoria.`;

  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) {
    return `${etiqueta} no es una fecha válida.`;
  }

  // Un curso no puede concluir en el futuro.
  const hoy = new Date();
  hoy.setUTCHours(23, 59, 59, 999);
  if (fecha > hoy) {
    return `${etiqueta} no puede ser posterior a hoy.`;
  }

  return null;
}

/**
 * Valida el archivo antes de enviarlo.
 *
 * Comprobarlo aquí evita subir cinco megabytes para que el servidor los
 * rechace. El servidor vuelve a comprobarlo de todos modos, porque es el
 * único lugar donde la comprobación es confiable.
 */
export function validarArchivo(
  archivo: File | null,
  tipo: { tipos: readonly string[]; descripcion: string },
  requerido = false,
): string | null {
  if (!archivo) {
    return requerido ? 'Debes adjuntar un archivo.' : null;
  }

  if (!tipo.tipos.includes(archivo.type)) {
    return `Formato no admitido. Se aceptan ${tipo.descripcion}.`;
  }

  if (archivo.size > ARCHIVO.tamanoMaximo) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return `El archivo pesa ${mb} MB y el máximo es 5 MB.`;
  }

  return null;
}

/**
 * Valida un tramo de fechas contra los limites de un periodo.
 *
 * Replica la regla que impone el servidor, que es la que cuenta: el tramo debe
 * quedar dentro del periodo academico de la planeacion, no puede estar
 * invertido y no puede comenzar en el futuro.
 */
export function validarTramo(
  inicio: string,
  fin: string,
  limites: { fechaInicio: string; fechaFin: string; nombre: string },
): { fechaInicio: string | null; fechaFin: string | null } {
  const errores: { fechaInicio: string | null; fechaFin: string | null } = {
    fechaInicio: null,
    fechaFin: null,
  };

  if (!inicio) errores.fechaInicio = 'La fecha de inicio es obligatoria.';
  if (!fin) errores.fechaFin = 'La fecha de fin es obligatoria.';
  if (errores.fechaInicio || errores.fechaFin) return errores;

  const desde = inicio.slice(0, 10);
  const hasta = fin.slice(0, 10);
  const limiteInferior = limites.fechaInicio.slice(0, 10);
  const limiteSuperior = limites.fechaFin.slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);

  // Las fechas vienen en formato AAAA-MM-DD, que se ordena bien como texto:
  // comparar cadenas evita construir objetos Date y con ellos el desfase de
  // zona horaria que desplazaria el limite un dia.
  if (hasta < desde) {
    errores.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio.';
    return errores;
  }

  if (desde > hoy) {
    errores.fechaInicio = 'El tramo no puede comenzar en el futuro.';
    return errores;
  }

  if (desde < limiteInferior) {
    errores.fechaInicio = `El periodo ${limites.nombre} comienza el ${limiteInferior}.`;
  }

  if (hasta > limiteSuperior) {
    errores.fechaFin = `El periodo ${limites.nombre} termina el ${limiteSuperior}.`;
  }

  return errores;
}

/** Fecha legible en español a partir de una marca ISO. */
export function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Tamaño legible, para mostrarlo junto al archivo elegido. */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Reúne los errores de un formulario descartando los campos correctos.
 * Devuelve un objeto vacío cuando todo es válido.
 */
export function reunirErrores(
  candidatos: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(candidatos).filter((par): par is [string, string] => par[1] !== null),
  );
}

/** Lleva el foco al primer campo con error, para no obligar a buscarlo. */
export function enfocarPrimerError(errores: Record<string, string>): void {
  const primero = Object.keys(errores)[0];
  if (!primero) return;

  const elemento = document.getElementById(primero);
  elemento?.focus();
  elemento?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
