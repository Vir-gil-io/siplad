#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SIPLAD — Carga automática de la planeación en GitHub
#
# Crea etiquetas, hitos (sprints) e issues del Product Backlog.
# Requiere GitHub CLI autenticado y ejecutarse DENTRO del repositorio clonado.
#
#   Uso:  bash scripts/bootstrap-issues.sh
# ---------------------------------------------------------------------------
set -euo pipefail

command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) no está instalado."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: ejecuta primero 'gh auth login'."; exit 1; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Repositorio detectado: $REPO"
echo

# --------------------------- Etiquetas -------------------------------------
echo "==> Creando etiquetas"
crear_etiqueta () {
  gh label create "$1" --color "$2" --description "$3" --force >/dev/null
  echo "    $1"
}

crear_etiqueta "backend"          "0366d6" "Capa de lógica de negocio y API"
crear_etiqueta "frontend"         "1d76db" "Capa de presentación"
crear_etiqueta "base-de-datos"    "006b75" "Capa de datos y modelo"
crear_etiqueta "integracion"      "5319e7" "Capa de integración con servicios externos"
crear_etiqueta "seguridad"        "b60205" "Autenticación, autorización y OWASP"
crear_etiqueta "infraestructura"  "0e8a16" "Contenedores, nube y despliegue"
crear_etiqueta "pruebas"          "fbca04" "Pruebas unitarias y funcionales"
crear_etiqueta "documentacion"    "d4c5f9" "Documentación y entregables"
crear_etiqueta "prioridad/alta"   "d93f0b" "Bloquea la liberación"
crear_etiqueta "prioridad/media"  "fef2c0" "Necesaria pero no bloqueante"
crear_etiqueta "prioridad/baja"   "c2e0c6" "Deseable"
echo

# ----------------------------- Hitos ---------------------------------------
echo "==> Creando hitos (sprints)"
crear_hito () {
  if gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" -f due_on="$3" --silent 2>/dev/null; then
    echo "    $1"
  else
    echo "    $1 (ya existía)"
  fi
}

crear_hito "Sprint 0 - Configuración"       "Proceso, arquitectura y entorno de desarrollo" "2026-11-02T18:00:00Z"
crear_hito "Sprint 1 - Identidad y seguridad" "Modelo de datos, autenticación y autorización" "2026-11-03T04:00:00Z"
crear_hito "Sprint 2 - Módulos funcionales" "Los cuatro módulos del sistema"                "2026-11-03T16:00:00Z"
crear_hito "Sprint 3 - Pruebas y liberación" "Pruebas, contenedores, nube y documentación"  "2026-11-03T23:00:00Z"
echo

# ----------------------------- Issues --------------------------------------
echo "==> Creando issues del Product Backlog"
crear_issue () {
  local titulo="$1" etiquetas="$2" hito="$3" cuerpo="$4"
  local url
  url=$(gh issue create --title "$titulo" --label "$etiquetas" --milestone "$hito" \
        --assignee "@me" --body "$cuerpo")
  echo "    ${url##*/}  $titulo"
}

S0="Sprint 0 - Configuración"
S1="Sprint 1 - Identidad y seguridad"
S2="Sprint 2 - Módulos funcionales"
S3="Sprint 3 - Pruebas y liberación"

# --- Sprint 0 ---
crear_issue "Configurar repositorio, ramas y políticas de control de versiones" \
  "infraestructura,documentacion,prioridad/alta" "$S0" \
  $'## Objetivo\nDejar el repositorio operativo con la estrategia de ramificación y las políticas de integración documentadas.\n\n## Alcance\n- [ ] Crear ramas `main` y `develop`\n- [ ] Activar protección de rama sobre `main` y `develop`\n- [ ] Publicar las políticas de nomenclatura, acceso, merge y Pull Request\n- [ ] Cargar plantillas de issue y de Pull Request\n\n## Criterio de terminado\nNingún cambio puede llegar a `main` sin Pull Request aprobado.'

crear_issue "Configurar flujos de trabajo de automatización en GitHub Actions" \
  "infraestructura,seguridad,prioridad/alta" "$S0" \
  $'## Objetivo\nAutomatizar la verificación de cada cambio antes de su integración.\n\n## Alcance\n- [ ] Flujo de integración continua: instalación, compilación, pruebas y auditoría de dependencias\n- [ ] Flujo de análisis estático de seguridad con CodeQL\n- [ ] Flujo de validación de Pull Request: título, issue enlazado y etiquetado por tamaño\n\n## Criterio de terminado\nLos tres flujos se ejecutan correctamente sobre un Pull Request de prueba.'

