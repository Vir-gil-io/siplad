import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useSesion } from '../auth/useSesion';
import { autenticacion } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { Aviso } from '../components/Aviso';
import { Boton, Campo } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import {
  enfocarPrimerError,
  reunirErrores,
  validarCorreo,
  validarTexto,
} from '../utils/validacion';

/**
 * Acceso al sistema.
 *
 * La pantalla toma la forma del encabezado de un acta oficial: el bloque
 * institucional arriba, con la clave del documento y el ciclo, y debajo los
 * campos. Es lo primero que un docente reconoce de su entorno de trabajo.
 */
export function Acceso() {
  const { perfil, cargando, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();

  const [email, establecerEmail] = useState('');
  const [password, establecerPassword] = useState('');
  const [error, establecerError] = useState<string | null>(
    parametros.get('sesion') === 'vencida'
      ? 'Tu sesión terminó por inactividad. Vuelve a entrar.'
      : null,
  );
  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [enviando, establecerEnviando] = useState(false);

  if (cargando) {
    return <Cargando mensaje="Verificando tu sesión" />;
  }

  if (perfil) {
    return <Navigate to="/" replace />;
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    // En el acceso solo se comprueba que los campos vengan completos y que el
    // correo tenga forma de correo. Imponer aqui una longitud minima de
    // contrasena no protege nada y si deja fuera a quien tiene una mas corta,
    // ademas de anunciar la politica a quien prueba credenciales.
    const encontrados = reunirErrores({
      email: validarCorreo(email),
      password: validarTexto(password, {
        etiqueta: 'La contraseña',
        requerido: true,
      }),
    });
    establecerErrores(encontrados);

    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }

    establecerEnviando(true);

    try {
      const usuario = await iniciarSesion(email, password);
      const destino =
        (ubicacion.state as { desde?: string } | null)?.desde ??
        (usuario.rol === 'COORDINADOR' ? '/revision' : '/planeaciones');
      void navegar(destino, { replace: true });
    } catch (fallo) {
      establecerError(
        mensajeDeError(fallo, 'No se pudo iniciar sesión. Vuelve a intentarlo.'),
      );
    } finally {
      establecerEnviando(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="hoja">
          {/* Bloque institucional, como la cabecera de un acta. */}
          <div className="hoja-encabezado border-b-2 border-tinta px-6 pt-6 pb-5">
            <p className="font-titulo text-3xl font-bold tracking-tight text-tinta">
              SIPLAD
            </p>
            <p className="mt-1 text-sm leading-snug text-tinta-suave">
              Sistema Institucional de Planeación y Avance Docente
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-regla pt-3 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-grafito">Nivel</dt>
                <dd className="text-tinta">Medio superior</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-grafito">Ciclo</dt>
                <dd className="cifra text-tinta">2026</dd>
              </div>
            </dl>
          </div>

          <form onSubmit={enviar} className="space-y-4 px-6 py-6" noValidate>
            {error ? <Aviso>{error}</Aviso> : null}

            <Campo
              id="email"
              etiqueta="Correo institucional"
              type="email"
              autoComplete="username"
              placeholder="nombre@utng.edu.mx"
              value={email}
              error={errores.email}
              onChange={(e) => {
                establecerEmail(e.target.value);
                establecerErrores((p) => {
                  const { email: _, ...r } = p;
                  return r;
                });
              }}
              requerido
            />

            <Campo
              id="password"
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              error={errores.password}
              onChange={(e) => {
                establecerPassword(e.target.value);
                establecerErrores((p) => {
                  const { password: _, ...r } = p;
                  return r;
                });
              }}
              requerido
            />

            <Boton type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Boton>

            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-regla" />
              <span className="text-xs text-grafito">o</span>
              <span className="h-px flex-1 bg-regla" />
            </div>

            {/* El acceso federado sale del dominio de la aplicación, así que
                es una navegación real y no una petición con axios. */}
            <a
              href={autenticacion.urlGoogle()}
              className="block rounded-md border border-regla-fuerte bg-panel px-3.5 py-2 text-center text-sm font-medium text-tinta shadow-[0_1px_1px_rgba(35,38,59,.06)] transition-all duration-100 hover:border-sello hover:text-sello active:translate-y-px"
            >
              Entrar con mi cuenta de Google
            </a>
          </form>
        </div>

        <p className="mt-4 px-1 text-xs leading-relaxed text-grafito">
          El acceso queda registrado. Si no puedes entrar, solicita el restablecimiento a
          coordinación académica.
        </p>
      </div>
    </div>
  );
}
