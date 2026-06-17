/*
  Warnings:

  - Changed the type of `notaFiscalId` on the `itens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "itens" DROP COLUMN "notaFiscalId",
ADD COLUMN     "notaFiscalId" INTEGER NOT NULL;
