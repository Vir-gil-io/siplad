-- Tramo informado del avance.
--
-- Las columnas se agregan primero como opcionales y se rellenan a partir del
-- periodo academico de la planeacion, porque en produccion ya existen avances
-- registrados: anadirlas directamente como obligatorias haria fallar la
-- migracion sobre una tabla con datos. Una vez relleno el historico, se
-- imponen como obligatorias.

ALTER TABLE "avances" ADD COLUMN "fechaInicio" TIMESTAMP(3);
ALTER TABLE "avances" ADD COLUMN "fechaFin" TIMESTAMP(3);

UPDATE "avances" AS a
SET "fechaInicio" = per."fechaInicio",
    "fechaFin"    = LEAST(per."fechaFin", a."registradoEn")
FROM "planeaciones" AS pl
JOIN "periodos_academicos" AS per ON per."id" = pl."periodoId"
WHERE a."planeacionId" = pl."id";

-- Red de seguridad: si algun avance quedara huerfano de periodo, se le asigna
-- el dia de su registro para no bloquear la migracion.
UPDATE "avances"
SET "fechaInicio" = COALESCE("fechaInicio", "registradoEn"),
    "fechaFin"    = COALESCE("fechaFin", "registradoEn")
WHERE "fechaInicio" IS NULL OR "fechaFin" IS NULL;

ALTER TABLE "avances" ALTER COLUMN "fechaInicio" SET NOT NULL;
ALTER TABLE "avances" ALTER COLUMN "fechaFin" SET NOT NULL;
