-- CreateTable
CREATE TABLE "public"."Industry" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Verifier" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Verifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationTask" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "industryId" INTEGER NOT NULL,
    "verifierId" INTEGER NOT NULL,
    "evidenceLinks" TEXT[],

    CONSTRAINT "VerificationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Industry_email_key" ON "public"."Industry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Verifier_email_key" ON "public"."Verifier"("email");

-- AddForeignKey
ALTER TABLE "public"."VerificationTask" ADD CONSTRAINT "VerificationTask_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "public"."Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationTask" ADD CONSTRAINT "VerificationTask_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "public"."Verifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
