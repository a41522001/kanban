# 進度

最後更新：2026-11-20。本文是**唯一**記錄整體狀態的地方；各功能的細部步驟寫在 `features/` 對應的文件。2026-09 至 10-06 的歷史驗收紀錄已刪除，可從 git 歷史查看 `docs/progress.md` 的舊版本。

## 分支與上線限制

- 目前開發分支：`feature/windows`（Mac 為 `feature/mac`，兩者經 `dev` 合併）。`dev` 已包含頭像與 logging。
- **頭像功能完成 GCP Cloud Storage（[頭像規格](features/avatar.md) 步驟 11）之前，不可 merge 到 `main`。** merge 到 `main` 會觸發 CD 部署，而正式環境沒有 `/media`、檔案存在容器內、backend 與 worker 容器互相看不到檔案，上傳會成功但圖片全部 404。
- 與頭像無關、又要先上線的功能，從 `main` 另開分支開發。

## 功能狀態

| 領域             | 狀態        | 已完成                                                                                                                                                                                                                                                                          | 未完成                                                                                                                |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Auth（LOCAL）    | ✅          | 註冊、登入、登出、驗證信、重寄冷卻、未驗證登入限制、登入與註冊 rate limit（2026-11-19，[規格](features/rate-limit.md)：login 三個維度只算失敗、signup 以 IP 計數，Redis Lua 原子檢查，前端倒數）                                                                                                                                                                                                                              | Google OAuth、忘記密碼、修改 Email；開發環境以 `devAutoVerifyEmail` 跳過驗證信                                        |
| Session          | ✅ 核心     | HttpOnly Cookie、Redis SHA-256 hash、15 分鐘輪轉、20 秒 Grace、5 裝置上限、logout 撤銷本次 Session 與其 Previous Grace（2026-11-06）                                                                                                                                            | 以 Grace Cookie 登出時無法撤銷 Current；idle timeout                                                                  |
| Workspace        | 🔄          | 建立、列表、切換、成員清單（含頭像）                                                                                                                                                                                                                                            | 修改、封存、成員角色調整、移除、離開                                                                                  |
| Workspace 邀請   | 🔄          | 發送、詳情、接受、拒絕、每分鐘過期排程                                                                                                                                                                                                                                          | Owner 取消邀請；PENDING 唯一性與併發驗收                                                                              |
| 通知             | 🔄          | 列表、未讀數、單筆／全部已讀、Socket 即時推送                                                                                                                                                                                                                                   | cursor／filters（目前只回最新 20 筆）、重連後補抓、跨分頁同步                                                         |
| Project          | 🔄          | 建立、列表、置頂、成員清單、候選人、新增成員、成員加入通知（成員與候選人含頭像）                                                                                                                                                                                                | 詳情、編輯、封存、角色調整、移除成員                                                                                  |
| Board            | 🔄          | 欄位讀取（2026-10-30 補上讀取權限）、新增欄位、Card 新增／編輯／封存（階段 A）、類別、拖曳卡片並存檔（階段 B，2026-11-06：`moveCard` API、把手拖曳、「移動至…」）、多人即時同步（階段 C，2026-11-09：project room、6 種事件廣播、前端佇列與漏號重新載入、對話框衝突、斷線提示）、欄位拖曳與卡片拖曳鎖（階段 D，2026-11-16） | B-2 手機長按未實機測試；其餘見 [Board 規格](features/board.md) §9                                  |
| 頭像             | 🔄 本機完成 | 步驟 0–10：上傳、裁切、錯誤處理、刪除、次數限制、背景 Worker 產生 sm／lg、成員清單顯示                                                                                                                                                                                          | 步驟 11 GCP Cloud Storage（2026-11-03 規格已確認，見 [頭像規格](features/avatar.md) §0.4；11-1 待實作）、步驟 12 部署 |
| Logging          | ✅ 開發環境 | API 與 worker 共用 pino、`event` 欄位、`requestId`、5xx 由 Filter 統一記錄、Worker job 記錄、本機 Seq（[Logging 規格](architecture/logging.md)）                                                                                                                                | 正式環境的 Seq；上線前待辦見該文件 §9.1                                                                               |
| Config Namespace | ✅          | 2026-11-03：8 個 namespace（`src/config/namespaces/`）、`getValidatedEnv()`、`ConfigService<AppConfig, true>` 點路徑讀值；19 個使用端與 7 個 spec 已遷移（含 `socket.service.ts`），新增 `namespaces.spec.ts`                                                                   | `gcs` namespace 於頭像 GCS 步驟 11-2 新增；尚未推到 `dev`                                                             |
| Socket.IO        | 🔄          | Session Cookie handshake、user／family／workspace／project room、通知與成員異動推送、重連後重新加入 Workspace room 並重新載入成員、快速切換 Workspace 競速、輪轉後登出斷開同一 family 的 Socket（2026-11-06）                                                                   | 成員移除後清理 room；7.2 真實 client 驗證與握手競態；多 instance 需 Redis adapter                                     |
| 部署與 CI/CD     | 🔄 MVP      | Docker 化、`compose.prod.yml`、CI 測試 `dev`／`feature/*`、CD 於 `main` 推 GHCR 並部署到 GCP VM、`IMAGE_TAG` 版本（[部署](operations/deployment.md)）                                                                                                                           | 網域與 HTTPS（未完成前正式環境無法登入）、靜態 IP、`restart: unless-stopped`、CI 未跑前端測試                         |
| API 測試         | ✅          | Bruno collection 移入 repo（`bruno/`），涵蓋全部 API 與頭像錯誤案例                                                                                                                                                                                                             | —                                                                                                                     |

