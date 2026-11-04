#!/usr/bin/env python3
"""
Genera la coleccion de Postman de SIPLAD.

Se construye con un guion y no a mano para que las rutas coincidan exactamente
con las declaradas en los controladores, y para que el JSON resultante sea
valido por construccion.
"""
import json
import uuid

BASE = "{{baseUrl}}"


def url(ruta: str, consulta=None):
    """Postman necesita la URL descompuesta, no solo la cadena cruda."""
    partes = [p for p in ruta.strip("/").split("/") if p]
    u = {"raw": f"{BASE}/{'/'.join(partes)}", "host": [BASE], "path": partes}
    if consulta:
        u["query"] = [{"key": k, "value": v} for k, v in consulta.items()]
        u["raw"] += "?" + "&".join(f"{k}={v}" for k, v in consulta.items())
    return u


def prueba(*lineas):
    return [{"listen": "test", "script": {"type": "text/javascript", "exec": list(lineas)}}]


def peticion(nombre, metodo, ruta, *, descripcion="", token=None, cuerpo=None,
             consulta=None, tests=None, formdata=None):
    req = {
        "method": metodo,
        "header": [],
        "url": url(ruta, consulta),
        "description": descripcion,
    }

    if token:
        req["auth"] = {
            "type": "bearer",
            "bearer": [{"key": "token", "value": "{{" + token + "}}", "type": "string"}],
        }
    elif token is False:
        req["auth"] = {"type": "noauth"}

    if cuerpo is not None:
        req["header"].append({"key": "Content-Type", "value": "application/json"})
        req["body"] = {"mode": "raw", "raw": json.dumps(cuerpo, indent=2, ensure_ascii=False)}

    if formdata:
        req["body"] = {"mode": "formdata", "formdata": formdata}

    item = {"name": nombre, "request": req, "response": []}
    if tests:
        item["event"] = prueba(*tests)
    return item