crear_issue "Definir la arquitectura multicapa y elaborar el diagrama" \
  "documentacion,prioridad/alta" "$S0" \
  $'## Objetivo\nEstablecer y representar gráficamente la arquitectura de la aplicación.\n\n## Alcance\n- [ ] Definir las cinco capas: presentación, lógica de negocio, datos, integración y pruebas\n- [ ] Representar el flujo de datos entre capas\n- [ ] Señalar los patrones de diseño aplicados en cada capa\n- [ ] Indicar el entorno de ejecución de cada componente\n\n## Criterio de terminado\nEl diagrama permite entender el sistema sin leer el código.'

crear_issue "Inicializar el backend con NestJS, Prisma y PostgreSQL" \
  "backend,base-de-datos,prioridad/alta" "$S0" \
  $'## Objetivo\nDejar el proyecto de backend ejecutándose en local con acceso a base de datos.\n\n## Alcance\n- [ ] Generar el proyecto NestJS con estructura por módulos\n- [ ] Instalar y configurar Prisma con PostgreSQL\n- [ ] Configurar variables de entorno y archivo de ejemplo\n- [ ] Habilitar validación global y Helmet\n\n## Criterio de terminado\nEl servidor arranca y responde en el endpoint de salud.'

crear_issue "Inicializar el frontend con React, Vite y TailwindCSS" \
  "frontend,prioridad/alta" "$S0" \
  $'## Objetivo\nDejar el proyecto de interfaz ejecutándose en local y comunicándose con la API.\n\n## Alcance\n- [ ] Generar el proyecto con Vite\n- [ ] Configurar TailwindCSS y el enrutado\n- [ ] Configurar el cliente HTTP con la URL base de la API\n- [ ] Definir la estructura de carpetas por módulo\n\n## Criterio de terminado\nLa aplicación compila y consume el endpoint de salud del backend.'

# --- Sprint 1 ---
crear_issue "Modelar la base de datos del sistema" \
  "base-de-datos,prioridad/alta" "$S1" \
  $'## Objetivo\nDefinir el esquema relacional que soporta los cuatro módulos.\n\n## Alcance\n- [ ] Entidades: Usuario, Rol, Materia, PeriodoAcademico, Planeacion, Avance, Evidencia\n- [ ] Relaciones y restricciones de unicidad por materia y parcial\n- [ ] Enumeraciones de estado de planeación y de avance\n- [ ] Migración inicial y datos de siembra\n\n## Criterio de terminado\nLa migración se aplica desde cero sin errores y la siembra carga usuarios de ambos roles.'

crear_issue "Implementar autenticación local con JWT" \
  "backend,seguridad,prioridad/alta" "$S1" \
  $'## Historia\nComo **usuario del sistema** quiero **iniciar sesión con mis credenciales institucionales** para **acceder únicamente a la información que me corresponde**.\n\n## Criterios de aceptación\n- [ ] Las contraseñas se almacenan con hash bcrypt\n- [ ] El inicio de sesión válido devuelve un token firmado con expiración\n- [ ] Las credenciales inválidas devuelven 401 sin revelar cuál campo falló\n- [ ] Existe un guard que protege las rutas privadas\n\n## Capa de la arquitectura\nLógica de negocio y seguridad.'

crear_issue "Integrar autenticación federada con Google OAuth2" \
  "backend,seguridad,integracion,prioridad/alta" "$S1" \
  $'## Historia\nComo **docente** quiero **iniciar sesión con mi cuenta institucional de Google** para **no gestionar una contraseña adicional**.\n\n## Criterios de aceptación\n- [ ] Flujo OAuth2 completo con Passport y el proveedor de Google\n- [ ] El usuario se crea automáticamente en el primer acceso\n- [ ] Al concluir el flujo se emite el token propio del sistema\n- [ ] Las credenciales del proveedor viven en variables de entorno\n\n## Nota\nPrimera de las tres integraciones con API de terceros.'

crear_issue "Implementar control de acceso por roles" \
  "backend,seguridad,prioridad/alta" "$S1" \
  $'## Historia\nComo **coordinación académica** quiero **que cada usuario acceda solo a lo que su rol permite** para **proteger la integridad de la información institucional**.\n\n## Criterios de aceptación\n- [ ] Roles PROFESOR y COORDINADOR definidos en el modelo\n- [ ] Decorador de roles y guard de autorización\n- [ ] Un profesor solo consulta y modifica sus propios registros\n- [ ] Un acceso con rol insuficiente devuelve 403\n\n## Nota\nMitiga OWASP A01 Broken Access Control.'

# --- Sprint 2 ---
crear_issue "Web Service de gestión de planeación didáctica" \
  "backend,prioridad/alta" "$S2" \
  $'## Historia\nComo **docente** quiero **registrar y cargar mi planeación didáctica por materia y parcial** para **dejar constancia de lo planeado al inicio del periodo**.\n\n## Criterios de aceptación\n- [ ] Endpoints de alta, consulta, modificación y baja lógica\n- [ ] Validación de unicidad por docente, materia, parcial y periodo\n- [ ] Carga del archivo de planeación\n- [ ] Solo el autor puede modificar su planeación\n\n## Nota\nPrimero de los cinco Web Services de autoría propia.'

