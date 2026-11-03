import axios, { AxiosError } from 'axios';

/**
 * Cliente HTTP único de la aplicación.
 *
 * Centraliza la dirección de la API, el envío del token y la traducción de
 * los errores de la API a mensajes legibles. Ningún componente construye
 * peticiones por su cuenta.
 */
/**
 * La comparacion es con '||' y no con '??' de forma deliberada.
 *
 * La construccion en contenedor define VITE_API_URL como cadena vacia a
 * proposito, para que la aplicacion use rutas relativas y el balanceador las
 * reenvie. Una cadena vacia no es nula, asi que '??' la dejaria pasar y axios
 * armaria las peticiones sin el prefijo '/api': irian a parar al servidor de
 * archivos estaticos y devolverian el index.html en lugar de datos.
 */
const DIRECCION_API = import.meta.env.VITE_API_URL || '/api';

export const cliente = axios.create({
  baseURL: DIRECCION_API,
  timeout: 20000,
});

const CLAVE_TOKEN = 'siplad.token';

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // En navegación privada el almacenamiento puede estar bloqueado. La
    // sesión sigue siendo válida mientras la pestaña esté abierta.
  }
}

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

/** Adjunta el token a toda peticion saliente. */
cliente.interceptors.request.use((configuracion) => {
  const token = leerToken();
  if (token) {
    configuracion.headers.Authorization = `Bearer ${token}`;
  }
  return configuracion;
});

/**
 * Una sesión vencida cierra la sesión en lugar de dejar la interfaz
 * respondiendo con errores en cada pantalla.
 */
cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError) => {
    const enLogin = window.location.pathname.startsWith('/acceso');
    if (error.response?.status === 401 && !enLogin) {
      borrarToken();
      window.location.assign('/acceso?sesion=vencida');
    }
    return Promise.reject(error);
  },
);

/**
 * Traduce un error de la API al mensaje que verá el usuario.
 *
 * La API devuelve `message` como cadena o como arreglo cuando la validación
 * reporta varios campos a la vez.
 */
export function mensajeDeError(error: unknown, respaldo: string): string {
  if (axios.isAxiosError(error)) {
    const datos = error.response?.data as { message?: string | string[] } | undefined;
    const mensaje = datos?.message;

    if (Array.isArray(mensaje)) return mensaje.join('. ');
    if (typeof mensaje === 'string') return mensaje;

    if (error.code === 'ECONNABORTED') {
      return 'El servidor tardó demasiado en responder. Vuelve a intentarlo.';
    }
    if (!error.response) {
      return 'No se pudo contactar al servidor. Revisa que la API esté en ejecución.';
    }
  }
  return respaldo;
}
