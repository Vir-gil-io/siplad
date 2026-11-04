# Cumplimiento del OWASP Top 10

Verificación de los diez principios de seguridad sobre el sistema SIPLAD, con la ubicación exacta
del control en el código y la forma de comprobarlo.

Referencia: **OWASP Top 10:2021** — Open Worldwide Application Security Project.

---

## Resumen

| #   | Principio                                         | Estado   | Control principal                                                       |
| --- | ------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| A01 | Pérdida de control de acceso                      | Cumplido | Guards de rol y filtro de propiedad impuesto en el servidor             |
| A02 | Fallas criptográficas                             | Cumplido | Hash bcrypt, token firmado con expiración, TLS en el borde              |
| A03 | Inyección                                         | Cumplido | Consultas parametrizadas por el ORM y validación con lista blanca       |
| A04 | Diseño inseguro                                   | Cumplido | Transiciones de estado controladas y restricciones de unicidad          |
| A05 | Configuración de seguridad defectuosa             | Cumplido | Cabeceras endurecidas, CORS restringido, contenedor sin privilegios     |
| A06 | Componentes vulnerables y desactualizados         | Cumplido | Auditoría en cada integración y vigilancia programada                   |
| A07 | Fallas de identificación y autenticación          | Cumplido | Respuesta uniforme y validación del usuario en cada petición            |
| A08 | Fallas de integridad del software y los datos     | Cumplido | Dependencias ancladas, ramas protegidas y escaneo obligatorio           |
| A09 | Fallas de registro y monitoreo                    | Cumplido | Bitácora de intentos fallidos y errores traducidos sin filtrar detalles |
| A10 | Falsificación de peticiones del lado del servidor | Cumplido | Destinos de salida fijos, nunca construidos con entrada del usuario     |

---

## A01 — Pérdida de control de acceso

El riesgo más frecuente según OWASP, y el que más superficie tiene en este sistema: un docente no
debe ver la información de otro, y nadie debe aprobar su propia planeación.

**Controles implementados**

_Cerrado por omisión._ El guard de autenticación se registra de forma global, así que toda ruta
nace protegida. El acceso público debe declararse de manera explícita con el decorador `@Publico()`.
Una ruta nueva está protegida aunque el desarrollador olvide pensarlo.

→ `backend/src/app.module.ts`, `backend/src/common/guards/jwt-auth.guard.ts`

_Autorización por rol declarativa._ El decorador `@Roles()` declara qué roles admite cada ruta y
un guard central lo verifica, en lugar de repetir comprobaciones dentro de cada controlador.

→ `backend/src/common/guards/roles.guard.ts`, `backend/src/common/decorators/roles.decorator.ts`

_El filtro de propiedad se impone en el servidor._ Cuando un docente consulta planeaciones, el
servicio sobrescribe cualquier filtro de usuario que venga en la petición con el identificador del
usuario autenticado. Enviar `?usuarioId=otro` no cambia el resultado.

→ `backend/src/modules/planeaciones/planeaciones.service.ts`, método `listar`

_Prevención de referencia directa insegura a objetos._ Antes de devolver un registro por
identificador se verifica que pertenezca al solicitante, o que quien pregunta sea coordinación.

→ método privado `verificarAcceso` en cada servicio

**Cómo comprobarlo**

Colección de Postman, carpeta **07 - Control de acceso**: un docente autenticado recibe 403 al
pedir los reportes, al dictaminar una planeación y al validar una constancia. Y la petición
_"Filtro de usuario ignorado para el docente"_ en la carpeta 03 demuestra que el parámetro enviado
por el cliente se descarta.

---

## A02 — Fallas criptográficas

**Controles implementados**

_Las contraseñas nunca se almacenan en claro._ Se guarda únicamente el hash bcrypt con diez
rondas. La función de verificación compara en tiempo constante, lo que evita deducir la
contraseña midiendo cuánto tarda la respuesta.

