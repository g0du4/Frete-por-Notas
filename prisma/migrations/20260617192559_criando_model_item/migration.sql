-- CreateTable
CREATE TABLE "itens" (
    "id" SERIAL NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "qtdOriginal" INTEGER NOT NULL,
    "unMedida" TEXT NOT NULL,
    "qtdcx" INTEGER NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "precoCobrado" DOUBLE PRECISION NOT NULL,
    "temExcecao" BOOLEAN NOT NULL,
    "tipoCalculoItem" TEXT NOT NULL,

    CONSTRAINT "itens_pkey" PRIMARY KEY ("id")
);
