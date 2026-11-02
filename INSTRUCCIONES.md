# Bloque A — Guion de ejecución

Sigue los pasos en orden. Tiempo estimado: 50 minutos.

---

## Paso 0 — Preparar el equipo (5 min)

Abre PowerShell y verifica que tienes lo necesario:

```powershell
git --version
node --version
gh --version
```

Si falta GitHub CLI:

```powershell
winget install GitHub.cli
```

Cierra y vuelve a abrir la terminal. Después autentícate:

```powershell
gh auth login
```

Elige: `GitHub.com` → `HTTPS` → `Y` para autenticar con credenciales de Git → `Login with a web browser`. Copia el código que te muestra y pégalo en el navegador.

---

## Paso 1 — Crear el repositorio (3 min)

```powershell
cd $HOME\Documents
mkdir siplad
cd siplad
git init -b main
```

Descomprime el contenido de `siplad-bloque-a` **dentro** de esta carpeta. Debe quedar así:

```
siplad\
├── .github\
├── docs\
├── scripts\
├── README.md
└── _gitignore
```

Renombra el archivo `_gitignore` a `.gitignore`:

```powershell
Rename-Item _gitignore .gitignore
```

> El archivo viajó con guion bajo porque Windows oculta los archivos que empiezan con punto al descomprimir.

Primer commit y publicación:

```powershell
git add .
git commit -m "chore(repo): configuracion inicial, politicas y automatizaciones"
gh repo create siplad --public --source=. --remote=origin --push
```

Crea la rama de integración:

```powershell
git switch -c develop
git push -u origin develop
git switch main
```

---

## Paso 2 — Proteger las ramas (5 min)

En el navegador: **Settings → Rules → Rulesets → New branch ruleset**.

1. Nombre: `Proteccion de ramas principales`
2. Enforcement status: **Active**
3. Target branches → **Add target** → **Include by pattern** → escribe `main` → repite con `develop`
4. Activa estas casillas:
   - `Restrict deletions`
   - `Require a pull request before merging` → Required approvals: **0**
   - `Require status checks to pass` → busca y agrega: `Backend (NestJS)`, `Frontend (React + Vite)`, `Políticas de Pull Request`
   - `Block force pushes`
5. **Create**

> Approvals en 0 porque eres el único colaborador y GitHub no te deja aprobar tu propio PR. La política escrita en `docs/01-politicas-control-versiones.md` documenta el requisito de revisión; la regla técnica impide el push directo, que es lo que evalúa la rúbrica.

Si los status checks no aparecen en la lista todavía, deja esa casilla para el final del Paso 4 y vuelve a editar el ruleset.

---

## Paso 3 — Crear el GitHub Project (10 min)

1. En tu perfil de GitHub: pestaña **Projects** → **New project** → plantilla **Table** → nombre `SIPLAD - Proyecto Integrador Global` → **Create project**
2. Enlaza el repositorio: menú `...` (arriba a la derecha) → **Settings** → **Manage access** no; busca la sección del repositorio en la barra lateral del Project o usa el botón **Add item** una vez
3. Activa la carga automática: `...` → **Workflows** → **Auto-add to project** → **Edit** → selecciona el repositorio `siplad` → filtro `is:issue` → **Save and turn on workflow**

Ahora crea los campos personalizados que pide la rúbrica. En la vista de tabla, haz clic en el `+` del último encabezado de columna → **New field**:

| Campo | Tipo | Opciones |
|---|---|---|
| `Responsable` | Text | — |
| `Periodo de ejecución` | Date | (crea dos: `Inicio` y `Fin`) |
| `Estado` | Single select | `Por hacer`, `En progreso`, `En revisión`, `Terminado` |
| `Sprint` | Single select | `Sprint 0`, `Sprint 1`, `Sprint 2`, `Sprint 3` |

> El campo `Status` que viene por defecto puedes renombrarlo a `Estado` en lugar de crear uno nuevo.

---

## Paso 4 — Cargar la planeación (5 min)

Con el workflow de auto-add ya encendido, ejecuta desde **Git Bash** (no PowerShell, el script es bash):

```bash
cd ~/Documents/siplad
bash scripts/bootstrap-issues.sh
```

El script crea 11 etiquetas, 4 hitos y 25 issues con descripción y criterios de aceptación. Todos entran solos al Project.

Si prefieres PowerShell, instala Git Bash o ejecuta:

```powershell
bash scripts/bootstrap-issues.sh
```

(Git para Windows incluye bash en el PATH.)

---

## Paso 5 — Llenar los campos del Project (10 min)

Abre el Project en vista de tabla. Para cada issue llena:

- **Responsable:** `Gilberto Fabián Correa González`
- **Sprint:** según el hito que ya trae asignado
- **Inicio / Fin:** usa estos rangos
  - Sprint 0 → 2 nov, mañana
  - Sprint 1 → 2 nov, tarde
  - Sprint 2 → 2 nov noche a 3 nov mediodía
  - Fin: 3 nov
- **Estado:** `Por hacer` en todos, salvo los dos primeros del Sprint 0 que ya puedes marcar `Terminado`

> Truco: selecciona varias filas con la casilla de la izquierda y edita el campo una sola vez para todas.

Agrega también una segunda vista tipo **Board** agrupada por `Estado`: la rúbrica valora la visualización del flujo.

---

## Paso 6 — Validar las automatizaciones con un PR real (10 min)

Esto deja evidencia de los tres workflows funcionando y de la política de Pull Request.

```bash
git switch develop
git switch -c docs/3-diagrama-arquitectura
```

Edita cualquier archivo de `docs/` (agrega una línea) y:

```bash
git add .
git commit -m "docs(arquitectura): agregar nota sobre el entorno de ejecucion"
git push -u origin docs/3-diagrama-arquitectura
gh pr create --base develop --title "docs(arquitectura): agregar nota sobre el entorno de ejecucion" --body "Agrega una nota al documento de arquitectura.

Closes #3"
```

Entra al PR en GitHub y verifica que corren los tres checks. Cuando estén en verde:

```bash
gh pr merge --squash --delete-branch
```

**Toma capturas de:** la lista de checks en verde, la pestaña Actions con las tres ejecuciones, y el grafo de commits. Van al documento final.

---

## Paso 7 — Evidencia desde el IDE (2 min)

Abre la carpeta en Visual Studio Code, ve al panel **Control de código fuente**, haz un cambio pequeño, confírmalo y súbelo desde ahí. Captura la pantalla.

Con esto queda cubierta la evidencia desde los tres medios: línea de comandos, IDE y GitHub.

---

## Checklist de cierre del Bloque A

- [ ] Repositorio público creado con ramas `main` y `develop`
- [ ] Ruleset activo: sin push directo, PR obligatorio, checks requeridos
- [ ] Políticas documentadas en `docs/01-politicas-control-versiones.md`
- [ ] Esquema de pruebas documentado en `docs/02-esquema-de-pruebas.md`
- [ ] Metodología ágil justificada con seis puntos en `docs/03-metodologia-agil.md`
- [ ] Tres workflows ejecutándose correctamente
- [ ] 25 issues creados con descripción y criterios de aceptación
- [ ] Project con campos Responsable, Periodo, Estado y Sprint llenos
- [ ] Un Pull Request abierto, validado e integrado
- [ ] Capturas de CLI, IDE y GitHub guardadas

Cuando termines, avísame y seguimos con el Bloque B.
