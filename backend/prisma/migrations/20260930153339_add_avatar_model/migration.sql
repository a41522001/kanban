/*
  Warnings:

  - You are about to drop the column `avatar_url` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AvatarVariantStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar_url";

-- CreateTable
CREATE TABLE "avatars" (
    "user_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "medium_url" TEXT NOT NULL,
    "small_url" TEXT,
    "large_url" TEXT,
    "variant_status" "AvatarVariantStatus" NOT NULL DEFAULT 'PENDING',
    "variant_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "avatars_variant_status_updated_at_idx" ON "avatars"("variant_status", "updated_at");

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