# --------------------------------------------------------------------------
# 00 — Estado del servicio
# --------------------------------------------------------------------------
estado = {
    "name": "00 - Estado del servicio",
    "description": "Comprobacion de que la API responde antes de ejecutar el resto.",
    "item": [
        peticion(
            "Salud", "GET", "/api/salud", token=False,
            descripcion=(
                "Endpoint publico. Devuelve tambien el identificador de la instancia que "
                "atendio la peticion, lo que permite verificar el reparto del balanceador "
                "cuando se ejecuta contra el entorno contenerizado."
            ),
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Se identifica como SIPLAD', () => pm.expect(d.servicio).to.eql('SIPLAD API'));",
                "pm.test('Informa la instancia que atendio', () => pm.expect(d).to.have.property('instancia'));",
                "console.log('Instancia:', d.instancia);",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 01 — Autenticacion
# --------------------------------------------------------------------------
autenticacion = {
    "name": "01 - Autenticacion",
    "description": (
        "Web Service 1 de 5. Ejecutar primero los dos inicios de sesion: guardan los "
        "tokens en variables de la coleccion que el resto de las carpetas reutiliza."
    ),
    "item": [
        peticion(
            "Iniciar sesion - Coordinacion", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "coordinacion@utng.edu.mx", "password": "Siplad2026*"},
            descripcion="Guarda el token de coordinacion en la variable tokenCoordinador.",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Devuelve un token', () => pm.expect(d.accessToken).to.be.a('string').and.not.empty);",
                "pm.test('El rol es COORDINADOR', () => pm.expect(d.usuario.rol).to.eql('COORDINADOR'));",
                "pm.test('No expone el hash de la contrasena', () => pm.expect(d.usuario).to.not.have.property('password'));",
                "pm.collectionVariables.set('tokenCoordinador', d.accessToken);",
                "pm.collectionVariables.set('idCoordinador', d.usuario.id);",
            ],
        ),
        peticion(
            "Iniciar sesion - Docente", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "jcorrea@utng.edu.mx", "password": "Siplad2026*"},
            descripcion="Guarda el token del docente en la variable tokenDocente.",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('El rol es PROFESOR', () => pm.expect(d.usuario.rol).to.eql('PROFESOR'));",
                "pm.collectionVariables.set('tokenDocente', d.accessToken);",
                "pm.collectionVariables.set('idDocente', d.usuario.id);",
            ],
        ),
        peticion(
            "Credenciales incorrectas", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "jcorrea@utng.edu.mx", "password": "ContrasenaIncorrecta"},
            descripcion=(
                "OWASP A07. Verifica que el mensaje sea identico al de un correo inexistente, "
                "de modo que la respuesta no permita deducir que cuentas existen."
            ),
            tests=[
                "pm.test('Responde 401', () => pm.response.to.have.status(401));",
                "const d = pm.response.json();",
                "pm.test('Mensaje generico', () => pm.expect(d.message).to.eql('Las credenciales proporcionadas no son correctas.'));",
                "pm.collectionVariables.set('mensajeCredencialesMalas', d.message);",
            ],
        ),
        peticion(
            "Correo inexistente", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "nadie@utng.edu.mx", "password": "Siplad2026*"},
            descripcion="OWASP A07. El mensaje debe coincidir con el de la peticion anterior.",
            tests=[
                "pm.test('Responde 401', () => pm.response.to.have.status(401));",
                "const d = pm.response.json();",
                "pm.test('El mensaje no distingue correo inexistente de contrasena incorrecta',",
                "  () => pm.expect(d.message).to.eql(pm.collectionVariables.get('mensajeCredencialesMalas')));",
            ],
        ),
        peticion(
            "Correo con formato invalido", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "esto-no-es-un-correo", "password": "Siplad2026*"},
            descripcion="OWASP A03. La validacion rechaza la entrada antes de consultar la base.",
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Indica el problema del correo',",
                "  () => pm.expect(JSON.stringify(pm.response.json().message)).to.include('correo'));",
            ],
        ),
        peticion(
            "Propiedad no declarada en el contrato", "POST", "/api/auth/login", token=False,
            cuerpo={"email": "jcorrea@utng.edu.mx", "password": "Siplad2026*", "rol": "COORDINADOR"},
            descripcion=(
                "OWASP A03. Previene la asignacion masiva de atributos: un campo que el DTO "
                "no declara hace fallar la peticion en lugar de colarse al dominio."
            ),
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Senala la propiedad rechazada',",
                "  () => pm.expect(JSON.stringify(pm.response.json().message)).to.include('rol'));",
            ],
        ),
        peticion(
            "Registro con correo ya existente", "POST", "/api/auth/registro", token=False,
            cuerpo={"email": "jcorrea@utng.edu.mx", "nombre": "Intento Duplicado",
                    "password": "Siplad2026*"},
            descripcion=(
                "Regla de negocio: el correo es unico. Se prueba el caso de conflicto y no "
                "el alta exitosa, para que la coleccion pueda ejecutarse repetidas veces sin "
                "dejar usuarios de prueba acumulados en la base."
            ),
            tests=[
                "pm.test('Responde 409', () => pm.response.to.have.status(409));",
                "pm.test('Explica el conflicto',",
                "  () => pm.expect(pm.response.json().message).to.include('Ya existe una cuenta'));",
            ],
        ),
        peticion(
            "Perfil del usuario autenticado", "GET", "/api/auth/perfil", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Es el perfil de coordinacion',",
                "  () => pm.expect(pm.response.json().email).to.eql('coordinacion@utng.edu.mx'));",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 02 — Catalogos
# --------------------------------------------------------------------------
catalogos = {
    "name": "02 - Catalogos",
    "description": "Datos de apoyo. Guardan los identificadores que usan las carpetas siguientes.",
    "item": [
        peticion(
            "Materias activas", "GET", "/api/catalogos/materias", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Devuelve el catalogo', () => pm.expect(d).to.be.an('array').that.is.not.empty);",
                "pm.collectionVariables.set('materiaId', d[0].id);",
                "pm.collectionVariables.set('materiaNombre', d[0].nombre);",
            ],
        ),
        peticion(
            "Periodo academico activo", "GET", "/api/catalogos/periodos/activo", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Hay un periodo activo', () => pm.expect(d).to.have.property('id'));",
                "pm.collectionVariables.set('periodoId', d.id);",
            ],
        ),
        peticion(
            "Todos los periodos academicos", "GET", "/api/catalogos/periodos",
            token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Devuelve el historial de periodos',",
                "  () => pm.expect(pm.response.json()).to.be.an('array').that.is.not.empty);",
            ],
        ),
        peticion(
            "Detalle del periodo con dias habiles", "GET",
            "/api/catalogos/periodos/{{periodoId}}", token="tokenDocente",
            descripcion=(
                "Integracion 3 de 3. Los dias inhabiles provienen del servicio externo "
                "Nager.Date; si el servicio no responde, el calculo degrada sin romper."
            ),
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Calcula dias habiles', () => pm.expect(d.diasHabiles).to.be.a('number'));",
                "pm.test('Informa los dias inhabiles del periodo', () => pm.expect(d.diasInhabiles).to.be.an('array'));",
                "console.log('Dias habiles:', d.diasHabiles, '| inhabiles en el periodo:', d.diasInhabiles.length);",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 03 — Planeacion didactica
# --------------------------------------------------------------------------
planeaciones = {
    "name": "03 - Planeacion didactica",
    "description": "Web Service 2 de 5. Ciclo completo: alta, consulta, correccion y dictamen.",
    "item": [
        peticion(
            "Registrar planeacion", "POST", "/api/planeaciones", token="tokenDocente",
            cuerpo={
                "parcial": 3,
                "contenido": "Planeacion de prueba creada desde Postman. Incluye objetivos de aprendizaje, secuencia didactica, recursos e instrumentos de evaluacion.",
                "materiaId": "{{materiaId}}",
                "periodoId": "{{periodoId}}",
            },
            tests=[
                "pm.test('Responde 201', () => pm.response.to.have.status(201));",
                "const d = pm.response.json();",
                "pm.test('Nace en estado ENVIADA', () => pm.expect(d.estado).to.eql('ENVIADA'));",
                "pm.test('Se atribuye al autor', () => pm.expect(d.usuarioId).to.eql(pm.collectionVariables.get('idDocente')));",
                "pm.collectionVariables.set('planeacionId', d.id);",
            ],
        ),
        peticion(
            "Rechazar planeacion duplicada", "POST", "/api/planeaciones", token="tokenDocente",
            cuerpo={
                "parcial": 3,
                "contenido": "Segundo intento para la misma materia, periodo y parcial. Debe ser rechazado por la regla de unicidad.",
                "materiaId": "{{materiaId}}",
                "periodoId": "{{periodoId}}",
            },
            descripcion="Regla de negocio: una sola planeacion por docente, materia, periodo y parcial.",
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Explica el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('Ya existe una planeacion'));",
            ],
        ),
        peticion(
            "Listar mis planeaciones", "GET", "/api/planeaciones", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "const propio = pm.collectionVariables.get('idDocente');",
                "pm.test('Solo devuelve las del docente autenticado',",
                "  () => pm.expect(d.every(p => p.usuarioId === propio)).to.be.true);",
            ],
        ),
        peticion(
            "Filtro de usuario ignorado para el docente", "GET", "/api/planeaciones",
            token="tokenDocente", consulta={"usuarioId": "{{idCoordinador}}"},
            descripcion=(
                "OWASP A01. El docente intenta consultar las planeaciones de otra persona "
                "mediante un parametro. El servidor impone el filtro de propiedad y descarta "
                "el enviado por el cliente."
            ),
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "const propio = pm.collectionVariables.get('idDocente');",
                "pm.test('Sigue devolviendo solo las propias',",
                "  () => pm.expect(d.every(p => p.usuarioId === propio)).to.be.true);",
            ],
        ),
        peticion(
            "Consultar una planeacion", "GET", "/api/planeaciones/{{planeacionId}}",
            token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Incluye la materia relacionada',",
                "  () => pm.expect(pm.response.json().materia).to.have.property('clave'));",
            ],
        ),
        peticion(
            "Corregir planeacion", "PATCH", "/api/planeaciones/{{planeacionId}}",
            token="tokenDocente",
            cuerpo={"contenido": "Contenido corregido desde Postman con el detalle de los instrumentos de evaluacion que faltaban."},
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Vuelve a revision', () => pm.expect(pm.response.json().estado).to.eql('ENVIADA'));",
            ],
        ),
        peticion(
            "Solicitar ajustes sin motivo", "PATCH", "/api/planeaciones/{{planeacionId}}/revision",
            token="tokenCoordinador", cuerpo={"estado": "AJUSTES_SOLICITADOS"},
            descripcion="Regla de negocio: la solicitud de ajustes exige un comentario.",
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Exige el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('motivo'));",
            ],
        ),
        peticion(
            "Aprobar planeacion", "PATCH", "/api/planeaciones/{{planeacionId}}/revision",
            token="tokenCoordinador", cuerpo={"estado": "APROBADA"},
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Queda aprobada', () => pm.expect(d.estado).to.eql('APROBADA'));",
                "pm.test('Registra quien reviso', () => pm.expect(d.revisadoPor).to.not.be.null);",
                "pm.test('Registra cuando se reviso', () => pm.expect(d.revisadoEn).to.not.be.null);",
            ],
        ),
        peticion(
            "Una planeacion aprobada ya no se modifica", "PATCH",
            "/api/planeaciones/{{planeacionId}}", token="tokenDocente",
            cuerpo={"contenido": "Intento de modificacion posterior a la aprobacion, que debe ser rechazado."},
            descripcion="Regla de negocio: modificarla invalidaria el dictamen ya emitido.",
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Explica el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('aprobada'));",
            ],
        ),
        peticion(
            "Una planeacion aprobada tampoco se elimina", "DELETE",
            "/api/planeaciones/{{planeacionId}}", token="tokenDocente",
            descripcion=(
                "Regla de negocio: eliminarla dejaria huerfanos los avances registrados "
                "sobre ella y borraria el dictamen de coordinacion."
            ),
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Explica el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('aprobada'));",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 04 — Avances
# --------------------------------------------------------------------------
avances = {
    "name": "04 - Avances por parcial",
    "description": "Web Service 3 de 5. El estado se deriva del porcentaje, no lo elige el usuario.",
    "item": [
        peticion(
            "Registrar avance - CUMPLIDO", "POST", "/api/avances", token="tokenDocente",
            cuerpo={"planeacionId": "{{planeacionId}}", "porcentaje": 92,
                    "observaciones": "Avance registrado desde Postman."},
            descripcion="Umbral institucional: a partir de 85 por ciento se clasifica como cumplido.",
            tests=[
                "pm.test('Responde 201', () => pm.response.to.have.status(201));",
                "const d = pm.response.json();",
                "pm.test('El estado se deriva del porcentaje', () => pm.expect(d.estado).to.eql('CUMPLIDO'));",
                "pm.collectionVariables.set('avanceId', d.id);",
            ],
        ),
        peticion(
            "Rechazar segundo avance del mismo parcial", "POST", "/api/avances",
            token="tokenDocente",
            cuerpo={"planeacionId": "{{planeacionId}}", "porcentaje": 50},
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Explica el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('Ya existe un avance'));",
            ],
        ),
        peticion(
            "Reclasificar al cambiar el porcentaje", "PATCH", "/api/avances/{{avanceId}}",
            token="tokenDocente", cuerpo={"porcentaje": 45},
            descripcion="Por debajo de 60 por ciento la clasificacion cambia a no cumplido.",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Se reclasifica solo', () => pm.expect(pm.response.json().estado).to.eql('NO_CUMPLIDO'));",
            ],
        ),
        peticion(
            "Porcentaje fuera de rango", "PATCH", "/api/avances/{{avanceId}}",
            token="tokenDocente", cuerpo={"porcentaje": 150},
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
            ],
        ),
        peticion(
            "Restaurar el avance", "PATCH", "/api/avances/{{avanceId}}",
            token="tokenDocente", cuerpo={"porcentaje": 92},
            descripcion="Deja los datos como estaban para que la coleccion pueda repetirse.",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Vuelve a cumplido', () => pm.expect(pm.response.json().estado).to.eql('CUMPLIDO'));",
            ],
        ),
        peticion(
            "Consultar un avance", "GET", "/api/avances/{{avanceId}}", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Incluye la planeacion relacionada',",
                "  () => pm.expect(pm.response.json().planeacion).to.have.property('materia'));",
            ],
        ),
        peticion(
            "Listar mis avances", "GET", "/api/avances", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Devuelve una lista', () => pm.expect(pm.response.json()).to.be.an('array'));",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 05 — Evidencias
# --------------------------------------------------------------------------
evidencias = {
    "name": "05 - Evidencias de capacitacion",
    "description": (
        "Web Service 4 de 5. La peticion de alta envia un archivo, asi que hay que "
        "seleccionarlo a mano en la pestana Body antes de ejecutarla."
    ),
    "item": [
        peticion(
            "Cargar constancia (requiere elegir archivo)", "POST", "/api/evidencias",
            token="tokenDocente",
            descripcion=(
                "Antes de enviar: pestana Body, fila 'archivo', boton Select Files, y elige "
                "un PDF, JPG o PNG menor a 5 MB.\n\n"
                "Integracion 2 de 3. Si hay credenciales de Cloudinary, el archivo se envia "
                "al proveedor externo; si no, se guarda en el disco del servidor."
            ),
            formdata=[
                {"key": "nombreCurso", "value": "Curso cargado desde Postman", "type": "text"},
                {"key": "institucion", "value": "Secretaria de Educacion de Guanajuato", "type": "text"},
                {"key": "fecha", "value": "2026-09-15", "type": "text"},
                {"key": "horas", "value": "30", "type": "text"},
                {"key": "periodoId", "value": "{{periodoId}}", "type": "text"},
                {"key": "archivo", "type": "file", "src": []},
            ],
            tests=[
                "pm.test('Responde 201', () => pm.response.to.have.status(201));",
                "const d = pm.response.json();",
                "pm.test('Nace pendiente de validacion', () => pm.expect(d.estado).to.eql('PENDIENTE'));",
                "pm.test('Persiste solo la referencia al archivo', () => pm.expect(d.archivoUrl).to.be.a('string'));",
                "pm.collectionVariables.set('evidenciaId', d.id);",
                "console.log('Archivo almacenado en:', d.archivoUrl);",
            ],
        ),
        peticion(
            "Listar mis constancias", "GET", "/api/evidencias", token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Devuelve una lista', () => pm.expect(d).to.be.an('array'));",
                "if (!pm.collectionVariables.get('evidenciaId') && d.length) {",
                "  pm.collectionVariables.set('evidenciaId', d.find(e => e.estado === 'PENDIENTE')?.id ?? d[0].id);",
                "}",
            ],
        ),
        peticion(
            "Bandeja de validacion", "GET", "/api/evidencias", token="tokenCoordinador",
            consulta={"estado": "PENDIENTE"},
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Todas estan pendientes',",
                "  () => pm.expect(d.every(e => e.estado === 'PENDIENTE')).to.be.true);",
            ],
        ),
        peticion(
            "Rechazar constancia sin motivo", "PATCH",
            "/api/evidencias/{{evidenciaId}}/validacion", token="tokenCoordinador",
            cuerpo={"estado": "RECHAZADA"},
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Exige el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('motivo'));",
            ],
        ),
        peticion(
            "Validar constancia", "PATCH", "/api/evidencias/{{evidenciaId}}/validacion",
            token="tokenCoordinador", cuerpo={"estado": "VALIDADA"},
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Queda validada', () => pm.expect(d.estado).to.eql('VALIDADA'));",
                "pm.test('Registra quien valido', () => pm.expect(d.validadoPor).to.not.be.null);",
            ],
        ),
        peticion(
            "Consultar una constancia", "GET", "/api/evidencias/{{evidenciaId}}",
            token="tokenDocente",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Trae las horas acreditadas',",
                "  () => pm.expect(pm.response.json().horas).to.be.a('number'));",
            ],
        ),
        peticion(
            "Una constancia validada no se elimina", "DELETE",
            "/api/evidencias/{{evidenciaId}}", token="tokenDocente",
            descripcion=(
                "Regla de negocio: sus horas ya cuentan en los indicadores institucionales, "
                "asi que eliminarla alteraria reportes ya emitidos."
            ),
            tests=[
                "pm.test('Responde 400', () => pm.response.to.have.status(400));",
                "pm.test('Explica el motivo',",
                "  () => pm.expect(pm.response.json().message).to.include('validada'));",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 06 — Reportes
# --------------------------------------------------------------------------
reportes = {
    "name": "06 - Reportes institucionales",
    "description": "Web Service 5 de 5. Todas las rutas estan reservadas al rol COORDINADOR.",
    "item": [
        peticion(
            "Indicadores globales", "GET", "/api/reportes/indicadores", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Calcula el cumplimiento de planeacion',",
                "  () => pm.expect(d.planeaciones.porcentajeCumplimiento).to.be.a('number'));",
                "pm.test('Calcula el promedio de avance',",
                "  () => pm.expect(d.avances.porcentajePromedio).to.be.a('number'));",
                "pm.test('Suma horas acreditadas',",
                "  () => pm.expect(d.capacitacion.horasAcreditadas).to.be.a('number'));",
                "pm.test('Incorpora los dias habiles de la integracion externa',",
                "  () => pm.expect(d).to.have.property('diasHabilesDelPeriodo'));",
            ],
        ),
        peticion(
            "Cumplimiento por docente", "GET", "/api/reportes/por-docente", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "const d = pm.response.json();",
                "pm.test('Devuelve una fila por docente', () => pm.expect(d).to.be.an('array'));",
                "if (d.length) pm.test('Cada fila trae su porcentaje',",
                "  () => pm.expect(d[0]).to.have.property('porcentajeCumplimientoPlaneacion'));",
            ],
        ),
        peticion(
            "Cumplimiento por parcial", "GET", "/api/reportes/por-parcial", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Devuelve los tres parciales',",
                "  () => pm.expect(pm.response.json()).to.have.lengthOf(3));",
            ],
        ),
        peticion(
            "Cumplimiento por materia", "GET", "/api/reportes/por-materia", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('Devuelve una lista', () => pm.expect(pm.response.json()).to.be.an('array'));",
            ],
        ),
        peticion(
            "Exportar a Excel", "GET", "/api/reportes/exportar/excel", token="tokenCoordinador",
            descripcion="Usa 'Save Response > Save to a file' para conservar el archivo como evidencia.",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('El tipo es una hoja de calculo',",
                "  () => pm.expect(pm.response.headers.get('Content-Type')).to.include('spreadsheetml'));",
                "pm.test('Se ofrece como descarga',",
                "  () => pm.expect(pm.response.headers.get('Content-Disposition')).to.include('attachment'));",
                "const b = pm.response.stream;",
                "pm.test('El archivo es un contenedor valido (firma PK)',",
                "  () => pm.expect(String.fromCharCode(b[0], b[1])).to.eql('PK'));",
            ],
        ),
        peticion(
            "Exportar a PDF", "GET", "/api/reportes/exportar/pdf", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 200', () => pm.response.to.have.status(200));",
                "pm.test('El tipo es PDF',",
                "  () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/pdf'));",
                "const b = pm.response.stream;",
                "pm.test('El archivo es un PDF valido (firma %PDF)',",
                "  () => pm.expect(String.fromCharCode(b[0], b[1], b[2], b[3])).to.eql('%PDF'));",
            ],
        ),
    ],
}

