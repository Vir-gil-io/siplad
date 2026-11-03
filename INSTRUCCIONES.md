# Crear el proyecto desde cero con ESLint y Husky

Guía completa del orden en que se construye SIPLAD, con la configuración de calidad instalada
**desde el inicio** y no al final.

---

## Antes de empezar: por qué este orden

Hay una razón concreta para el orden que sigue, y vale la pena entenderla.

**Husky tiene que quedar instalado antes del primer commit.** Los hooks de git viven en la raíz del
repositorio y solo actúan sobre los commits que ocurren después de instalarlos. Si configuras
Husky al final, todo el historial anterior quedó fuera de la política: commits con mensajes
inventados, código sin formatear, y la evidencia de que el repositorio "impone" sus reglas se cae.

**ESLint y Prettier tienen que existir antes de escribir código.** Si los instalas después, la
primera ejecución te va a reportar cientos de problemas de formato en archivos que ya funcionaban,
y vas a tener que decidir entre un commit gigantesco de reformateo o silenciar reglas. Instalados
primero, cada archivo nace ya conforme.

**Husky va en la raíz, no en `backend/`.** Esto confunde a mucha gente. Git solo lee los hooks del
repositorio, y tu repositorio tiene la raíz en `siplad/`, con `backend/` y `frontend/` como
carpetas hermanas. Por eso la raíz necesita su propio `package.json`: no para publicar nada, sino
para alojar las herramientas que vigilan todo el proyecto.

> **Nota sobre tu situación actual.** Tú ya tienes el repositorio y el backend hechos. No necesitas
> rehacer nada: salta a la sección **"Aplicarlo a lo que ya tienes"** al final, que son cinco
> minutos. Los pasos 1 a 6 son la referencia de cómo se construyó, y te sirven para el documento
> en la sección de entorno de desarrollo.

---

## Paso 1 — Inicializar el repositorio

```powershell
mkdir siplad
cd siplad
git init -b main
```

Crea el `.gitignore` de la raíz antes que nada. Si lo dejas para después, corres el riesgo de
versionar `node_modules` en el primer commit, y sacarlo del historial luego es un dolor de cabeza.

```
node_modules/
dist/
build/
coverage/
.env
.env.local
uploads/
*.log
.DS_Store
Thumbs.db
```

## Paso 2 — El `package.json` de la raíz

Este archivo no publica un paquete: existe para alojar las herramientas de calidad del proyecto
completo. Por eso lleva `"private": true`.

```powershell
npm init -y
```

Después edítalo para que quede así:

```json
{
  "name": "siplad",
  "version": "1.0.0",
  "description": "SIPLAD - Sistema Institucional de Planeacion y Avance Docente",
  "private": true,
  "scripts": {
    "prepare": "husky",
    "lint": "npm --prefix backend run lint",
    "lint:fix": "npm --prefix backend run lint:fix",
    "test": "npm --prefix backend test",
    "format": "npm --prefix backend run format"
  }
}
```

El script `prepare` es la pieza clave y conviene entender qué hace: **npm lo ejecuta
automáticamente después de cada `npm install`**. Eso significa que cuando alguien clone tu
repositorio y corra `npm install`, los hooks de git se le instalan solos, sin que nadie se lo
tenga que decir. Es el mecanismo que hace que la política viaje con el código.

## Paso 3 — Husky

```powershell
npm install -D husky
npx husky init
```

`npx husky init` hace tres cosas: crea la carpeta `.husky/`, escribe un hook `pre-commit` de
ejemplo y agrega el script `prepare` al `package.json` (si no lo pusiste tú ya).

Dentro de `.husky/` verás también una subcarpeta `_/` con la maquinaria interna de Husky. Esa
carpeta trae su propio `.gitignore` con un asterisco, así que no se versiona: solo se versionan
los hooks que tú escribes. No la toques.

> **Si vienes de guías viejas:** Husky 8 y anteriores requerían `npx husky install` y que cada
> hook empezara con dos líneas de preámbulo (`#!/usr/bin/env sh` y un `source`). Husky 9 eliminó
> eso. Los hooks ahora son archivos de shell planos con los comandos y nada más. Si copias un hook
> de un tutorial de 2023, el preámbulo va a estorbar.

