-- CreateEnum
CREATE TYPE "Sheet" AS ENUM ('MEMECOIN', 'CELEBRITY_COIN', 'NFT', 'COLLECTION', 'PROVFI');

-- CreateEnum
CREATE TYPE "YesNo" AS ENUM ('YES', 'NO', 'UNKNOWN', 'NA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "IdentityKind" AS ENUM ('EMAIL', 'WALLET');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'LOGIN', 'USER_CHANGE');

-- CreateTable
CREATE TABLE "Artefact" (
    "id" TEXT NOT NULL,
    "sheet" "Sheet" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rowType" TEXT,
    "ticker" TEXT,
    "creatorName" TEXT,
    "creatorSocial" TEXT,
    "creatorAddr" TEXT,
    "category" TEXT,
    "note" TEXT,
    "chains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contracts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "websiteUrl" TEXT,
    "xUrl" TEXT,
    "tgUrl" TEXT,
    "discordUrl" TEXT,
    "kymUrl" TEXT,
    "imageUrl" TEXT,
    "marketplaceUrl" TEXT,
    "explorerUrl" TEXT,
    "provenanceUrl" TEXT,
    "launchDate" TIMESTAMP(3),
    "launchRaw" TEXT,
    "description" TEXT,
    "tagsCategory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagsProvenance" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flags" JSONB NOT NULL DEFAULT '{}',
    "flagsRaw" JSONB NOT NULL DEFAULT '{}',
    "sourceRow" JSONB,
    "sourceSheet" TEXT,
    "sourceLine" INTEGER,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artefact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemecoinDetail" (
    "artefactId" TEXT NOT NULL,
    "decimals" INTEGER,
    "provenanceGrade" TEXT,
    "memePopularity" TEXT,
    "fairLaunchScore" TEXT,
    "athMarketcap" TEXT,
    "overallGrade" TEXT,
    "projectSocials" TEXT,
    "provenanceProof" TEXT,
    "onboardingAgents" TEXT,
    "listedOnIndex" TEXT,
    "tokenSlug" TEXT,
    "blockOrigin" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fractionalizedOf" TEXT,

    CONSTRAINT "MemecoinDetail_pkey" PRIMARY KEY ("artefactId")
);

-- CreateTable
CREATE TABLE "NftDetail" (
    "artefactId" TEXT NOT NULL,
    "tokenAddress" TEXT,
    "lastSalePrice" TEXT,
    "lastSaleDate" TEXT,
    "currentOwner" TEXT,
    "currentOwnerAddr" TEXT,
    "firstSalePrice" TEXT,
    "firstSaleDate" TEXT,
    "initialOwner" TEXT,
    "initialOwnerAddr" TEXT,
    "memeId" TEXT,

    CONSTRAINT "NftDetail_pkey" PRIMARY KEY ("artefactId")
);

-- CreateTable
CREATE TABLE "CollectionDetail" (
    "artefactId" TEXT NOT NULL,
    "derivativeOf" TEXT,
    "provenanceLinks" TEXT,
    "projectName" TEXT,
    "subjectXUrl" TEXT,

    CONSTRAINT "CollectionDetail_pkey" PRIMARY KEY ("artefactId")
);

-- CreateTable
CREATE TABLE "ProvfiDetail" (
    "artefactId" TEXT NOT NULL,
    "memeId" TEXT,
    "tokenId" TEXT,
    "tokenProxy" TEXT,

    CONSTRAINT "ProvfiDetail_pkey" PRIMARY KEY ("artefactId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "IdentityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorLabel" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Artefact_name_idx" ON "Artefact"("name");

-- CreateIndex
CREATE INDEX "Artefact_sheet_name_idx" ON "Artefact"("sheet", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Artefact_sheet_slug_key" ON "Artefact"("sheet", "slug");

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_kind_value_key" ON "Identity"("kind", "value");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "MemecoinDetail" ADD CONSTRAINT "MemecoinDetail_artefactId_fkey" FOREIGN KEY ("artefactId") REFERENCES "Artefact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftDetail" ADD CONSTRAINT "NftDetail_artefactId_fkey" FOREIGN KEY ("artefactId") REFERENCES "Artefact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionDetail" ADD CONSTRAINT "CollectionDetail_artefactId_fkey" FOREIGN KEY ("artefactId") REFERENCES "Artefact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvfiDetail" ADD CONSTRAINT "ProvfiDetail_artefactId_fkey" FOREIGN KEY ("artefactId") REFERENCES "Artefact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
