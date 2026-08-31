# 學習與實作進度

最後檢視：2026-08-31。

## Native WebSocket

| 章節 | 主題 | 狀態 |
| --- | --- | --- |
| 01 | Connection lifecycle | 已完成 |
| 02 | JSON protocol | 已完成 |
| 03 | Broadcast 與 server push | 已完成 |
| 04 | Presence／online count | 已完成 |
| 05 | Application heartbeat | 已完成 |
| 06 | Basic reconnect | 已完成 |
| 07 | Runtime validation | 已完成 |
| 08 | Heartbeat timeout | 已完成 |
| 09 | Reconnect policy | 下一章 |
| 10 | Backpressure | 尚未開始 |

## Flowboard Kanban

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| pnpm monorepo、NestJS、PostgreSQL、Redis | 已完成 | frontend、backend、contracts 已建立 |
| Auth HTTP API | 已完成 | signup、login、`GET /user/userInfo`、logout |
| Session 建立與 Hash schema | 已完成 | Raw ID 只在 Cookie，Redis 使用 SHA-256 Hash key |
| Session 輪轉 | 已完成核心流程 | 15 分鐘 request-driven rotation、20 秒 Grace、Lua 原子競爭 |
| 5 裝置限制 | 已完成核心流程 | ZSET + create Lua 原子清理與淘汰 |
| Session revoke／logout 一致性 | 進行中 | 目前 logout 只刪除單一 Hash，尚未同步清理 Current、Grace 與 ZSET |
| 統一 API response 與錯誤 | 已完成 | ValidationPipe、AppException、全域 Filter、欄位錯誤遮蔽 |
| Pino HTTP log 與 Swagger | 已完成基礎 | application lifecycle events 與 logging tests 待補 |
| Workspace 基礎 | 已完成部分 | 建立、列出、成員清單；成員清單的 membership authorization 尚未補 |
| 最小 Socket.IO typed echo | 已完成 | 尚未接 Session handshake |
| Frontend Auth vertical slice | 下一階段 | API client、store、route guard、頁面整合 |
| Board／Project domain | 尚未開始 | 依 domain 與 WebSocket spec 實作 |
| Ack、retry、idempotency、concurrency | 尚未開始 | Socket command 階段導入 |
| Recovery／resync | 尚未開始 | Board revision 與 snapshot/replay |

## 測試現況

- Backend 目前有 Auth、User、Workspace、Validation、Filter 與 Session schema 的 unit／integration-style specs。
- SessionService、SessionRepository、Lua 輪轉、5 裝置限制與 revoke 尚未有足夠測試。
- `backend/test/app.e2e-spec.ts` 仍是 Nest 預設 `GET /` 範例；E2E Jest 設定也尚未對齊 path alias 與 Prisma generated imports，不能視為可用的正式 E2E。
- 進度只在實際跑過對應指令後標記完成，不以「已有 spec 檔」代替通過結果。

## 下一步

1. 完成 Session 原子 logout／revoke 與測試。
2. 修復 backend E2E bootstrap、path mapping、資源清理與真實 auth flow。
3. 完成 Frontend Auth vertical slice。
4. 將同一套 Session 驗證接到 Socket.IO handshake。

## 更新方式

每個里程碑完成後：

1. 更新狀態與仍存在的限制。
2. 寫下驗收指令、日期與結果。
3. 失敗或 skipped 的測試不能記為完成。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
