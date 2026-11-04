# ---------------------------------------------------------------------------
# SIPLAD — Imagen del frontend
#
# El resultado de compilar una aplicacion de React son archivos estaticos, asi
# que la imagen final no contiene Node: solo Nginx sirviendo HTML, CSS y
# JavaScript. Pasa de unos 400 MB a unos 50.
# ---------------------------------------------------------------------------

# --- Etapa 1: compilacion ---------------------------------------------------
FROM node:26-slim AS compilacion

WORKDIR /app

# Playwright es dependencia de desarrollo para la prueba de humo. Al
# instalarse descarga navegadores, que aqui no se usan y pesan cientos de
# megabytes: se omite la descarga de forma explicita.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci

COPY . .

# La direccion de la API se fija en tiempo de compilacion porque Vite la
# incrusta en el paquete. Por omision queda vacia y la aplicacion usa rutas
# relativas (/api), que el balanceador reenvia al backend.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# --- Etapa 2: servicio ------------------------------------------------------
FROM nginx:1.27-alpine AS servicio

COPY --from=compilacion /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
