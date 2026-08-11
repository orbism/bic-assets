-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('LOCAL', 'BLOB');

-- CreateEnum
CREATE TYPE "LinkOrigin" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "source" "AssetSource" NOT NULL DEFAULT 'LOCAL',
    "thumbPath" TEXT,
    "label" TEXT NOT NULL,
    "folder" TEXT,
    "bytes" INTEGER,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtefactAsset" (
    "artefactId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "origin" "LinkOrigin" NOT NULL DEFAULT 'AUTO',
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtefactAsset_pkey" PRIMARY KEY ("artefactId","assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_path_key" ON "Asset"("path");

-- CreateIndex
CREATE INDEX "Asset_folder_idx" ON "Asset"("folder");

-- CreateIndex
CREATE INDEX "ArtefactAsset_assetId_idx" ON "ArtefactAsset"("assetId");

-- CreateIndex
CREATE INDEX "ArtefactAsset_artefactId_dismissed_idx" ON "ArtefactAsset"("artefactId", "dismissed");

-- AddForeignKey
ALTER TABLE "ArtefactAsset" ADD CONSTRAINT "ArtefactAsset_artefactId_fkey" FOREIGN KEY ("artefactId") REFERENCES "Artefact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtefactAsset" ADD CONSTRAINT "ArtefactAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
