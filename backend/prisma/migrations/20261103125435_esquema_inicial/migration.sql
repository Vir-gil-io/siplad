-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('PROFESOR', 'COORDINADOR');

-- CreateEnum
CREATE TYPE "EstadoPlaneacion" AS ENUM ('ENVIADA', 'APROBADA', 'AJUSTES_SOLICITADOS');

-- CreateEnum
CREATE TYPE "EstadoAvance" AS ENUM ('CUMPLIDO', 'PARCIAL', 'NO_CUMPLIDO');

-- CreateEnum
CREATE TYPE "EstadoEvidencia" AS ENUM ('PENDIENTE', 'VALIDADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'PROFESOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_academicos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planeaciones" (
    "id" TEXT NOT NULL,
    "parcial" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "archivoUrl" TEXT,
    "estado" "EstadoPlaneacion" NOT NULL DEFAULT 'ENVIADA',
    "comentarioRevision" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "revisadoPorId" TEXT,

    CONSTRAINT "planeaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avances" (
    "id" TEXT NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "estado" "EstadoAvance" NOT NULL,
    "observaciones" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "planeacionId" TEXT NOT NULL,

    CONSTRAINT "avances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" TEXT NOT NULL,
    "nombreCurso" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horas" INTEGER NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "estado" "EstadoEvidencia" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "validadoEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "validadoPorId" TEXT,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_googleId_key" ON "usuarios"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "materias_clave_key" ON "materias"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_academicos_nombre_key" ON "periodos_academicos"("nombre");

-- CreateIndex
CREATE INDEX "planeaciones_usuarioId_idx" ON "planeaciones"("usuarioId");

-- CreateIndex
CREATE INDEX "planeaciones_periodoId_idx" ON "planeaciones"("periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "planeaciones_usuarioId_materiaId_periodoId_parcial_key" ON "planeaciones"("usuarioId", "materiaId", "periodoId", "parcial");

-- CreateIndex
CREATE UNIQUE INDEX "avances_planeacionId_key" ON "avances"("planeacionId");

-- CreateIndex
CREATE INDEX "evidencias_usuarioId_idx" ON "evidencias"("usuarioId");

-- CreateIndex
CREATE INDEX "evidencias_periodoId_idx" ON "evidencias"("periodoId");

-- AddForeignKey
ALTER TABLE "planeaciones" ADD CONSTRAINT "planeaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planeaciones" ADD CONSTRAINT "planeaciones_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planeaciones" ADD CONSTRAINT "planeaciones_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planeaciones" ADD CONSTRAINT "planeaciones_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances" ADD CONSTRAINT "avances_planeacionId_fkey" FOREIGN KEY ("planeacionId") REFERENCES "planeaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
