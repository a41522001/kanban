-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORKSPACE_INVITED', 'WORKSPACE_MEMBER_JOINED', 'PROJECT_MEMBER_ADDED', 'CARD_ASSIGNED', 'CARD_MENTIONED', 'CARD_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationResourceType" AS ENUM ('WORKSPACE_INVITATION', 'WORKSPACE', 'PROJECT', 'BOARD', 'CARD');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "workspace_id" UUID,
    "type" "NotificationType" NOT NULL,
    "resource_type" "NotificationResourceType" NOT NULL,
    "resource_id" UUID,
    "payload" JSONB NOT NULL,
    "dedupe_key" VARCHAR(160),
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_created_at_idx" ON "notifications"("recipient_user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_workspace_id_created_at_idx" ON "notifications"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_user_id_dedupe_key_key" ON "notifications"("recipient_user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