## Paso 4 — Lint-staged

Sin lint-staged, un hook de pre-commit revisaría todo el proyecto en cada commit. Con lint-staged,
revisa únicamente los archivos que vas a confirmar, y además los corrige y los vuelve a preparar.

```powershell
npm install -D lint-staged
```

Crea `.lintstagedrc.json` en la raíz:

```json
{
  "backend/{src,test,prisma}/**/*.ts": [
    "eslint --fix --config backend/eslint.config.mjs",
    "prettier --write --config backend/.prettierrc"
  ],
  "**/*.{json,yml,yaml,md}": [
    "prettier --write --config backend/.prettierrc --ignore-unknown"
  ]
}
```

Dos decisiones aquí que no son obvias:

**El patrón es `backend/{src,test,prisma}/**/*.ts`, no `backend/**/*.ts`.** El segundo también
atraparía `backend/eslint.config.mjs`, y ESLint no puede analizar su propio archivo de
configuración con las reglas que necesitan información de tipos: falla con un error de análisis.
Acotar el patrón a las carpetas de código fuente evita el problema de raíz.

**Las órdenes llevan `--config backend/...` explícito.** Porque lint-staged ejecuta desde la raíz
del repositorio, no desde `backend/`, y ahí no hay configuración de ESLint.

## Paso 5 — Commitlint

Esto es lo que convierte tu política de nomenclatura de un documento en una regla real.

```powershell
npm install -D @commitlint/cli @commitlint/config-conventional
```

Crea `commitlint.config.js` en la raíz. La configuración completa viene en el paquete; lo
importante de entender es la lista de tipos permitidos, que debe coincidir exactamente con la
nomenclatura de ramas documentada en `docs/01-politicas-control-versiones.md`:

```js
'type-enum': [
  2,
  'always',
  ['feat', 'fix', 'docs', 'test', 'refactor', 'ci', 'chore', 'style', 'perf'],
],
```

Si tu documento dice que las ramas se llaman `feat/`, `fix/`, `docs/`… y commitlint acepta otros
tipos, tienes una incoherencia que un revisor atento va a notar. Mantén las dos listas iguales.

## Paso 6 — Los hooks

Tres hooks, cada uno con un trabajo distinto. Crea estos archivos dentro de `.husky/`:

**`.husky/pre-commit`** — revisa y corrige el formato de lo que estás confirmando:

```sh
npx lint-staged
```

**`.husky/commit-msg`** — valida el mensaje:

```sh
npx --no-install commitlint --edit "$1"
```

El `--no-install` evita que npx intente descargar commitlint si falta: preferimos que falle con un
mensaje claro antes que una descarga silenciosa a media confirmación.

**`.husky/pre-push`** — ejecuta las pruebas antes de enviar:

```sh
echo "Ejecutando pruebas unitarias antes de enviar..."
npm --prefix backend test
```

> **Por qué las pruebas van en `pre-push` y no en `pre-commit`.** Un commit debe ser rápido: haces
> veinte al día y esperar ocho segundos cada vez te lleva a usar `--no-verify`, que desactiva toda
> la cadena. Un push ocurre pocas veces y es el momento en que el código sale de tu máquina. Ahí sí
> vale la pena esperar. El resultado es que la rama remota se mantiene en verde sin fricción diaria.

En Linux y macOS hay que dar permiso de ejecución a los hooks:

```bash
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

En Windows no es necesario.

## Paso 7 — Crear el backend

Con la base de calidad lista, ahora sí el código.

```powershell
npx @nestjs/cli@latest new backend --package-manager npm --skip-git
cd backend
```

Elige `npm` cuando pregunte. El `--skip-git` es importante: ya tienes un repositorio en la raíz y
no quieres uno anidado.

Instala las dependencias del proyecto:

```powershell
npm install @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/swagger @nestjs/axios `
  @prisma/client passport passport-jwt passport-google-oauth20 `
  class-validator class-transformer bcryptjs helmet exceljs pdfkit

npm install -D prisma @types/passport-jwt @types/passport-google-oauth20 `
  @types/multer @types/pdfkit

npx prisma init --datasource-provider postgresql
```

## Paso 8 — ESLint y Prettier en el backend

