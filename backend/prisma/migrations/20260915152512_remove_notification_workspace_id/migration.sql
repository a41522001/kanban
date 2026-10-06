/*
  Warnings:

  - You are about to drop the column `workspace_id` on the `notifications` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_workspace_id_fkey";

-- DropIndex
DROP INDEX "notifications_workspace_id_created_at_idx";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "workspace_id";