# --------------------------------------------------------------------------
# 07 — Control de acceso
# --------------------------------------------------------------------------
acceso = {
    "name": "07 - Control de acceso",
    "description": (
        "Pruebas negativas. Son las mas importantes de la coleccion: demuestran que el "
        "control de acceso funciona, no solo que las rutas felices responden."
    ),
    "item": [
        peticion(
            "Sin token - planeaciones", "GET", "/api/planeaciones", token=False,
            tests=["pm.test('Responde 401', () => pm.response.to.have.status(401));"],
        ),
        peticion(
            "Sin token - reportes", "GET", "/api/reportes/indicadores", token=False,
            tests=["pm.test('Responde 401', () => pm.response.to.have.status(401));"],
        ),
        peticion(
            "Sin token - evidencias", "GET", "/api/evidencias", token=False,
            tests=["pm.test('Responde 401', () => pm.response.to.have.status(401));"],
        ),
        {
            "name": "Token falsificado",
            "request": {
                "method": "GET",
                "header": [],
                "auth": {"type": "bearer", "bearer": [
                    {"key": "token", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.falsificado.firma", "type": "string"}]},
                "url": url("/api/planeaciones"),
                "description": "OWASP A02. La firma no corresponde al secreto del servidor.",
            },
            "response": [],
            "event": prueba("pm.test('Responde 401', () => pm.response.to.have.status(401));"),
        },
        peticion(
            "Docente intenta ver los reportes", "GET", "/api/reportes/indicadores",
            token="tokenDocente",
            descripcion=(
                "OWASP A01. El docente esta autenticado, pero su rol no alcanza. La diferencia "
                "entre 401 y 403 es justamente esa: aqui se sabe quien es, y no se le permite."
            ),
            tests=[
                "pm.test('Responde 403, no 401', () => pm.response.to.have.status(403));",
                "pm.test('Explica que faltan permisos',",
                "  () => pm.expect(pm.response.json().message).to.include('permisos'));",
            ],
        ),
        peticion(
            "Docente intenta exportar un reporte", "GET", "/api/reportes/exportar/excel",
            token="tokenDocente",
            tests=["pm.test('Responde 403', () => pm.response.to.have.status(403));"],
        ),
        peticion(
            "Docente intenta dictaminar una planeacion", "PATCH",
            "/api/planeaciones/{{planeacionId}}/revision", token="tokenDocente",
            cuerpo={"estado": "APROBADA"},
            descripcion="OWASP A01. Aprobar su propia planeacion esta reservado a coordinacion.",
            tests=["pm.test('Responde 403', () => pm.response.to.have.status(403));"],
        ),
        peticion(
            "Docente intenta validar una constancia", "PATCH",
            "/api/evidencias/{{evidenciaId}}/validacion", token="tokenDocente",
            cuerpo={"estado": "VALIDADA"},
            tests=["pm.test('Responde 403', () => pm.response.to.have.status(403));"],
        ),
        peticion(
            "Coordinacion intenta registrar una planeacion", "POST", "/api/planeaciones",
            token="tokenCoordinador",
            cuerpo={
                "parcial": 1,
                "contenido": "Coordinacion no imparte clase, asi que no registra planeacion didactica propia.",
                "materiaId": "{{materiaId}}",
                "periodoId": "{{periodoId}}",
            },
            descripcion="La restriccion opera en los dos sentidos, no solo hacia abajo.",
            tests=["pm.test('Responde 403', () => pm.response.to.have.status(403));"],
        ),
        peticion(
            "Identificador inexistente", "GET",
            "/api/planeaciones/00000000-0000-4000-8000-000000000000", token="tokenCoordinador",
            tests=[
                "pm.test('Responde 404', () => pm.response.to.have.status(404));",
                "pm.test('No filtra detalles internos',",
                "  () => pm.expect(JSON.stringify(pm.response.json())).to.not.include('prisma'));",
            ],
        ),
        peticion(
            "Identificador con formato invalido", "GET", "/api/planeaciones/no-es-un-uuid",
            token="tokenCoordinador",
            descripcion="OWASP A03. La validacion rechaza la entrada antes de consultar la base.",
            tests=["pm.test('Responde 400', () => pm.response.to.have.status(400));"],
        ),
    ],
}

# --------------------------------------------------------------------------
# Coleccion
# --------------------------------------------------------------------------
coleccion = {
    "info": {
        "_postman_id": str(uuid.uuid4()),
        "name": "SIPLAD - Pruebas funcionales manuales",
        "description": (
            "Coleccion de pruebas manuales de los cinco Web Services de SIPLAD.\n\n"
            "## Como ejecutarla\n\n"
            "1. Levanta el backend y asegurate de haber sembrado los datos.\n"
            "2. Ajusta la variable `baseUrl` si no usas el puerto 3000.\n"
            "3. Ejecuta las carpetas **en orden**: las primeras guardan los tokens y los "
            "identificadores que usan las siguientes.\n"
            "4. La carpeta 05 requiere elegir un archivo a mano antes de enviar.\n\n"
            "## Que verifica\n\n"
            "Cada peticion lleva aserciones en la pestana Tests, asi que la ejecucion "
            "informa si paso o fallo, en lugar de dejar la interpretacion al criterio de "
            "quien la ejecuta.\n\n"
            "La carpeta **07 - Control de acceso** contiene pruebas negativas: comprueban "
            "que el sistema rechaza lo que debe rechazar. Son la evidencia mas fuerte de "
            "la coleccion.\n\n"
            "Tambien puede ejecutarse de forma automatizada:\n\n"
            "```\nnewman run SIPLAD.postman_collection.json -e SIPLAD.postman_environment.json\n```"
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "item": [estado, autenticacion, catalogos, planeaciones, avances, evidencias, reportes, acceso],
    "variable": [
        {"key": "baseUrl", "value": "http://localhost:3000", "type": "string"},
        {"key": "tokenCoordinador", "value": "", "type": "string"},
        {"key": "tokenDocente", "value": "", "type": "string"},
        {"key": "idCoordinador", "value": "", "type": "string"},
        {"key": "idDocente", "value": "", "type": "string"},
        {"key": "materiaId", "value": "", "type": "string"},
        {"key": "materiaNombre", "value": "", "type": "string"},
        {"key": "periodoId", "value": "", "type": "string"},
        {"key": "planeacionId", "value": "", "type": "string"},
        {"key": "avanceId", "value": "", "type": "string"},
        {"key": "evidenciaId", "value": "", "type": "string"},
        {"key": "mensajeCredencialesMalas", "value": "", "type": "string"},
    ],
}

entorno = {
    "id": str(uuid.uuid4()),
    "name": "SIPLAD - Local",
    "values": [
        {"key": "baseUrl", "value": "http://localhost:3000", "type": "default", "enabled": True},
    ],
    "_postman_variable_scope": "environment",
}

with open("SIPLAD.postman_collection.json", "w", encoding="utf-8") as f:
    json.dump(coleccion, f, indent=2, ensure_ascii=False)

with open("SIPLAD.postman_environment.json", "w", encoding="utf-8") as f:
    json.dump(entorno, f, indent=2, ensure_ascii=False)

total = sum(len(c["item"]) for c in coleccion["item"])
print(f"Coleccion generada: {len(coleccion['item'])} carpetas, {total} peticiones")
for c in coleccion["item"]:
    print(f"  {c['name']}: {len(c['item'])}")