NestJS ya trae una configuración de ESLint, pero conviene reemplazarla por una propia con reglas
que detecten defectos reales y no solo formato.

```powershell
npm install -D eslint@^10 typescript-eslint@^8 @eslint/js globals `
  prettier eslint-config-prettier eslint-plugin-prettier
```

Crea `backend/eslint.config.mjs`. La configuración completa viene en el paquete, pero hay dos
cosas que debes entender porque son fuente de errores frecuentes:

**ESLint 9 cambió a configuración plana.** Ya no existe `.eslintrc.json` ni la herencia por
cascada ni la clave `extends`. Ahora es un arreglo de objetos que se aplican en orden, y el último
que coincide con un archivo gana. Por eso Prettier va al final: desactiva las reglas de formato de
ESLint que chocarían con él.

**Los patrones de `files` e `ignores` se resuelven contra el directorio desde el que invocas
ESLint, no contra la ubicación del archivo de configuración.** Esto es lo que me rompió la
configuración al probarla: las excepciones funcionaban al correr `npm run lint` dentro de
`backend/`, y dejaban de aplicar cuando el hook de pre-commit las invocaba desde la raíz. La
solución es prefijar todos los patrones con `**/`:

```js
// Mal: deja de aplicar si ESLint se invoca desde otro directorio
ignores: ['dist/**', 'eslint.config.mjs'];
files: ['prisma/seed.ts'];

// Bien: funciona desde cualquier directorio
ignores: ['**/dist/**', '**/eslint.config.mjs'];
files: ['**/prisma/seed.ts'];
```

Agrega también `backend/.prettierrc` y `backend/.prettierignore`, y estos scripts al
`backend/package.json`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\" \"prisma/**/*.ts\"",
"format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\" \"prisma/**/*.ts\""
```

## Paso 9 — Comprobar que la cadena funciona

No des por hecho que quedó bien: pruébalo. Esta comprobación toma dos minutos y te ahorra
descubrir a media entrega que los hooks no se estaban ejecutando.

**Prueba A — el mensaje se valida:**

```powershell
git add .
git commit -m "arregle cosas"
```

Debe **fallar** con una lista de razones: falta el tipo, falta la descripción, el encabezado es
demasiado corto.

**Prueba B — el formato se corrige solo.** Crea `backend/src/probe.ts` con código feo a propósito:

```typescript
export const sinUsar = 1;
export function mal(a: string) {
  return a;
}
```

Prepáralo y confírmalo con un mensaje válido:

```powershell
git add .
git commit -m "chore(repo): configurar eslint, prettier, husky y commitlint"
```

Debe **pasar**, y al abrir el archivo lo encontrarás reformateado: punto y coma agregado, espacios
corregidos, cuerpo de la función expandido. Eso significa que lint-staged corrió, corrigió y
volvió a preparar el archivo. Borra el archivo de prueba después.

**Prueba C — las pruebas bloquean el envío:** rompe a propósito una prueba, intenta `git push` y
verifica que se detenga.

**Captura las tres.** Son evidencia directa de las políticas de control de versiones del criterio
II: demuestran que el repositorio no solo documenta sus reglas, las aplica.

## Paso 10 — El frontend (Bloque C)

Cuando llegue el momento:

