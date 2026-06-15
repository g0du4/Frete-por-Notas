-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "nNF" INTEGER NOT NULL,
    "totalCx" INTEGER NOT NULL DEFAULT 0,
    "pesoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frete" DOUBLE PRECISION NOT NULL,
    "freteUnitKg" DOUBLE PRECISION NOT NULL,
    "freteUnitCx" DOUBLE PRECISION NOT NULL,
    "fonte" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "destCNPJ" TEXT NOT NULL,
    "valorNF" DOUBLE PRECISION NOT NULL,
    "transportadora" TEXT NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);
