# Políticas de control de versiones

Documento normativo del repositorio SIPLAD. Define la estrategia de ramificación, el control de
accesos, las políticas de integración y las reglas de revisión de cambios.

---

## 1. Plataforma y configuración

| Elemento | Definición |
|---|---|
| Sistema de control de versiones | Git |
| Plataforma de alojamiento | GitHub |
| Visibilidad del repositorio | Público |
| Rama de producción | `main` |
| Rama de integración | `develop` |
| Gestión de la planeación | GitHub Projects con issues enlazados |
| Automatización | GitHub Actions |

El flujo adoptado es **GitFlow simplificado**, elegido porque separa de forma explícita el código
liberable del código en construcción sin introducir la complejidad de ramas `release` y `hotfix`,
innecesarias en un proyecto de un solo periodo de ejecución.

## 2. Nomenclatura de ramas

Toda rama de trabajo parte de `develop` y respeta el patrón:

```
<tipo>/<numero-de-issue>-<descripcion-corta-en-kebab-case>
```

| Tipo | Uso | Ejemplo |
|---|---|---|
| `feat` | Nueva funcionalidad | `feat/14-evidencias-capacitacion` |
| `fix` | Corrección de defecto | `fix/27-validacion-horas-acreditadas` |
| `docs` | Documentación | `docs/24-manual-de-despliegue` |
| `test` | Pruebas unitarias o funcionales | `test/19-pruebas-servicio-planeacion` |
| `refactor` | Reestructuración sin cambio funcional | `refactor/16-capa-integracion` |
| `ci` | Automatización y flujos de trabajo | `ci/02-workflow-codeql` |
| `chore` | Configuración y mantenimiento | `chore/01-configuracion-inicial` |

Reglas complementarias:

- El nombre se escribe en minúsculas, sin acentos ni caracteres especiales.
- La descripción no excede cinco palabras.
- Toda rama incluye el número del issue que le da origen, lo que garantiza la trazabilidad entre
  la planeación y el código.
- Una rama se elimina automáticamente después de integrarse.

## 3. Nomenclatura de commits

Se adopta la especificación **Conventional Commits**:

```
<tipo>(<alcance opcional>): <descripcion en presente>
```

Ejemplos válidos:

```
feat(planeacion): registrar planeacion didactica por materia y parcial
fix(auth): corregir expiracion del token de refresco
test(avances): agregar pruebas unitarias del servicio de avances
```

Esta convención permite generar historial legible y es verificada automáticamente por el flujo de
trabajo de validación de Pull Request.

## 4. Acceso de usuarios

| Rol | Permiso en GitHub | Atribuciones |
|---|---|---|
| Propietario del repositorio | `Admin` | Configura la protección de ramas, los secretos y las integraciones. Único rol con capacidad de modificar las políticas. |
| Desarrollador | `Write` | Crea ramas y Pull Requests. No puede escribir directamente en `main` ni en `develop`. |
| Revisor | `Triage` | Comenta, etiqueta y aprueba Pull Requests. No integra cambios. |
| Consulta | `Read` | Acceso de solo lectura al código y a la planeación. |

Al tratarse de un proyecto individual, el autor conserva el rol `Admin`, pero la protección de
ramas se mantiene activa para que ningún cambio llegue a `main` sin pasar por Pull Request. Esta
decisión es deliberada: las reglas se aplican sobre el proceso, no sobre la identidad de quien
contribuye.

Los secretos del repositorio (credenciales de base de datos, claves de Cloudinary y del proveedor
OAuth2) se almacenan exclusivamente en **GitHub Secrets** y nunca en el código fuente.

## 5. Políticas de merge

| Rama destino | Origen permitido | Estrategia de integración | Requisitos |
|---|---|---|---|
| `develop` | `feat/*`, `fix/*`, `test/*`, `refactor/*`, `docs/*`, `ci/*`, `chore/*` | **Squash and merge** | Flujos de trabajo de CI en verde y revisión aprobada |
| `main` | `develop` | **Merge commit** | Todos los flujos de trabajo en verde, incluido CodeQL |

Criterios obligatorios antes de integrar:

1. Prohibido el push directo a `main` y a `develop`; la protección de ramas lo bloquea.
2. El Pull Request debe tener al menos una aprobación.
3. Los tres flujos de trabajo de automatización deben finalizar correctamente.
4. La rama debe estar actualizada respecto a su destino antes de integrarse.
5. No se permite integrar con conversaciones de revisión sin resolver.
6. Se prohíbe la reescritura del historial (`force push`) en ramas protegidas.

Se utiliza *squash* hacia `develop` para que cada funcionalidad quede representada por un solo
commit significativo, y *merge commit* hacia `main` para preservar el punto exacto de cada
liberación.

## 6. Políticas de Pull Request

Todo cambio llega al repositorio mediante Pull Request. Un PR válido cumple:

- **Título** conforme a Conventional Commits, verificado automáticamente.
- **Issue enlazado** mediante una palabra clave de cierre (`Closes #14`), verificado
  automáticamente. Esto mantiene la planeación de GitHub Projects sincronizada con el código.
- **Descripción** que explique el qué, el porqué y la forma de probar el cambio, siguiendo la
  plantilla del repositorio.
- **Alcance acotado**: un Pull Request resuelve un solo issue.
- **Evidencia visual** cuando el cambio afecta la capa de presentación.
- **Etiqueta de tamaño**, asignada automáticamente según las líneas modificadas.

Un Pull Request que no supere las validaciones automáticas no puede integrarse, con independencia
de quién lo haya abierto.

## 7. Evidencia de control de versiones desde tres medios

El proyecto demuestra el uso de Git desde los tres entornos exigidos:

| Medio | Operaciones demostradas |
|---|---|
| Línea de comandos | `git init`, `git switch -c`, `git add`, `git commit`, `git push`, `git merge`, `git log --graph` |
| Entorno de desarrollo integrado | Control de código fuente de Visual Studio Code: *stage*, *commit*, *push*, cambio de rama y resolución de conflictos |
| GitHub | Creación de issues, tablero del Project, apertura y revisión de Pull Requests, ejecución de flujos de trabajo y edición directa de archivos |

## 8. Automatización asociada

| Flujo de trabajo | Disparador | Función |
|---|---|---|
| `ci.yml` | Push y Pull Request sobre `main` y `develop` | Instala dependencias, compila, ejecuta pruebas unitarias y audita dependencias |
| `codeql.yml` | Push, Pull Request y programación semanal | Análisis estático de seguridad del código conforme a OWASP |
| `pr-checks.yml` | Apertura y edición de Pull Request | Valida título, exige issue enlazado y etiqueta por tamaño |
