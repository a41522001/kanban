/*
  Warnings:

  - The values [BOARD] on the enum `NotificationResourceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationResourceType_new" AS ENUM ('WORKSPACE_INVITATION', 'WORKSPACE', 'PROJECT', 'CARD');
ALTER TABLE "notifications" ALTER COLUMN "resource_type" TYPE "NotificationResourceType_new" USING ("resource_type"::text::"NotificationResourceType_new");
ALTER TYPE "NotificationResourceType" RENAME TO "NotificationResourceType_old";
ALTER TYPE "NotificationResourceType_new" RENAME TO "NotificationResourceType";
DROP TYPE "public"."NotificationResourceType_old";
COMMIT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "board_revision" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "board_columns" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "color_key" VARCHAR(30) NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_columns_project_id_archived_at_position_id_idx" ON "board_columns"("project_id", "archived_at", "position", "id");

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
