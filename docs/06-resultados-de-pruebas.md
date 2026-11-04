# Resultados de pruebas

Consolidado de la verificación del sistema SIPLAD: qué se probó, con qué herramienta, y qué
resultó. Complementa el esquema de pruebas definido en la fase de inicio
(`docs/02-esquema-de-pruebas.md`).

---

## 1. Lo que se ejecutó

| Tipo              | Herramienta | Alcance                                      | Modalidad  |
| ----------------- | ----------- | -------------------------------------------- | ---------- |
| Unitarias         | Jest        | Capa de lógica de negocio e integración      | Automática |
| Funcionales       | Supertest   | Arranque, contrato HTTP y control de acceso  | Automática |
| Funcionales       | Postman     | Los cinco Web Services, de extremo a extremo | Manual     |
| Interfaz          | Playwright  | Capa de presentación con navegador real      | Automática |
| Análisis estático | CodeQL      | Patrones de vulnerabilidad en el código      | Automática |
| Dependencias      | npm audit   | Vulnerabilidades conocidas en paquetes       | Automática |

---

## 2. Pruebas unitarias

**Ejecución:** `npm test` desde `backend/`
**Cobertura:** `npm run test:cov`

Verifican las reglas del dominio en aislamiento. La capa de datos y los servicios externos se
sustituyen por dobles de prueba: ninguna prueba unitaria abre una conexión a base de datos ni
envía archivos a un proveedor externo.

### Resultado

```
Test Suites: 9 passed, 9 total
Tests:       113 passed, 113 total
```

### Cobertura por módulo

| Módulo                    | Sentencias  | Ramas       | Funciones   |
| ------------------------- | ----------- | ----------- | ----------- |
| `catalogos.service.ts`    | 100 %       | 100 %       | 100 %       |
| `festivos.service.ts`     | 100 %       | 83.3 %      | 100 %       |
| `auth.service.ts`         | 95.6 %      | 93.3 %      | 87.5 %      |
| `planeaciones.service.ts` | 94.3 %      | 73.5 %      | 100 %       |
| `evidencias.service.ts`   | 94.1 %      | 77.3 %      | 100 %       |
| `exportacion.service.ts`  | 93.7 %      | 47.6 %      | 95.7 %      |
| `reportes.service.ts`     | 89.0 %      | 71.9 %      | 86.0 %      |
| `avances.service.ts`      | 84.1 %      | 63.9 %      | 81.8 %      |
| `cloudinary.service.ts`   | 73.6 %      | 52.4 %      | 70 %        |
| **Total**                 | **90.27 %** | **69.38 %** | **87.80 %** |

El criterio de aceptación del esquema de pruebas era 70 % sobre la capa de servicios. Se superó
por veinte puntos.

`exportacion.service.ts` baja en ramas respecto de la medición anterior porque la acotación del
reporte —por parcial y por docente— multiplica las combinaciones posibles de un mismo camino de
código. Las cuatro vistas del reporte se ejercitan con filtro y sin él; lo que no se recorre es
cada permutación de ambos criterios.

`cloudinary.service.ts` queda por debajo del resto porque la rama que envía el archivo al
proveedor externo no se ejercita en pruebas unitarias de forma deliberada: hacerlo implicaría
subir archivos reales en cada ejecución. Esa ruta se verifica de forma manual con Postman.

### Un defecto real encontrado por estas pruebas

La prueba _"arroja el mismo resultado sea cual sea la zona horaria del servidor"_ reveló que
`contarDiasHabiles` mezclaba el día de la semana en hora local con fechas ISO en UTC. El conteo de
días hábiles cambiaba según la zona horaria del servidor: habría dado un número en el equipo de
desarrollo y otro distinto en el contenedor de producción.

Se corrigió llevando todo el cálculo a UTC, y la prueba ahora verifica el resultado en tres zonas
horarias.

→ `backend/src/integrations/festivos/festivos.service.ts`

---

## 3. Pruebas funcionales automatizadas