crear_issue "Flujo de revisión y aprobación de la planeación" \
  "backend,frontend,prioridad/alta" "$S2" \
  $'## Historia\nComo **coordinación académica** quiero **revisar, aprobar o solicitar ajustes a una planeación** para **asegurar que cumple los lineamientos institucionales**.\n\n## Criterios de aceptación\n- [ ] Estados: ENVIADA, APROBADA y AJUSTES_SOLICITADOS\n- [ ] La solicitud de ajustes exige un comentario obligatorio\n- [ ] Solo el rol COORDINADOR puede cambiar el estado\n- [ ] El docente consulta el motivo del ajuste solicitado'

crear_issue "Historial de planeaciones de ciclos anteriores" \
  "backend,frontend,prioridad/media" "$S2" \
  $'## Historia\nComo **docente** quiero **consultar mis planeaciones de ciclos anteriores** para **reutilizarlas como referencia**.\n\n## Criterios de aceptación\n- [ ] Consulta filtrada por periodo académico y materia\n- [ ] Las planeaciones de periodos cerrados son de solo lectura\n- [ ] La vista permite descargar el archivo original'

crear_issue "Web Service de control de avances por parcial" \
  "backend,prioridad/alta" "$S2" \
  $'## Historia\nComo **docente** quiero **registrar el avance logrado en cada parcial respecto a mi planeación** para **evidenciar el cumplimiento real**.\n\n## Criterios de aceptación\n- [ ] Estados CUMPLIDO, PARCIAL y NO_CUMPLIDO\n- [ ] El avance se vincula a una planeación aprobada\n- [ ] Cálculo del porcentaje de cumplimiento por docente y materia\n- [ ] No se admite más de un registro por parcial\n\n## Nota\nSegundo Web Service de autoría propia.'

crear_issue "Web Service de evidencias de capacitación con almacenamiento externo" \
  "backend,integracion,prioridad/alta" "$S2" \
  $'## Historia\nComo **docente** quiero **adjuntar las constancias de los cursos que tomé** para **acreditar mi capacitación en el periodo**.\n\n## Criterios de aceptación\n- [ ] Campos: nombre del curso, institución emisora, fecha y horas acreditadas\n- [ ] Carga de archivo PDF o imagen hacia el servicio de almacenamiento externo\n- [ ] Validación de tipo y tamaño de archivo antes de enviarlo\n- [ ] Se persiste únicamente la referencia segura al archivo\n\n## Nota\nTercer Web Service y segunda integración con API de terceros.'

crear_issue "Validación y aprobación de evidencias por coordinación" \
  "backend,frontend,prioridad/media" "$S2" \
  $'## Historia\nComo **coordinación académica** quiero **validar las evidencias cargadas** para **que solo las constancias legítimas cuenten en los indicadores**.\n\n## Criterios de aceptación\n- [ ] Estados PENDIENTE, VALIDADA y RECHAZADA\n- [ ] El rechazo exige motivo\n- [ ] Solo las evidencias validadas suman horas acreditadas en los reportes'

crear_issue "Integrar servicio externo de calendario para los periodos académicos" \
  "backend,integracion,prioridad/media" "$S2" \
  $'## Objetivo\nIncorporar los días inhábiles oficiales al cálculo de los periodos de cada parcial.\n\n## Alcance\n- [ ] Consumo del servicio público de días festivos por país y año\n- [ ] Exclusión de días inhábiles al calcular las fechas límite de cada parcial\n- [ ] Manejo de error con valor de respaldo si el servicio no responde\n\n## Nota\nTercera integración con API de terceros.'

crear_issue "Web Service de reportes institucionales e indicadores" \
  "backend,prioridad/alta" "$S2" \
  $'## Historia\nComo **dirección** quiero **consultar indicadores globales de cumplimiento** para **tomar decisiones sobre el desempeño académico del periodo**.\n\n## Criterios de aceptación\n- [ ] Porcentaje de cumplimiento de planeaciones\n- [ ] Cumplimiento de avances por parcial\n- [ ] Cursos de actualización acreditados por periodo\n- [ ] Agregación por docente, materia y parcial\n\n## Nota\nCuarto Web Service de autoría propia.'

crear_issue "Exportación de reportes a PDF y Excel" \
  "backend,frontend,prioridad/alta" "$S2" \
  $'## Historia\nComo **coordinación académica** quiero **exportar los reportes** para **presentarlos ante instancias que no usan el sistema**.\n\n## Criterios de aceptación\n- [ ] Exportación a PDF con encabezado institucional\n- [ ] Exportación a Excel con los datos tabulados\n- [ ] La exportación respeta los filtros aplicados en pantalla\n\n## Nota\nQuinto Web Service de autoría propia.'