```powershell
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Y hay que agregar una línea al `.lintstagedrc.json` de la raíz para que los hooks también cubran
el frontend:

```json
"frontend/src/**/*.{ts,tsx}": [
  "eslint --fix --config frontend/eslint.config.js",
  "prettier --write --config backend/.prettierrc"
]
```

Eso lo hacemos en el Bloque C.

---

## Aplicarlo a lo que ya tienes

Esto es lo que te toca hacer hoy. Cinco minutos.

### 1. Descomprimir y restaurar nombres

Descomprime el contenido en la raíz del repositorio, sobrescribiendo `backend/`. Después:

```powershell
cd $HOME\Documents\siplad
powershell -ExecutionPolicy Bypass -File .\restaurar-nombres.ps1
```

El script renombra los cinco archivos que viajaron con guion bajo y te confirma cuáles quedaron.
Hace esto:

| Viaja como                | Queda como                |
| ------------------------- | ------------------------- |
| `_husky/`                 | `.husky/`                 |
| `_lintstagedrc.json`      | `.lintstagedrc.json`      |
| `backend/_prettierrc`     | `backend/.prettierrc`     |
| `backend/_prettierignore` | `backend/.prettierignore` |
| `backend/_env.example`    | `backend/.env.example`    |

### 2. Instalar

```powershell
npm install
cd backend
npm install
cd ..
```

El `npm install` de la raíz dispara el script `prepare`, que activa los hooks. Puedes confirmarlo:

```powershell
git config core.hooksPath
```

Debe responder `.husky/_`. Si no responde nada, los hooks no están activos: revisa que exista la
carpeta `.husky` y vuelve a correr `npm install` en la raíz.

### 3. Comprobar

```powershell
npm run lint
```

Debe terminar sin reportar nada. Después haz las pruebas A, B y C del Paso 9 y guarda las capturas.

### 4. Confirmar

```powershell
git switch develop
git pull
git switch -c chore/1-eslint-husky-commitlint
git add .
git commit -m "chore(repo): configurar eslint, prettier, husky y commitlint"
git push -u origin chore/1-eslint-husky-commitlint
```

Fíjate que el propio commit ya pasa por los hooks que estás instalando. Eso es una buena señal.

---

## Lo que cambió en el backend que ya tenías

El paquete trae el backend actualizado. No es solo formato: ESLint con reglas que usan información
de tipos encontró **21 problemas reales de seguridad de tipos** que el compilador no reporta,
todos en los puntos donde entra información desde fuera del sistema.

| Qué estaba mal                                                                            | Dónde                                             | Por qué importa                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| El objeto de la petición de Express llegaba sin tipo, así que `user.rol` no se verificaba | `roles.guard.ts`, `usuario-actual.decorator.ts`   | Un cambio de nombre en el campo del rol no daría error de compilación, y el control de acceso fallaría en silencio |
| La respuesta del servicio de días festivos se recorría sin tipo                           | `festivos.service.ts`                             | Si el proveedor cambia un nombre de campo, el error aparece en producción y no al compilar                         |
| El perfil de Google llegaba como `any` al controlador                                     | `auth.controller.ts`                              | Lo mismo, en el flujo de autenticación                                                                             |
| Promesas rechazadas con algo que no era un `Error`                                        | `cloudinary.service.ts`, `exportacion.service.ts` | La traza del error se pierde y depurar un fallo de carga se vuelve adivinanza                                      |
| La promesa de arranque quedaba sin manejar                                                | `main.ts`                                         | Un fallo al arrancar no se reportaría correctamente                                                                |

Los cinco se corrigieron declarando los tipos de forma explícita, no silenciando las reglas. Está
comentado en el código por qué cada frontera externa lleva su tipo declarado: es parte del patrón
Adapter que ya documentaste en la arquitectura.

Después de los cambios se volvió a verificar todo:

| Verificación        | Resultado           |
| ------------------- | ------------------- |
| `npm run lint`      | Sin problemas       |
| Compilación         | Sin errores         |
| Pruebas unitarias   | 99 pruebas en verde |
| Pruebas funcionales | 19 pruebas en verde |

---

## Para el documento

Esta sección te sirve textualmente en el apartado de entorno de desarrollo del criterio I, y en el
de políticas de versionamiento del criterio II.

| Herramienta       | Versión | Función en el proyecto                                                |
| ----------------- | ------- | --------------------------------------------------------------------- |
| ESLint            | 10      | Análisis estático del código con reglas que usan información de tipos |
| typescript-eslint | 8       | Reglas específicas de TypeScript sobre el árbol de sintaxis tipado    |
| Prettier          | 3       | Formato uniforme, sin discusiones de estilo                           |
| Husky             | 9       | Gestión de los hooks de git del repositorio                           |
| lint-staged       | 16      | Aplica las revisiones solo a los archivos preparados para confirmar   |
| commitlint        | 19      | Valida que el mensaje de commit cumpla Conventional Commits           |

Y la frase que vale para la rúbrica: las políticas de nomenclatura de commits no están solo
documentadas, el repositorio las **impone** mediante el hook `commit-msg`, y las verificaciones de
calidad se ejecutan de forma automática antes de cada confirmación y de cada envío.
