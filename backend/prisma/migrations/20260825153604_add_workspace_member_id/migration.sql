/*
  Warnings:

  - The primary key for the `workspace_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[workspace_id,user_id]` on the table `workspace_members` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `workspace_members` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");
