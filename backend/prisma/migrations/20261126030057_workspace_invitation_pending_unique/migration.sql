-- 同一組 (workspace, invitee) 若已有多筆 PENDING，只保留最新一筆，其餘標成 CANCELED，否則下方唯一索引會建立失敗。
UPDATE "workspace_invitations" AS wi
SET "status" = 'CANCELED', "updated_at" = NOW()
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "workspace_id", "invitee_user_id"
           ORDER BY "created_at" DESC, "id" DESC
         ) AS rn
  FROM "workspace_invitations"
  WHERE "status" = 'PENDING'
) AS ranked
WHERE wi."id" = ranked."id" AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_workspace_id_invitee_user_id_key" ON "workspace_invitations"("workspace_id", "invitee_user_id") WHERE (status = 'PENDING');