→ `backend/src/modules/auth/auth.service.ts`, líneas 61 y 86

_El token se firma y expira._ Vigencia de ocho horas por omisión, configurable por entorno. El
secreto se inyecta como variable y nunca aparece en el repositorio.

→ `backend/src/modules/auth/auth.module.ts`

_El hash nunca sale de la capa de datos._ Un DTO de salida construye el perfil público; el campo
`password` no existe en ninguna respuesta de la API.

→ método privado `aPerfilPublico`

_Cifrado en tránsito._ La plataforma de despliegue termina TLS y redirige HTTP a HTTPS de forma
automática, con certificado renovado sin intervención.

**Cómo comprobarlo**

La prueba unitaria _"nunca expone el hash de la contraseña en la respuesta"_ en
`auth.service.spec.ts`, y el candado del navegador en el dominio público.

---

## A03 — Inyección

**Controles implementados**

_Consultas parametrizadas._ Todo el acceso a datos pasa por el ORM, que separa la sentencia de
los valores. No existe concatenación de cadenas SQL en el proyecto.

→ `backend/src/modules/*/*.repository.ts` y los servicios

_Validación con lista blanca._ El pipe global está configurado con `whitelist: true` y
`forbidNonWhitelisted: true`: las propiedades no declaradas en el DTO no solo se descartan, hacen
fallar la petición. Esto previene la asignación masiva de atributos, que es como un atacante
intentaría elevarse a coordinador enviando `rol` en el cuerpo del inicio de sesión.

→ `backend/src/main.ts`, líneas 43 y 44

_Validación de tipo y rango._ Cada campo declara sus restricciones con decoradores: formato de
correo, longitud mínima, enumeraciones cerradas, rangos numéricos.

→ `backend/src/modules/*/dto/`

**Cómo comprobarlo**

La petición _"Propiedad no declarada en el contrato"_ de la carpeta 01 envía `rol: COORDINADOR`
junto con credenciales válidas y recibe 400. La prueba funcional equivalente está en
`test/app.e2e-spec.ts`.

---

## A04 — Diseño inseguro

Este principio no se resuelve con una biblioteca: exige que las reglas estén en el diseño.

**Controles implementados**

_Transiciones de estado controladas._ Una planeación aprobada no se modifica ni se elimina; una
constancia validada no se borra porque sus horas ya cuentan en indicadores emitidos. El estado de
un avance no lo elige el usuario: se deriva del porcentaje mediante umbrales institucionales, de
modo que el indicador sea comparable entre docentes.

→ `planeaciones.service.ts`, `evidencias.service.ts`, `avances.service.ts`

_Restricciones de unicidad en el modelo._ Una sola planeación por docente, materia, periodo y
parcial, garantizada por la base de datos y no solo por la aplicación.

→ `backend/prisma/schema.prisma`, índice `planeacion_unica`

_Validación de archivos antes del envío._ Lista blanca de tipos (PDF, JPG, PNG) y límite de 5 MB,
verificados antes de enviar el archivo a ningún destino. El nombre original nunca se usa como
ruta: se sustituye por un identificador generado, lo que cierra el recorrido de directorios.

→ `backend/src/integrations/cloudinary/cloudinary.service.ts`

**Cómo comprobarlo**

Las pruebas _"no usa el nombre original del archivo como ruta"_ y _"rechaza un tipo de archivo no
permitido"_ en `cloudinary.service.spec.ts`, y las peticiones de baja bloqueada en las carpetas 03
y 05 de Postman.

---

## A05 — Configuración de seguridad defectuosa

**Controles implementados**

_Cabeceras HTTP endurecidas._ Helmet se aplica a toda la aplicación, y Nginx agrega
`X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` en el borde.

→ `backend/src/main.ts` línea 22; `infra/nginx/balanceador.conf`; `frontend/nginx.conf`

_Origen cruzado restringido._ CORS admite únicamente los orígenes declarados por configuración;
no se usa comodín en ningún entorno.

