# Arquitectura del software

Documento de la fase de inicio del proyecto SIPLAD. Justifica la arquitectura seleccionada,
describe sus capas, el flujo de datos, los patrones de diseño aplicados y el entorno de ejecución
de cada componente.

---

## 1. Arquitectura seleccionada

**Arquitectura multicapa (n-capas)** con separación estricta de responsabilidades y dependencia
unidireccional entre capas.

### 1.1 Justificación

| Criterio | Cómo lo resuelve la arquitectura multicapa |
|---|---|
| Escalabilidad | Cada capa se escala de forma independiente. El servidor de aplicaciones puede replicarse detrás de un balanceador sin tocar la base de datos ni el cliente. |
| Mantenibilidad | Un cambio en la regla de cálculo del cumplimiento se confina a la capa de lógica de negocio y no obliga a modificar la interfaz ni el esquema de datos. |
| Seguridad | La capa de presentación nunca accede directamente a la base de datos. Toda petición atraviesa los controles de autenticación y autorización de la capa de lógica de negocio. |
| Facilidad de integración | Los servicios externos se consumen exclusivamente desde la capa de integración, lo que permite sustituir un proveedor sin propagar el cambio al dominio. |
| Verificabilidad | Al estar aislada de la infraestructura, la lógica de negocio se somete a pruebas unitarias sin levantar base de datos ni red. |

La regla de dependencia es estricta: **una capa solo conoce a la capa inmediatamente inferior**.
La capa de presentación desconoce por completo la existencia de Prisma; la capa de lógica de
negocio desconoce qué proveedor concreto almacena los archivos.

## 2. Capas

| Capa | Responsabilidad | Componentes | Tecnología |
|---|---|---|---|
| **Presentación** | Renderizado, captura de datos, navegación condicionada por rol y visualización de indicadores | Vistas, componentes, cliente HTTP, contexto de sesión | React, Vite, TailwindCSS, Recharts, Axios |
| **Lógica de negocio** | Reglas del dominio, validación, autorización y orquestación de casos de uso | Controladores, servicios, guards, DTOs | NestJS, class-validator, Passport |
| **Datos** | Persistencia, consultas y agregaciones | Repositorios, esquema, migraciones | Prisma ORM, PostgreSQL |
| **Integración** | Comunicación con servicios de terceros | Clientes de proveedor externo | Google OAuth2, Cloudinary, Nager.Date |
| **Pruebas** | Verificación automatizada y manual de todas las capas | Pruebas unitarias, funcionales y colección manual | Jest, Supertest, Postman |

## 3. Flujo de datos

Trayectoria de una petición representativa — *un docente registra el avance de su segundo parcial*:

1. **Presentación.** El formulario valida el formato en el cliente y envía la petición mediante el
   cliente HTTP, adjuntando el token de sesión en la cabecera `Authorization`.
2. **Lógica de negocio — borde de seguridad.** El guard de autenticación verifica la firma y la
   vigencia del token. El guard de autorización comprueba que el rol sea `PROFESOR` y que el
   recurso pertenezca al solicitante. Una petición que no supere este punto no avanza.
3. **Lógica de negocio — validación.** El DTO rechaza cualquier campo no declarado y verifica
   tipos, rangos y enumeraciones antes de que los datos lleguen al servicio.
4. **Lógica de negocio — dominio.** El servicio confirma que exista una planeación aprobada para
   esa materia y parcial, que no haya ya un avance registrado y recalcula el indicador de
   cumplimiento.
5. **Datos.** El repositorio persiste el avance dentro de una transacción mediante consultas
   parametrizadas generadas por el ORM.
6. **Respuesta.** El servicio devuelve un DTO de salida que excluye los campos internos; la capa
   de presentación actualiza la gráfica de cumplimiento.

Cuando el caso de uso requiere un servicio externo —la carga de una constancia de capacitación—
la capa de lógica de negocio no invoca al proveedor de forma directa: delega en la capa de
integración, que devuelve una referencia ya normalizada al dominio.

## 4. Patrones de diseño aplicados

### 4.1 Patrones creacionales

