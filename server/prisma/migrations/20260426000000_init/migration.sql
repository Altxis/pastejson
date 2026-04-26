-- CreateTable
CREATE TABLE "Snapshot" (
    "id"        TEXT         NOT NULL,
    "data"      BYTEA        NOT NULL,
    "byteSize"  INTEGER      NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_expiresAt_idx" ON "Snapshot"("expiresAt");
