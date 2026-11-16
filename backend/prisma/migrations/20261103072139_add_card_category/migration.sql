-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "category_id" UUID;

-- CreateTable
CREATE TABLE "card_categories" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "normalized_name" VARCHAR(20) NOT NULL,
    "color_key" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_categories_project_id_normalized_name_key" ON "card_categories"("project_id", "normalized_name");

-- CreateIndex
CREATE INDEX "cards_category_id_idx" ON "cards"("category_id");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "card_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_categories" ADD CONSTRAINT "card_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