crear_issue "Interfaz de los paneles de docente y de coordinación" \
  "frontend,prioridad/alta" "$S2" \
  $'## Objetivo\nConstruir las vistas que consumen los Web Services del sistema.\n\n## Alcance\n- [ ] Pantalla de inicio de sesión con acceso local y federado\n- [ ] Panel del docente: planeaciones, avances y evidencias\n- [ ] Panel de coordinación: bandeja de revisión y validación\n- [ ] Gráficas de cumplimiento por docente, materia y parcial\n- [ ] Navegación condicionada por rol\n\n## Criterio de terminado\nLos cuatro módulos son operables desde la interfaz.'

# --- Sprint 3 ---
crear_issue "Pruebas unitarias de la capa de lógica de negocio" \
  "pruebas,prioridad/alta" "$S3" \
  $'## Objetivo\nVerificar de forma aislada las reglas de negocio de cada servicio.\n\n## Alcance\n- [ ] Pruebas de AuthService, PlaneacionService, AvanceService, EvidenciaService y ReporteService\n- [ ] Dobles de prueba para base de datos y servicios externos\n- [ ] Caso positivo y caso negativo por cada regla\n\n## Criterio de terminado\nCobertura mínima del 70 % sobre la capa de servicios y suite en verde en integración continua.'

crear_issue "Pruebas funcionales automatizadas y colección de Postman" \
  "pruebas,prioridad/alta" "$S3" \
  $'## Objetivo\nVerificar el contrato de los Web Services y los flujos de extremo a extremo.\n\n## Alcance\n- [ ] Pruebas de endpoints con Supertest sobre instancia real\n- [ ] Verificación de 401 y 403 en rutas protegidas\n- [ ] Colección de Postman por módulo, exportada al repositorio\n- [ ] Capturas de la ejecución manual como evidencia\n\n## Criterio de terminado\nLos cinco Web Services cuentan con prueba automatizada y con evidencia manual.'

crear_issue "Contenerizar el frontend y el backend con balanceo de carga" \
  "infraestructura,prioridad/alta" "$S3" \
  $'## Objetivo\nEmpaquetar la aplicación completa en contenedores reproducibles.\n\n## Alcance\n- [ ] Dockerfile multietapa del backend\n- [ ] Dockerfile del frontend servido por Nginx\n- [ ] Orquestación con Docker Compose incluyendo PostgreSQL\n- [ ] Nginx como balanceador frente a dos réplicas del backend\n\n## Criterio de terminado\nEl entorno completo se levanta con un solo comando y el balanceador reparte las peticiones.'

crear_issue "Desplegar la infraestructura en la nube" \
  "infraestructura,prioridad/alta" "$S3" \
  $'## Objetivo\nPublicar la aplicación en un entorno accesible por internet.\n\n## Alcance\n- [ ] Servidor de aplicaciones para el backend\n- [ ] Servidor de base de datos administrado\n- [ ] Publicación del frontend\n- [ ] Dominio y certificado SSL activos\n- [ ] Variables de entorno y secretos configurados en la plataforma\n\n## Criterio de terminado\nLa aplicación responde por HTTPS en su dominio público.'

crear_issue "Escaneo de seguridad y cumplimiento del OWASP Top 10" \
  "seguridad,pruebas,prioridad/alta" "$S3" \
  $'## Objetivo\nVerificar y documentar el cumplimiento de los diez principios de OWASP.\n\n## Alcance\n- [ ] Ejecución del análisis estático con consultas de seguridad extendidas\n- [ ] Auditoría de dependencias vulnerables\n- [ ] Lista de verificación que asocia cada principio con el control implementado\n- [ ] Corrección de los hallazgos de severidad alta\n\n## Criterio de terminado\nSin hallazgos de severidad alta abiertos y lista de verificación completa.'

crear_issue "Documentación final, presentación y video demostrativo" \
  "documentacion,prioridad/alta" "$S3" \
  $'## Objetivo\nIntegrar los entregables de documentación del proyecto.\n\n## Alcance\n- [ ] Documento con portada, índice, introducción, desarrollo y conclusiones\n- [ ] Bibliografía bajo norma APA séptima edición\n- [ ] Presentación de apoyo\n- [ ] Video demostrativo del funcionamiento\n\n## Criterio de terminado\nTodos los entregables quedan subidos al repositorio.'

echo
echo "============================================================"
echo "Planeación cargada en $REPO"
echo
echo "Siguientes pasos:"
echo "  1. Abre el GitHub Project y verifica que los 25 issues entraron."
echo "  2. Llena los campos Responsable, Periodo y Estado en la vista de tabla."
echo "  3. Revisa que cada issue tenga su sprint asignado."
echo "============================================================"
