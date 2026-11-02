# Metodología de desarrollo ágil

Documento de la fase de inicio del proyecto SIPLAD. Justifica la metodología seleccionada y
define los roles, las iteraciones y los entregables del proceso.

---

## 1. Metodología seleccionada

**Scrum adaptado a un equipo de un solo integrante**, con tablero Kanban de apoyo sobre GitHub
Projects para la visualización del flujo de trabajo.

## 2. Justificación

### 2.1 Requisitos sujetos a validación con el usuario institucional

La aplicación atiende a tres perfiles con necesidades distintas (profesorado, coordinación
académica y dirección). Los criterios de aprobación de una planeación didáctica y los indicadores
que la dirección considera relevantes no pueden especificarse por completo al inicio: se refinan
conforme la coordinación observa el comportamiento del sistema. Scrum admite este refinamiento
porque el alcance de cada iteración se negocia al comenzarla, no al firmar el proyecto.

### 2.2 Entregas incrementales que permiten valor desde la primera iteración

El sistema se compone de cuatro módulos funcionalmente independientes. La gestión de planeación
didáctica aporta valor aunque los reportes institucionales todavía no existan. Scrum ordena el
trabajo en incrementos potencialmente liberables, lo que permite que la institución comience a
registrar planeaciones mientras el resto de los módulos continúa en desarrollo. Una metodología
secuencial obligaría a esperar a la fase de implementación completa para obtener el primer
beneficio.

### 2.3 Trazabilidad directa entre planeación, código y evidencia

Cada elemento del Product Backlog se representa como un issue de GitHub, se incorpora al Project
con responsable, periodo de ejecución y estado, y se enlaza a la rama y al Pull Request que lo
resuelve. Esta correspondencia uno a uno entre lo planeado y lo construido es un requisito
explícito del proyecto y es inherente al marco de trabajo de Scrum apoyado en GitHub Projects.

### 2.4 Compatibilidad con integración continua y despliegue continuo

El proyecto exige automatización de pruebas, escaneo de seguridad y despliegue en contenedores.
Scrum define la *Definition of Done* como condición de cierre de cada elemento del backlog, lo que
encaja de forma natural con las verificaciones automáticas de GitHub Actions: un incremento no se
considera terminado hasta que compila, supera sus pruebas y pasa el análisis estático de seguridad.

### 2.5 Gestión del riesgo en un periodo de ejecución comprimido

El periodo disponible es corto y el alcance es amplio. Scrum mitiga este riesgo mediante
iteraciones cortas con revisión al cierre de cada una, lo que permite detectar desviaciones de
forma temprana y repriorizar el backlog. Los elementos de menor valor se desplazan a iteraciones
posteriores sin comprometer la liberación de los módulos críticos.

### 2.6 Adecuación al tamaño real del equipo

Scrum es escalable a la baja. Con un solo integrante se conservan los artefactos que aportan valor
(Product Backlog, Sprint Backlog, Incremento) y las ceremonias se condensan en revisiones de
cierre de iteración documentadas en el Project, evitando la sobrecarga administrativa que impondría
una metodología tradicional como RUP o el modelo en cascada.

## 3. Roles

| Rol | Responsable | Atribuciones |
|---|---|---|
| Product Owner | Coordinación académica (interlocutor del caso de estudio) | Define y prioriza el Product Backlog, acepta los incrementos |
| Scrum Master | Gilberto Fabián Correa González | Asegura el cumplimiento del proceso, elimina impedimentos |
| Equipo de desarrollo | Gilberto Fabián Correa González | Analiza, diseña, construye, prueba y despliega el incremento |

## 4. Iteraciones

| Iteración | Objetivo | Entregable |
|---|---|---|
| Sprint 0 — Configuración | Establecer el proceso, la arquitectura y el entorno | Repositorio configurado, políticas, automatizaciones y proyectos base inicializados |
| Sprint 1 — Identidad y seguridad | Autenticación, autorización y modelo de datos | Esquema de base de datos, JWT, OAuth2 y control de acceso por roles |
| Sprint 2 — Módulos funcionales | Construir los cuatro módulos del sistema | Web Services de planeación, avances, evidencias y reportes con su interfaz |
| Sprint 3 — Pruebas y liberación | Verificar, contenerizar y desplegar | Suite de pruebas, contenedores, despliegue en la nube y documentación |

## 5. Artefactos

| Artefacto | Soporte |
|---|---|
| Product Backlog | Issues del repositorio, priorizados por etiqueta |
| Sprint Backlog | Vista del Sprint activo en GitHub Projects |
| Tablero de flujo | Columnas *Por hacer*, *En progreso* y *Terminado* |
| Incremento | Rama `main`, desplegada automáticamente en el entorno de nube |

## 6. Definition of Done

Un elemento del backlog se considera terminado cuando cumple simultáneamente:

1. El código está integrado en `develop` mediante Pull Request aprobado.
2. El flujo de trabajo de integración continua finaliza correctamente.
3. El análisis estático de CodeQL no reporta hallazgos de severidad alta.
4. Existe al menos una prueba automatizada que cubre el comportamiento implementado.
5. El issue correspondiente está cerrado y reflejado en el estado del Project.