**Ejecución:** `npm run test:e2e` desde `backend/`

Levantan la aplicación completa con su grafo real de módulos, guards, pipes y controladores. La
capa de datos se sustituye por un doble para que la suite no dependa de una base en ejecución.

### Resultado

```
Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
```

### Qué verifican

| Grupo                 | Casos | Qué comprueban                                                                     |
| --------------------- | ----- | ---------------------------------------------------------------------------------- |
| Arranque              | 2     | El grafo de dependencias resuelve y el endpoint público responde                   |
| Control de acceso     | 12    | Seis rutas protegidas devuelven 401 sin token y 401 con token falsificado          |
| Validación de entrada | 4     | Formato de correo, longitud de contraseña, propiedades no declaradas, cuerpo vacío |
| Rutas inexistentes    | 1     | 404 sin filtrar detalles internos                                                  |

La prueba de arranque es la más valiosa en la práctica: un proveedor declarado sin registrar no
produce error de compilación, solo un fallo al iniciar. Esta suite lo detecta antes del despliegue.

---

## 4. Pruebas funcionales manuales

**Herramienta:** Postman
**Colección:** `pruebas/postman/SIPLAD.postman_collection.json`

54 peticiones en 8 carpetas, con aserciones en cada una. Cubren **29 de las 32 rutas** del backend.

### Cobertura por carpeta

| Carpeta                   | Peticiones | Qué cubre                                                   |
| ------------------------- | ---------- | ----------------------------------------------------------- |
| 00 - Estado del servicio  | 1          | Disponibilidad e identificación de la instancia             |
| 01 - Autenticación        | 8          | Inicio de sesión, perfil, y cuatro casos negativos          |
| 02 - Catálogos            | 4          | Materias, periodos y días hábiles de la integración externa |
| 03 - Planeación didáctica | 10         | Ciclo completo más cinco reglas de negocio                  |
| 04 - Avances por parcial  | 7          | Clasificación automática y reglas de unicidad               |
| 05 - Evidencias           | 7          | Carga de archivo, validación y baja bloqueada               |
| 06 - Reportes             | 6          | Cuatro vistas de indicadores y dos exportaciones            |
| 07 - Control de acceso    | 11         | Pruebas negativas de autenticación y autorización           |

### Las tres rutas no cubiertas, y por qué

