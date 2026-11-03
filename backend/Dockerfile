# ---------------------------------------------------------------------------
# SIPLAD — Imagen del backend
#
# Construccion multietapa. La imagen final no lleva el codigo TypeScript, ni
# las dependencias de desarrollo, ni el compilador: solo lo necesario para
# ejecutar la aplicacion.
#
# Se usa la variante Debian (slim) y no Alpine de forma deliberada: el motor
# de consultas de Prisma depende de OpenSSL y la combinacion con musl es una
# fuente conocida de fallos en tiempo de ejecucion.
# ---------------------------------------------------------------------------

# --- Etapa 1: dependencias completas y cliente de Prisma -------------------
FROM node:22-slim AS dependencias

WORKDIR /app

# OpenSSL es requisito del motor de Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Se copian primero los manifiestos: mientras no cambien, Docker reutiliza
# la capa de instalacion y la construccion es mucho mas rapida.
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

# El cliente se genera dentro del contenedor, de modo que el motor
# corresponde a la plataforma de la imagen y no a la del equipo que compila.
RUN npx prisma generate


# --- Etapa 2: compilacion ---------------------------------------------------
FROM node:22-slim AS compilacion

WORKDIR /app

COPY --from=dependencias /app/node_modules ./node_modules
COPY . .

RUN npm run build


# --- Etapa 3: dependencias de produccion ------------------------------------
FROM node:22-slim AS dependencias-produccion

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force


# --- Etapa 4: ejecucion -----------------------------------------------------
FROM node:22-slim AS ejecucion

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencias-produccion /app/node_modules ./node_modules
COPY --from=compilacion /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma

# El proceso corre como usuario sin privilegios: si alguien lograra ejecutar
# codigo dentro del contenedor, no seria root. La imagen de Node ya trae el
# usuario 'node' creado.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

# El orquestador necesita saber cuando la instancia esta lista para recibir
# trafico; sin esto, el balanceador podria enviarle peticiones antes de que
# la aplicacion termine de arrancar.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Las migraciones se aplican con 'migrate deploy', que solo ejecuta las ya
# generadas y no necesita permiso para crear bases de datos.
#
# Por eso el CLI de Prisma viaja en 'dependencies' y no en 'devDependencies':
# esta etapa instala con --omit=dev, y si el CLI faltara, 'npx' intentaria
# descargarlo de la red en cada arranque del contenedor. Un contenedor de
# produccion no debe depender del registro de paquetes para encenderse; si la
# descarga falla, la cadena se rompe y el contenedor queda reiniciandose.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
