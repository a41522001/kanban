/*
  Warnings:

  - The primary key for the `project_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[project_id,user_id]` on the table `project_members` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `project_members` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_pkey",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");