## 下一步

1. **Rate limit 收尾**：R-1～R-7 已完成（[規格](features/rate-limit.md) §10）。部署前在 VM 的 `.env.prod` 補上 `TRUST_PROXY_HOPS=1`（[部署](operations/deployment.md)），上線後確認 log 的 `ip` 是使用者 IP 而不是 Nginx 容器的 IP。
2. **頭像上線**：GCP Cloud Storage（[頭像規格](features/avatar.md) §0.4：11-1～11-3 可先在本機以 dev bucket 進行；11-4 Cloudflare Worker 等網域與 HTTPS），之後才能 merge 到 `main`。
3. **部署收尾**：網域與 HTTPS、靜態 IP、`restart: unless-stopped`、logging §9.1 的上線前待辦。

## 已知缺口

### 正確性與併發

- 邀請的前置查詢與過期更新在 transaction 外，並行發送可能產生重複的 PENDING 邀請（[邀請與通知](features/workspace-invitation-notification.md)）。
- 沒有 Socket.IO Redis adapter：多 instance 時 `socket.to(room)`／`io.to(room)` 只送到同一台的連線（所有 board 事件與拖曳提示）；拖曳鎖本身存在 Redis，多 instance 仍互斥。部署多台前加 `@socket.io/redis-adapter`。
- 前端 User／Workspace／Notification store reset 後，尚未阻止舊的 in-flight response 回寫。
- 過期但未讀的通知仍計入未讀數。
- Project 成員清單無權限時回一般 `NotFoundException`（404 / 4000），不是 `ResourceNotFound`（3001），且未檢查 Workspace 封存。
- Project 建立 API 回傳 `null`，前端建立後要重新取得列表。

### 驗證信

- 入列成功不等於已寄出；沒有寄送狀態 API 或推播，畫面使用「申請已受理、請查看信箱」。
- API 不提供驗證期限；畫面引用信件中的期限。
- 登入回 403 / 2005 時沒有剩餘冷卻秒數，提交後以 429 校正。
- `EMAIL_TRANSPORT` 目前沒有作用，開發用的 console 寄信模式尚未實作。
- email queue 沒有設定 `removeOnComplete`／`removeOnFail`，完成的 job 會一直留在 Redis。

### 測試

- 尚未有 Playwright 的產品流程測試（目前只有 scaffold）。
- Session repository、Lua 輪轉、裝置上限與 revoke 的測試不足。
- Project create／addMember／pin 的未登入、非 OWNER、跨 Workspace、rollback 與真實併發 E2E 尚未補齊。
- E2E 直接打無前綴路徑（global prefix 只在 `main.ts` 設定，未進 `configureApp`），與正式環境路由不一致。

### API 文件

- Swagger metadata 不完整：Auth 驗證 handler、Project members／notification detail／pin、Board handlers 缺 endpoint-specific metadata；驗證／重寄的錯誤 data schema、signup 的 201 / 2007 分支尚未列出；共用 FieldError／response schema 尚未完成。以 [HTTP API](reference/http-api.md)、contracts 與程式碼共同核對。

### 安全

逐項清單見 [安全檢查清單](guides/security-checklist.md)；尚未勾選的項目即為目前缺口。

