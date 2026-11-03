# Bloque C — Guion de ejecución

Frontend completo: los cuatro módulos operables, acceso local y federado, navegación por rol,
gráficas de cumplimiento y exportación.

Tiempo estimado: 10 minutos de ejecución.

---

## Lo que ya viene verificado

Se ejecutó en un entorno limpio antes de empaquetarlo:

| Verificación                      | Resultado                                |
| --------------------------------- | ---------------------------------------- |
| Compilación de TypeScript         | Sin errores                              |
| Compilación de producción         | Correcta, 112 kB comprimidos de arranque |
| ESLint                            | Sin problemas                            |
| Prueba de humo con navegador real | 27 de 27 verificaciones correctas        |

La prueba de humo levanta la aplicación compilada contra un servidor que imita la API con la
forma exacta de los DTO del backend, y la recorre con un navegador: entra como docente, revisa
las tres pantallas, intenta entrar a reportes y comprueba que lo devuelve, entra como
coordinación, abre el diálogo de dictamen, verifica que las gráficas se dibujen y que no haya
desplazamiento horizontal a 390 px.

**Lo que esa prueba no cubre:** la integración con tu backend real. Eso lo confirmas tú en el
Paso 3.

---

## Paso 1 — Colocar los archivos

Descomprime en la raíz del repositorio. Queda así:

```
siplad/
├── backend/          (ya existía)
├── frontend/         <- nuevo
├── .lintstagedrc.json  <- se reemplaza para incluir el frontend
└── ...
```

Renombra los dos archivos que viajan con guion bajo:

```powershell
cd $HOME\Documents\siplad
Rename-Item _lintstagedrc.json .lintstagedrc.json -Force
Rename-Item frontend\_prettierrc .prettierrc
```

Si PowerShell se queja de que `.lintstagedrc.json` ya existe, bórralo primero: el nuevo añade la
línea del frontend a los hooks.

Crea la rama:

```powershell
git switch develop
git pull
git switch -c feat/19-frontend-react
```

## Paso 2 — Instalar

```powershell
cd frontend
npm install
```

## Paso 3 — Arrancar contra tu backend

En una terminal, el backend:

```powershell
cd backend
npm run start:dev
```

En otra, el frontend:

```powershell
cd frontend
npm run dev
```

Abre `http://localhost:5173`. No hace falta configurar la dirección de la API: el servidor de
desarrollo reenvía `/api` al puerto 3000, así que el navegador ve un solo origen y no hay
problemas de CORS.

Entra con las credenciales que sembró el backend:

| Rol          | Correo                   | Contraseña  |
| ------------ | ------------------------ | ----------- |
| Docente      | jcorrea@utng.edu.mx      | Siplad2026* |
| Coordinación | coordinacion@utng.edu.mx | Siplad2026* |

### El recorrido para el video

Este orden muestra los cuatro módulos y el control de acceso en unos tres minutos:

1. **Entra como docente.** Verás las planeaciones sembradas con su sello de estado, y una con
   ajustes solicitados mostrando el comentario de coordinación.
2. **Registra una planeación** con el botón de arriba. Elige materia y parcial, escribe el
   contenido, guarda.
3. **Ve a Mis avances.** Las planeaciones aprobadas aparecen ahí. Registra un avance con 92%: el
   sello de "Cumplido" se estampa con la animación.
4. **Ve a Mis constancias.** Carga un PDF cualquiera y verás que entra como pendiente.
5. **Escribe `localhost:5173/reportes` en la barra de direcciones.** Te devuelve a tus
   planeaciones: un docente no entra ahí. **Esto vale la pena capturarlo.**
6. **Sal y entra como coordinación.** La navegación es distinta: bandeja de revisión, validación
   y reportes.
7. **Dictamina la planeación que registraste.** Prueba primero "Solicitar ajustes" para ver que
   exige el motivo, luego aprueba.
8. **Valida la constancia** que cargaste.
9. **Abre Reportes.** Los indicadores ya reflejan lo que acabas de hacer. Descarga el Excel y el
   PDF.

## Paso 4 — Comprobar la compilación de producción

```powershell
npm run build
npm run preview
```

Abre `http://localhost:4173`. Es el mismo paquete que se desplegará en la nube, y la vista previa
también reenvía `/api` al backend local, así que puedes probarlo completo sin desplegar.

**Captura la salida de `npm run build`:** muestra el tamaño del paquete y que la compilación pasa
sin errores de tipos.

## Paso 5 — Lint e integración

```powershell
cd ..
npm run lint
```

Debe pasar el backend y el frontend. Después:

```powershell
git add .
git commit -m "feat(frontend): implementar los cuatro modulos con navegacion por rol y reportes"
git push -u origin feat/19-frontend-react
gh pr create --base develop --title "feat(frontend): implementar los cuatro modulos con navegacion por rol y reportes" --body "Implementa la capa de presentacion completa.`n`n- Acceso local y federado con Google`n- Navegacion condicionada por rol`n- Modulos de planeacion, avances, evidencias y reportes`n- Graficas de cumplimiento y exportacion a PDF y Excel`n`nCloses #5`nCloses #11`nCloses #12`nCloses #15`nCloses #19"
```

Cierra cinco issues más.

## Paso 6 — La prueba de humo (opcional)

Si te alcanza el tiempo, esto es evidencia fuerte de pruebas funcionales de la capa de
presentación para el criterio IV.

```powershell
cd frontend
npm install -D playwright
npx playwright install chromium
```

La descarga del navegador tarda unos minutos. Después, con el backend **apagado**:

```powershell
# Terminal 1
node pruebas/api-simulada.mjs

# Terminal 2
npm run build
npm run preview

# Terminal 3
node pruebas/prueba-humo.mjs
```

Imprime las 27 verificaciones y deja tres capturas en `pruebas/`. **Captura esa salida.**

Si no te alcanza el tiempo, sáltalo: las pruebas del backend ya cubren el criterio y esto es
adicional.

---

## Lo que se entregó

### Los cuatro módulos

| Módulo               | Vista del docente                        | Vista de coordinación                            |
| -------------------- | ---------------------------------------- | ------------------------------------------------ |
| Planeación didáctica | Registrar, corregir, ver dictamen        | Bandeja de revisión, aprobar o solicitar ajustes |
| Avances por parcial  | Registrar sobre planeación aprobada      | Visible en los reportes                          |
| Evidencias           | Cargar constancia, ver horas acreditadas | Bandeja de validación                            |
| Reportes             | —                                        | Indicadores, gráficas, tabla y exportación       |

### La capa de presentación, por carpeta

| Carpeta           | Qué contiene                                                  |
| ----------------- | ------------------------------------------------------------- |
| `src/api/`        | Cliente HTTP y un servicio por cada Web Service del backend   |
| `src/auth/`       | Contexto de sesión y guard de rutas por rol                   |
| `src/components/` | Piezas reutilizables: sello, acta, controles, diálogo, avisos |
| `src/hooks/`      | Carga de datos con cancelación de respuestas obsoletas        |
| `src/layouts/`    | Estructura de la aplicación y navegación por rol              |
| `src/pages/`      | Una vista por módulo                                          |
| `src/types/`      | Contratos compartidos con la API                              |

### Decisiones que conviene saber explicar

**El token viaja en el fragmento de la URL** en el retorno de Google, no en la cadena de
consulta. El fragmento no se envía al servidor, así que el token no queda en las bitácoras de
acceso ni en el encabezado de referencia.

**El guard de rutas del frontend no es la seguridad.** La verificación real la hace el backend;
esto solo evita mostrar una pantalla que terminaría en 403. Si te lo preguntan en la defensa,
esa es la respuesta correcta.

**Los reportes se cargan por separado.** La librería de gráficas pesa más que el resto de la
aplicación junta, así que se descarga solo al abrir esa vista. Un docente nunca la baja. Se ve en
la salida de `npm run build`: dos paquetes en lugar de uno.

**Las peticiones obsoletas se descartan.** Si cambias de filtro antes de que llegue la respuesta
anterior, la vieja se ignora en lugar de pintarse encima de la nueva.

### Sobre el diseño

La interfaz toma su estructura del **acta académica**: bloque de encabezado institucional,
renglones reglados y el estado como **sello de tinta** en lugar de etiqueta de color. La paleta
sale de ahí: tinta violeta del sello para lo aprobado, lápiz rojo del docente para los ajustes,
grafito para lo que está en espera.

Los colores de las gráficas se verificaron con un validador de accesibilidad: el cumplimiento es
una escala divergente (favorable ← neutro → desfavorable), y los dos polos separan ΔE 18.8 en
protanopia y 22.5 en visión normal, por encima del piso recomendado. Los tres superan 3:1 de
contraste. Además, cada segmento lleva su cifra impresa y hay leyenda y tabla de detalle, de modo
que la lectura nunca depende solo del color.

Si te preguntan por qué no se parece a un panel de control típico: porque el usuario real es un
docente que registra entre clases y una coordinadora que revisa lotes, y para los dos el renglón
reglado se recorre más rápido que una cuadrícula de tarjetas.

---

## Checklist de cierre del Bloque C

- [ ] Archivos colocados y renombrados
- [ ] `npm install` del frontend
- [ ] Aplicación corriendo contra el backend real
- [ ] Recorrido completo probado con los dos roles
- [ ] Captura del intento de acceso a reportes como docente
- [ ] Captura de `npm run build`
- [ ] `npm run lint` pasa en la raíz
- [ ] Pull Request integrado y cinco issues cerrados
- [ ] Prueba de humo ejecutada (opcional)

Falta el Bloque D: Docker, el balanceador y el despliegue en Render.