→ `backend/src/main.ts`, líneas 28 a 38

_Contenedor sin privilegios._ El proceso corre como el usuario `node`, no como root. Si alguien
lograra ejecutar código dentro del contenedor, no tendría privilegios administrativos.

→ `backend/Dockerfile`, línea 82

_Configuración externalizada._ Ninguna credencial vive en el código. Toda la configuración se
inyecta por entorno y se gestiona como secreto en la plataforma.

→ `backend/.env.example`, `render.yaml`

_Secreto obligatorio._ La orquestación se detiene con un mensaje explícito si `JWT_SECRET` no está
definido, en lugar de arrancar con un valor débil por omisión.

→ `infra/compose.yaml`

---

## A06 — Componentes vulnerables y desactualizados

**Controles implementados**

_Auditoría en cada integración._ El flujo de integración continua ejecuta `npm audit
--audit-level=high` sobre el backend y el frontend en cada Pull Request.

→ `.github/workflows/ci.yml`, pasos de auditoría

_Vigilancia programada._ Dependabot revisa semanalmente las dependencias de ambos proyectos, y
mensualmente las acciones de los flujos de trabajo y las imágenes base de los contenedores. Abre
el Pull Request con la corrección sin esperar a que haya trabajo pendiente.

→ `.github/dependabot.yml`

_Versiones ancladas._ `package-lock.json` está versionado y la integración continua usa `npm ci`,
que instala exactamente el árbol registrado en lugar de resolver versiones nuevas.

---

## A07 — Fallas de identificación y autenticación

**Controles implementados**

_Respuesta uniforme._ Un correo inexistente y una contraseña incorrecta producen el mismo mensaje
y el mismo código. La respuesta no permite enumerar qué cuentas existen.

→ `auth.service.ts`, constante `credencialesInvalidas`, líneas 53 a 64

_El usuario se valida en cada petición._ La estrategia del token consulta la base en cada acceso
en lugar de confiar únicamente en lo que el token afirma. Una cuenta desactivada pierde el acceso
de inmediato, sin esperar a que expire su token.

→ `backend/src/modules/auth/strategies/jwt.strategy.ts`

_Longitud mínima de contraseña._ Ocho caracteres, verificados en el DTO antes de llegar al
servicio.

_Federación de identidad._ El acceso con Google OAuth2 delega la verificación en un proveedor
externo. El token propio viaja en el fragmento de la URL y no en la cadena de consulta: el
fragmento no se envía al servidor, así que no queda registrado en bitácoras de acceso ni en el
encabezado de referencia.

→ `backend/src/modules/auth/auth.controller.ts`, método `callbackGoogle`

**Cómo comprobarlo**

Las peticiones _"Credenciales incorrectas"_ y _"Correo inexistente"_ de la carpeta 01 comparan los
dos mensajes y verifican que sean idénticos.

---

## A08 — Fallas de integridad del software y los datos

**Controles implementados**

_Ramas protegidas._ Ningún cambio llega a `main` ni a `develop` sin pasar por Pull Request. La
regla no admite actores con derecho a saltarse la política.

→ ruleset del repositorio, verificable con `gh api repos/OWNER/REPO/rulesets`

_Verificaciones obligatorias._ El merge está condicionado a tres comprobaciones automáticas:
construcción y pruebas del backend, del frontend, y validación de las políticas del Pull Request.

_Acciones de terceros ancladas por versión mayor._ `actions/checkout@v4`,
`actions/setup-node@v4`, `github/codeql-action@v3`, `actions/github-script@v7`. Dependabot vigila
sus actualizaciones.

_Historial íntegro._ La reescritura del historial está bloqueada en las ramas protegidas, así que
un cambio integrado no puede borrarse del registro.

_Integridad de las dependencias._ `npm ci` verifica el árbol contra el archivo de bloqueo, que
incluye las sumas de verificación de cada paquete.

