/*
  Warnings:

  - You are about to drop the column `descricao` on the `itens` table. All the data in the column will be lost.
  - Added the required column `item` to the `itens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nNf` to the `itens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "itens" DROP COLUMN "descricao",
ADD COLUMN     "item" TEXT NOT NULL,
ADD COLUMN     "nNf" INTEGER NOT NULL,
ALTER COLUMN "qtdOriginal" DROP NOT NULL,
ALTER COLUMN "unMedida" DROP NOT NULL,
ALTER COLUMN "qtdcx" DROP NOT NULL,
ALTER COLUMN "peso" DROP NOT NULL,
ALTER COLUMN "temExcecao" SET DEFAULT false,
ALTER COLUMN "notaFiscalId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "notas_fiscais" ALTER COLUMN "freteUnitKg" DROP NOT NULL,
ALTER COLUMN "freteUnitCx" DROP NOT NULL,
ALTER COLUMN "fonte" DROP NOT NULL,
ALTER COLUMN "destinatario" DROP NOT NULL,
ALTER COLUMN "valorNF" DROP NOT NULL,
ALTER COLUMN "transportadora" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "notas_fiscais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
