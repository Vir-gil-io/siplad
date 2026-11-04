# SIPLAD — Sistema Institucional de Planeación y Avance Docente

Aplicación web que permite a las instituciones de nivel medio superior dar seguimiento al
cumplimiento de la planeación didáctica de sus docentes, al control de avances por parcial y
a las evidencias de capacitación acreditadas durante un periodo académico.

**Proyecto Integrador Global** — Desarrollo Web Integral
Ingeniería en Desarrollo y Gestión de Software — Universidad Tecnológica del Norte de Guanajuato

---

## Problemática que resuelve

El seguimiento de la planeación didáctica en el nivel medio superior se realiza habitualmente
con archivos dispersos, correo electrónico y hojas de cálculo. Esto provoca pérdida de
evidencias, imposibilidad de consultar ciclos anteriores y ausencia de indicadores confiables
para la coordinación académica. SIPLAD centraliza el registro, la revisión y la generación de
reportes institucionales en una sola plataforma segura.

## Módulos

| Módulo                               | Descripción                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestión de planeación didáctica      | Registro y carga de planeación por materia y parcial; revisión, aprobación o solicitud de ajustes por coordinación; historial de ciclos anteriores. |
| Control de avances por parcial       | Registro del avance logrado respecto a la planeación inicial, con estado cumplido, parcial o no cumplido.                                           |
| Evidencias de capacitación           | Carga de constancias en PDF o imagen con nombre del curso, institución emisora, fecha y horas acreditadas; validación por coordinación.             |
| Reportes y seguimiento institucional | Porcentaje de cumplimiento de planeaciones, cumplimiento de avances por parcial y cursos acreditados por periodo, con exportación a PDF y Excel.    |

## Arquitectura

Arquitectura multicapa de cinco capas:

| Capa              | Responsabilidad                                 | Implementación                        |
| ----------------- | ----------------------------------------------- | ------------------------------------- |
| Presentación      | Interfaz de usuario y experiencia               | React + Vite + TailwindCSS            |
| Lógica de negocio | Reglas del dominio, validaciones y orquestación | NestJS (servicios y casos de uso)     |
| Datos             | Persistencia y acceso a información             | Prisma ORM + PostgreSQL               |
| Integración       | Consumo de servicios externos                   | Google OAuth2, Cloudinary, Nager.Date |
| Pruebas           | Verificación automatizada y manual              | Jest, Supertest, Postman              |

## Stack tecnológico

**Frontend:** React 19, Vite, TailwindCSS, Recharts, Axios
**Backend:** NestJS 11, Prisma ORM, Passport (JWT y Google OAuth2), class-validator, Helmet
**Base de datos:** PostgreSQL 16
**Contenedores:** Docker, Docker Compose, Nginx como balanceador de carga
**Nube:** Render (servicio web, base de datos administrada, dominio y certificado SSL)
**Calidad y seguridad:** GitHub Actions, CodeQL, npm audit, OWASP Top 10

## Estructura del repositorio

```
siplad/
├── .github/
│   ├── workflows/        Automatizaciones de CI, escaneo de seguridad y validación de PR
│   ├── ISSUE_TEMPLATE/   Plantillas de historia de usuario y tarea técnica
│   └── pull_request_template.md
├── backend/              API REST en NestJS
├── frontend/             Aplicación React
├── docs/                 Metodología, esquema de pruebas y políticas de versionamiento
├── infra/                Dockerfiles, docker-compose y configuración de Nginx
└── scripts/              Utilidades de automatización del proyecto
```

## Puesta en marcha local

```bash
# Backend
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev

# Entorno completo con contenedores
docker compose -f infra/compose.yaml up --build
```

## Documentación del proyecto

- [Metodología ágil](docs/03-metodologia-agil.md)
- [Esquema de pruebas](docs/02-esquema-de-pruebas.md)
- [Políticas de control de versiones](docs/01-politicas-control-versiones.md)

## Autor

Gilberto Fabián Correa González — Número de control 1223100401 — Grupo GIDS6091
