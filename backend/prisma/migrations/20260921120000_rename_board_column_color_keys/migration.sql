-- BoardColumn 的 color_key 是視覺 token，不代表工作流程狀態。
-- 將既有的狀態語意名稱轉為中性的色票名稱。
UPDATE "board_columns"
SET "color_key" = CASE "color_key"
  WHEN 'ready' THEN 'coral'
  WHEN 'active' THEN 'mint'
  WHEN 'review' THEN 'amber'
  WHEN 'done' THEN 'violet'
  ELSE "color_key"
END
WHERE "color_key" IN ('ready', 'active', 'review', 'done');
