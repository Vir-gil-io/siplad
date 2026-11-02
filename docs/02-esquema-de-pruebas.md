# Esquema de pruebas

Documento de la fase de inicio del proyecto SIPLAD. Define, antes de escribir la primera línea de
código de producción, los tipos de prueba que se aplicarán, las herramientas seleccionadas, el
alcance de cada tipo y los criterios de aceptación.

---

## 1. Tipos de prueba considerados

El proyecto contempla dos tipos de prueba, conforme a lo establecido en la fase de inicio:

| Tipo | Propósito | Nivel | Ejecución |
|---|---|---|---|
| **Pruebas unitarias** | Verificar de forma aislada la lógica de negocio de cada servicio, sin dependencias externas reales | Componente | Automática, en cada Pull Request |
| **Pruebas funcionales** | Verificar que cada Web Service responde conforme a su contrato y que los flujos de usuario se completan de extremo a extremo | Integración y sistema | Automática y manual |

## 2. Pruebas unitarias

### 2.1 Herramienta

**Jest**, incluido de forma nativa en el ecosistema de NestJS, acompañado de los dobles de prueba
del propio framework para sustituir el acceso a base de datos y los clientes de servicios externos.

### 2.2 Alcance

Se somete a prueba la capa de lógica de negocio:

| Unidad bajo prueba | Comportamientos verificados |
|---|---|
| `AuthService` | Emisión y validación de token, rechazo de credenciales inválidas, cifrado de contraseña |
| `PlaneacionService` | Alta de planeación, transición de estados, rechazo de duplicados por materia y parcial |
| `AvanceService` | Cálculo del porcentaje de cumplimiento, validación del estado cumplido, parcial o no cumplido |
| `EvidenciaService` | Validación de horas acreditadas, formato de archivo permitido, flujo de aprobación |
| `ReporteService` | Agregación de indicadores por profesor, materia y parcial |

### 2.3 Criterios de aceptación

- Cobertura mínima del **70 %** sobre la capa de servicios.
- Ninguna prueba unitaria accede a la base de datos real ni a servicios de terceros.
- Toda regla de negocio cuenta con al menos un caso positivo y un caso negativo.
- La suite completa se ejecuta en menos de treinta segundos.

## 3. Pruebas funcionales

### 3.1 Herramientas

| Herramienta | Modalidad | Uso |
|---|---|---|
| **Supertest** | Automatizada | Invoca los endpoints HTTP del backend sobre una instancia real de la aplicación y valida códigos de estado, estructura de respuesta y reglas de autorización |
| **Postman** | Manual | Colección documentada de peticiones por módulo, utilizada para la verificación manual y como evidencia visual del funcionamiento de los Web Services |

### 3.2 Alcance

| Flujo | Verificación |
|---|---|
| Autenticación local | Inicio de sesión válido devuelve token; credenciales incorrectas devuelven 401 |
| Autenticación federada | El flujo OAuth2 con el proveedor externo concluye con una sesión válida |
| Autorización por rol | Un profesor no puede aprobar planeaciones; un coordinador sí. Acceso indebido devuelve 403 |
| Registro de planeación | Alta, consulta, modificación y consulta del historial de ciclos anteriores |
| Revisión de planeación | La coordinación aprueba o solicita ajustes y el estado se refleja en la consulta |
| Registro de avances | Alta del avance por parcial y recálculo del indicador de cumplimiento |
| Carga de evidencias | Envío de archivo, almacenamiento en el servicio externo y validación por coordinación |
| Reportes | Generación de indicadores y exportación a PDF y a Excel |

### 3.3 Criterios de aceptación

- Los cinco Web Services de autoría propia cuentan con pruebas funcionales automatizadas.
- Todo endpoint protegido se prueba con token válido, token inválido y rol insuficiente.
- La colección de Postman se exporta al repositorio y se documenta con capturas de la ejecución.
- Ninguna prueba funcional depende del estado dejado por otra.

## 4. Pruebas de seguridad asociadas

Aunque no constituyen un tipo independiente dentro del esquema, se incorporan verificaciones
automáticas alineadas con OWASP:

| Verificación | Herramienta | Momento |
|---|---|---|
| Análisis estático de código | CodeQL con consultas de seguridad extendidas | Cada push y Pull Request |
| Auditoría de dependencias vulnerables | `npm audit` | Cada ejecución del flujo de integración continua |
| Revisión manual del Top 10 | Lista de verificación documentada | Antes de la liberación |

## 5. Estrategia de ejecución

| Momento | Pruebas ejecutadas |
|---|---|
| Durante el desarrollo local | Unitarias en modo observador |
| Al abrir un Pull Request | Unitarias, funcionales automatizadas, CodeQL y auditoría de dependencias |
| Antes de integrar a `main` | Suite completa más verificación manual con Postman |
| Después del despliegue | Verificación manual de los flujos críticos en el entorno de nube |

## 6. Entorno de pruebas

Las pruebas funcionales automatizadas se ejecutan contra una instancia de PostgreSQL levantada en
contenedor, independiente de la base de datos de desarrollo y de la de producción. La base se
reinicia antes de cada ejecución de la suite para garantizar resultados reproducibles.