| Ruta                            | Motivo                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/auth/google`          | Flujo de redirección del navegador: Postman no puede completar el consentimiento del proveedor        |
| `GET /api/auth/google/callback` | Lo mismo; se verifica de forma manual en el navegador                                                 |
| `DELETE /api/avances/:id`       | Ejecutarla rompería la repetibilidad de la colección; está cubierta por la prueba unitaria `eliminar` |

### Resultado de la ejecución

> **Pendiente de ejecutar.** Al correr la colección, anota aquí el número de aserciones correctas
> y adjunta la captura del panel de resultados.
>
> ```
> Peticiones ejecutadas: ___
> Aserciones correctas:  ___ de ___
> Fecha de ejecución:    ___
> ```

---

## 5. Pruebas de la capa de presentación

**Herramienta:** Playwright
**Guion:** `frontend/pruebas/prueba-humo.mjs`

Recorren la aplicación compilada con un navegador real, contra un servidor que imita la API con la
forma exacta de los DTO del backend.

### Resultado

```
64 de 64 verificaciones correctas
```

Cubren el acceso, la navegación condicionada por rol, los cuatro módulos, el dibujo de las
gráficas, el desglose de cada segmento de la gráfica, la acotación del reporte, el visor de
documentos, la contención del texto y la ausencia de desplazamiento horizontal a 390 píxeles de
ancho.

Cuatro de estas verificaciones merecen mención aparte porque comprueban una cadena completa y no
una pantalla aislada:

- **El desglose coincide con la cifra.** La barra del primer parcial declara tres avances
  cumplidos; al pulsarla, el desglose lista exactamente tres registros, con nombre y materia. La
  API simulada calcula las cifras agregadas a partir de la misma lista que alimenta el desglose,
  de modo que una discrepancia entre ambas haría fallar la prueba.
- **La acotación llega hasta el archivo.** Tras elegir segundo parcial y un docente, la prueba
  intercepta la petición de descarga y comprueba que la dirección lleva `parcial=2&docenteId=d1`.
  Sin esto, el filtro podría acotar la pantalla y entregar un archivo completo.
- **El texto no se sale de su caja.** Se inyecta una cadena de 400 caracteres sin espacios en una
  celda y se mide cuánto sobresale de su contenedor. El resultado debe ser cero o negativo.
- **El contenido aprovecha el ancho.** A 1600 píxeles de ventana, el área de contenido mide más de
  1400; antes quedaba fijada en 1152 y dejaba franjas vacías a los lados.

### Tres defectos reales encontrados por estas pruebas

**Las peticiones no se cancelaban.** Al cambiar de filtro antes de que llegara la respuesta
anterior, el resultado viejo podía pintarse encima del nuevo. Se corrigió descartando las
respuestas obsoletas.

**Los formularios derivaban estado de las props en un efecto.** Al reabrir el mismo registro
quedaban valores de la apertura anterior. Se corrigió montando una instancia nueva del diálogo en
cada apertura.

**Una cadena sin espacios desbordaba su contenedor.** Un texto largo escrito de corrido —sin
ningún espacio donde partirse— se salía de su columna y se encimaba sobre el sello de estado y los
botones de la derecha. La fila ya reservaba el espacio correctamente; lo que faltaba era
autorizar a partir la palabra. Se corrigió con una regla de contención aplicada a todos los
elementos de texto, no solo a la pantalla donde se observó.

---

## 6. Análisis estático de seguridad

**Herramienta:** CodeQL con el conjunto de consultas `security-extended`
**Disparadores:** cada push, cada Pull Request, y de forma programada los lunes

Los hallazgos se consultan en la pestaña **Security → Code scanning** del repositorio.

### Resultado

> **Pendiente de anotar.** Tras el último análisis, registra aquí el número de alertas por
> severidad y adjunta la captura de la pestaña de escaneo.
>
> ```
> Alertas críticas: ___
> Alertas altas:    ___
> Alertas medias:   ___
> ```

El criterio de terminado del proyecto exige cero hallazgos de severidad alta abiertos.

---

## 7. Auditoría de dependencias

**Herramienta:** `npm audit --audit-level=high`
**Disparador:** cada Pull Request, sobre el backend y el frontend

Complementada por Dependabot, que revisa de forma programada y abre el Pull Request con la
corrección sin esperar a que haya trabajo pendiente.

→ `.github/dependabot.yml`

---

## 8. Resumen

| Suite                                 | Casos                         | Estado                |
| ------------------------------------- | ----------------------------- | --------------------- |
| Unitarias (Jest)                      | 113                           | Correctas             |
| Funcionales automatizadas (Supertest) | 19                            | Correctas             |
| Interfaz (Playwright)                 | 64                            | Correctas             |
| Funcionales manuales (Postman)        | 54 peticiones, 114 aserciones | Pendiente de ejecutar |
| **Total automatizado**                | **196**                       | **Correctas**         |

### Lo que esta verificación no cubre

Conviene decirlo con precisión, porque un informe de pruebas que no declara sus límites vale
menos:

- **No se realizó prueba de penetración** ni análisis dinámico de la aplicación en ejecución.
- **No se ejecutaron pruebas de carga.** El balanceo se demuestra de forma funcional —el reparto
  entre réplicas y la tolerancia a una caída—, no bajo carga sostenida.
- **Las pruebas unitarias no tocan la base de datos real.** Las migraciones y el esquema se
  verifican por aplicación efectiva, no por una suite dedicada.
- **La integración con el proveedor de almacenamiento externo** se verifica de forma manual; la
  ruta automatizada ejercita el respaldo en disco local.