## 最近一次驗證

| 日期       | 範圍                                                                                          | 結果                                                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-06 | Backend socket／session／auth unit tests、ESLint、`tsc --noEmit`（7.2）                       | 7 suites、76 tests 通過；revoke Lua 以暫時 spec 對本機 Redis 驗證 3 個情境通過（spec 未保留）                                                                                                      |
| 2026-11-06 | Backend `jest src/modules/socket`、ESLint、`tsc --noEmit`（快速切換競速）                     | 7 tests 通過；修改前的程式跑同一份 spec 為 5 failed／2 passed；ESLint、`tsc` 通過                                                                                                                  |
| 2026-11-12 | Board service 拆分（純搬移）：board unit tests、ESLint、`tsc`、啟動 Nest、Bruno                   | `BoardService`（根目錄）與 `column/`、`card/`、`category/` 三個子資料夾的 service（DTO 留在 `dto/`）；同樣 79 個測試標題、161 tests 通過；9 個方法逐字相同、2 個只差呼叫 `cardCategoryService`；Bruno 35 個請求／56 tests 通過 |
| 2026-11-20 | `withLock` 與邀請過期排程（Windows）：backend unit tests、E2E（CI 步驟）、ESLint、`tsc` | 534 tests 通過、3 skipped（新增 `redisLock.service.spec` 8、`workspaceInvitation.job.spec` 6）；故意改壞兩處（`release` 錯誤未接住、只在成功時釋放）分別 2、5 個測試失敗；E2E 7 suites／55 tests 通過（新增真 Redis `withLock` 4：5 個同時呼叫只有 1 個執行且最多 1 個同時在跑、完成與丟錯後鎖被刪除、超過 TTL 不刪別人的鎖並記 warn） |
| 2026-11-19 | CI 修正：`rateLimit.e2e` 同時送出 20 個請求在 Linux CI 出現 `ECONNRESET`（app 只 `init()`，supertest 由第一個請求 `listen(0)` 並在結束時關閉 server）；`rateLimit`、`auth` E2E 改為 `app.listen(0)`；`email-verification.spec.ts` mock 圖檔修正 Windows 失敗 | 本機以 CI 步驟跑 backend E2E 連續 3 次皆 7 suites／51 tests 通過；Node 小程式重現同時 200 個請求時原寫法 104 個 `ECONNRESET`、修正後全部成功；CI 單元測試 520 通過；前端 `email-verification.spec.ts` 14 tests 通過 |
| 2026-11-19 | Rate limit 前端 R-6（Windows）：Vitest、`vue-tsc`、ESLint、Chrome | 217 tests 通過（失敗為既有 `email-verification.spec.ts`；新 spec 以 `vi.mock` 圖檔避開同一問題）；Chrome 以開發後端連續登入失敗 5 次後，第 6 次顯示倒數並停用送出、無對話框，Redis IP 計數停在 5 |
| 2026-11-19 | Rate limit 後端 R-3～R-5（Windows）：backend unit tests、E2E（隔離 PostgreSQL／Redis）、ESLint、`tsc`；3 支 Lua 以臨時 Redis 直接驗證 | 520 tests 通過、3 skipped；E2E 7 suites／51 tests 通過（新增 `rateLimit.e2e.spec.ts` 11：門檻、退回、403 退回、IP／email 維度、20 個同時送出只有 3 個進到比對密碼、signup、trust proxy 0 與 1、退回時 key 已過期）；ESLint 剩既有 `withLock` 3 個錯誤 |
| 2026-11-16 | Board D-4 卡片拖曳鎖前端（Windows）：Vitest、`vue-tsc`、ESLint、Chrome 兩個分頁 | 197 tests 通過（失敗為既有 `email-verification.spec.ts`）；Chrome 驗證提示與停用、結束解除、開始 → 移動 → 結束順序、`locked` 恢復原位不存檔、斷線釋放 |
| 2026-11-16 | Board D-3 卡片拖曳鎖後端（Windows）：backend unit tests、E2E（隔離 PostgreSQL／Redis）、ESLint、`tsc` | 496 tests 通過、3 skipped；E2E 6 suites／40 tests 通過（新增 `RedisLockService` 9、Socket 拖曳鎖 4）；故意改壞四處各有測試失敗 |
| 2026-11-12 | Board D-2 欄位拖曳前端（Windows）：Vitest、`vue-tsc`、ESLint、Chrome 兩個分頁                  | 179 tests 通過（失敗為既有 `email-verification.spec.ts`）；Chrome 驗證同步、重新整理保留、重新編號、409 重新載入 |
| 2026-11-12 | Board D-1 `moveColumn` 後端（Windows）：board unit tests、ESLint、`tsc`、Bruno、開發 DB | 161 tests 通過、1 skipped（新增 35）；Bruno 35 個請求／56 tests 通過；重新編號 SQL 於 transaction 內驗證後 rollback |
| 2026-11-09 | Backend E2E（Windows，隔離 PostgreSQL／Redis）                                                | 5 suites／27 tests 通過；新增 Socket 真實 client 14 tests；故意改壞兩處時對應 3 個測試失敗                                                                                                         |
| 2026-11-09 | Board C-3 前端（Windows）：Vitest、`type-check`、ESLint、Chrome 兩個分頁                      | 28 files 通過、169 tests 通過（失敗為既有 `email-verification.spec.ts`）；Chrome 驗證即時更新、斷線背景重新載入、拖曳一致、斷線提示、對話框 Q7 三種情況                                            |
| 2026-11-07 | Board C-2 後端：board unit tests、ESLint、`tsc`、Chrome                                       | 126 tests 通過、1 skipped；看板頁收到 `board:cardUpdated`（revision 16、17）                                                                                                                       |
| 2026-11-06 | Socket 重連（Windows）                                                                        | `socket.spec.ts` 10 tests 通過；前端全部 28 files 中 27 通過、139 tests 通過（失敗為既有 `email-verification.spec.ts`）；手動重啟後端，重連後 polling POST 送出 `workspace:into`、重新呼叫成員 API |
| 2026-11-06 | Frontend Vitest、`type-check`、ESLint（Windows，B-2 完成後）                                  | 27 files 中 26 通過、129 tests 通過；失敗的是既有 Windows 問題 `email-verification.spec.ts`；`type-check` 與 ESLint 通過                                                                           |
| 2026-11-06 | Chrome 實際操作 B-2（seed「行銷活動」專案）                                                   | 跨欄、空欄、同欄、「移動至…」畫面與 DB 一致；409 重新載入；VIEWER 無把手；651px 高視窗對話框在畫面內                                                                                               |
| 2026-11-06 | Backend `pnpm test -- src/modules/board`、`tsc --noEmit`、board ESLint（Windows，B-1 完成後） | 7 suites 通過、1 skipped；116 tests 通過、1 skipped；`tsc` 與 ESLint 通過                                                                                                                          |
| 2026-11-06 | Bruno CLI：Auth/Login、Workspaces、Project、Board                                             | 30 個請求、42 個測試全部通過（含 MoveCard 15–18）                                                                                                                                                  |
| 2026-11-03 | Backend `pnpm test`（Mac，Config Namespace 遷移後）                                           | 34 suites／352 tests 通過，3 skipped                                                                                                                                                               |
| 2026-11-03 | Backend `tsc --noEmit`、ESLint                                                                | `tsc` 通過；ESLint 剩 3 個既有錯誤（`common/utils/index.ts:109`）                                                                                                                                  |
| 2026-11-03 | `nest build` 後啟動 API 與 worker                                                             | 兩個 process 皆正常啟動                                                                                                                                                                            |
| 2026-10-28 | Backend `pnpm test`（Windows）                                                                | 29 suites／294 tests 通過，4 skipped                                                                                                                                                               |
| 2026-10-28 | Backend `tsc --noEmit`                                                                        | 通過；ESLint 剩 5 個既有錯誤（`board.controller.ts`、`common/utils`）                                                                                                                              |
| 2026-10-24 | Frontend Vitest                                                                               | 20 files 中 19 通過、77 tests 通過；`email-verification.spec.ts` 為上述既有 Windows 問題                                                                                                           |
| 2026-10-30 | Board service 單元測試                                                                        | 3 tests 通過                                                                                                                                                                                       |

Backend E2E（`pnpm test:backend:e2e`）2026-11-09 重跑：5 suites／27 tests 通過（含新的 `socket.e2e.spec.ts`）。

## 更新方式

1. 一個功能步驟完成並實際驗證後，更新「功能狀態」與該功能文件的步驟表。
2. 「最近一次驗證」只記錄實際跑過的指令；失敗或 skipped 不能記為完成。
3. 缺口修好時從「已知缺口」刪除，不保留已完成項目。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