**Inyección de dependencias con alcance Singleton.** El contenedor del framework instancia cada
servicio una sola vez y lo inyecta donde se declara. El servicio de planeación recibe el
repositorio sin conocer su construcción, lo que permite sustituirlo por un doble de prueba.
*Aporta:* verificabilidad y bajo acoplamiento.

**Factory Method en la configuración asíncrona.** Los módulos de base de datos, JWT y
almacenamiento externo se registran mediante fábricas que resuelven sus parámetros en tiempo de
arranque a partir de variables de entorno. *Aporta:* un mismo código se despliega en desarrollo,
pruebas y nube sin recompilarse.

### 4.2 Patrones estructurales

**Repository.** Cada agregado del dominio expone un repositorio que encapsula el acceso a datos.
La lógica de negocio pide *registrar un avance*, no *ejecutar una sentencia*. *Aporta:*
sustituibilidad del motor de persistencia y centralización de las consultas.

**Data Transfer Object.** Las fronteras de entrada y salida están tipadas. Los DTO de entrada
rechazan propiedades no declaradas, lo que evita la asignación masiva de atributos; los de salida
omiten los campos internos. *Aporta:* seguridad y contrato explícito de cada Web Service.

**Adapter.** Cada servicio de terceros se consume a través de un cliente propio que traduce su
respuesta al modelo del dominio. Cambiar de proveedor de almacenamiento afecta a una sola clase.
*Aporta:* facilidad de integración.

**Decorator.** Los metadatos de rutas, validación, roles y documentación se declaran mediante
decoradores sobre controladores y propiedades, sin alterar el cuerpo de los métodos. *Aporta:*
legibilidad y separación de preocupaciones transversales.

### 4.3 Patrones de comportamiento

**Strategy.** La autenticación admite dos estrategias intercambiables, local con JWT y federada
con OAuth2, bajo una misma interfaz. Incorporar un tercer proveedor no modifica a los
consumidores. *Aporta:* extensibilidad.

**Chain of Responsibility.** Toda petición atraviesa una cadena ordenada de middleware, guards,
pipes de validación e interceptores. Cualquier eslabón puede detener el procesamiento.
*Aporta:* controles de seguridad aplicados de forma uniforme y no por repetición en cada
controlador.

### 4.4 Patrones emergentes

**Modularidad por dominio.** El sistema se organiza en módulos autocontenidos —autenticación,
planeación, avances, evidencias y reportes— que declaran de forma explícita lo que exponen y lo
que consumen. *Aporta:* escalabilidad organizativa y posibilidad de extraer un módulo como
servicio independiente.

**Configuración externalizada.** Ninguna credencial ni dirección de servicio vive en el código.
Toda la configuración se inyecta por entorno y se gestiona como secreto en la plataforma de
despliegue. *Aporta:* cumplimiento del principio de separación entre código y configuración, y
mitigación de la exposición de credenciales.

## 5. Entorno de ejecución

| Componente | Entorno de desarrollo | Entorno de producción |
|---|---|---|
| Capa de presentación | Servidor de desarrollo de Vite en el equipo local | Sitio estático servido por Nginx dentro de contenedor, publicado en la plataforma de nube |
| Capa de lógica de negocio | Proceso Node.js en modo observador | Contenedor Docker sobre Node.js, replicado detrás de un balanceador de carga |
| Capa de datos | PostgreSQL en contenedor local | Servicio de base de datos administrado en la nube, con conexión cifrada |
| Capa de integración | Credenciales de prueba de cada proveedor | Credenciales de producción almacenadas como secretos de la plataforma |
| Capa de pruebas | Ejecución local y en cada Pull Request | Ejecución automática en GitHub Actions antes de cada integración |

El tráfico externo llega siempre por HTTPS con certificado TLS gestionado por la plataforma. El
balanceador distribuye las peticiones entre las réplicas del servidor de aplicaciones, que es
sin estado: la sesión viaja en el token, no en memoria, lo que permite agregar o retirar réplicas
sin afectar a los usuarios conectados.

## 6. Diagrama de arquitectura

> Pendiente: se incorpora en `docs/diagramas/arquitectura.png` junto con la representación del
> flujo de datos descrito en la sección 3.
