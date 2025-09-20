-- AlterTable
ALTER TABLE "public"."Industry" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'INDUSTRY';

-- AlterTable
ALTER TABLE "public"."Verifier" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'VERIFIER';