---

## A09 — Fallas de registro y monitoreo

**Controles implementados**

_Intentos de acceso fallidos registrados._ Cada fallo de autenticación deja constancia con el
correo utilizado, lo que permite detectar un ataque por fuerza bruta.

→ `auth.service.ts`, línea 63

_Errores traducidos sin filtrar detalles internos._ Un filtro de excepciones convierte los errores
del ORM en respuestas HTTP interpretables. El detalle técnico se registra en el servidor; al
cliente no le llegan nombres de tabla, consultas ni trazas de pila que revelen la estructura del
sistema.

→ `backend/src/common/filters/prisma-exception.filter.ts`

_Punto de verificación de estado._ El endpoint `/api/salud` informa si la instancia está
operativa y cuál es. Lo consultan el balanceador, la orquestación y la plataforma de despliegue.

→ `backend/src/app.controller.ts`

_Trazabilidad de las decisiones._ Toda revisión de planeación y validación de constancia registra
quién la hizo y cuándo, de forma permanente en la base.

→ campos `revisadoPor`, `revisadoEn`, `validadoPor`, `validadoEn` en el esquema

**Cómo comprobarlo**

La petición _"Identificador inexistente"_ de la carpeta 07 verifica que la respuesta no contenga
la palabra `prisma`, y la prueba funcional equivalente comprueba que tampoco incluya trazas de
pila.

---

## A10 — Falsificación de peticiones del lado del servidor

El riesgo aparece cuando el servidor hace peticiones a direcciones que el usuario controla.

**Controles implementados**

_Destinos de salida fijos._ El sistema realiza exactamente tres tipos de petición saliente, las
tres hacia direcciones definidas por configuración y nunca construidas con entrada del usuario:

| Destino       | Dónde se define                                 | Qué recibe del usuario                    |
| ------------- | ----------------------------------------------- | ----------------------------------------- |
| Nager.Date    | `NAGER_DATE_URL` más año y país                 | Nada: el año proviene del periodo en base |
| Cloudinary    | Biblioteca oficial, con credenciales de entorno | El contenido del archivo, no su destino   |
| Google OAuth2 | Biblioteca oficial, con credenciales de entorno | Nada                                      |

→ `backend/src/integrations/festivos/festivos.service.ts` línea 60;
`backend/src/integrations/cloudinary/cloudinary.service.ts` línea 114

_Sin redirecciones controladas por el usuario._ La única redirección del sistema, al concluir el
acceso federado, usa la dirección configurada en `FRONTEND_URL` y no un parámetro de la petición.

_Tiempo de espera acotado._ Las llamadas salientes tienen límite de cinco segundos, de modo que un
destino que no responde no agota los recursos del servidor.

---

## Verificación automática

Además de los controles anteriores, el repositorio ejecuta análisis estático en cada cambio:

| Herramienta                              | Cuándo                            | Qué detecta                                              |
| ---------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| CodeQL con consultas `security-extended` | Push, Pull Request y semanalmente | Patrones de vulnerabilidad en el código                  |
| `npm audit --audit-level=high`           | Cada Pull Request                 | Dependencias con vulnerabilidad conocida                 |
| ESLint con información de tipos          | Pre-commit y Pull Request         | Defectos de seguridad de tipos en las fronteras externas |

Los hallazgos de CodeQL se consultan en la pestaña **Security → Code scanning** del repositorio.

---

## Alcance de esta verificación

Conviene ser preciso sobre qué respalda este documento. Lo que aquí se afirma está verificado por
inspección de código, por las 118 pruebas automatizadas y por la colección de pruebas manuales.
**No se realizó una prueba de penetración** ni un análisis dinámico de la aplicación en ejecución.

Un sistema que gestionara datos personales en producción requeriría además, como mínimo: limitación
de intentos de acceso por dirección, rotación de secretos, bitácora centralizada con alertas, y
una revisión de seguridad independiente.
