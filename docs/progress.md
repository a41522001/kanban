# 進度

最後更新：2026-10-30。本文是**唯一**記錄整體狀態的地方；各功能的細部步驟寫在 `features/` 對應的文件。2026-09 至 10-06 的歷史驗收紀錄已刪除，可從 git 歷史查看 `docs/progress.md` 的舊版本。

## 分支與上線限制

- 目前開發分支：`feature/windows`（Mac 為 `feature/mac`，兩者經 `dev` 合併）。`dev` 已包含頭像與 logging。
- **頭像功能完成 GCP Cloud Storage（[頭像規格](features/avatar.md) 步驟 11）之前，不可 merge 到 `main`。** merge 到 `main` 會觸發 CD 部署，而正式環境沒有 `/media`、檔案存在容器內、backend 與 worker 容器互相看不到檔案，上傳會成功但圖片全部 404。
- 與頭像無關、又要先上線的功能，從 `main` 另開分支開發。

## 功能狀態

| 領域 | 狀態 | 已完成 | 未完成 |
| --- | --- | --- | --- |
| Auth（LOCAL） | ✅ | 註冊、登入、登出、驗證信、重寄冷卻、未驗證登入限制 | Google OAuth、忘記密碼、修改 Email；開發環境以 `devAutoVerifyEmail` 跳過驗證信 |
| Session | ✅ 核心 | HttpOnly Cookie、Redis SHA-256 hash、15 分鐘輪轉、20 秒 Grace、5 裝置上限、logout 撤銷本次 Session | 撤銷整個 Session family；idle timeout |
| Workspace | 🔄 | 建立、列表、切換、成員清單（含頭像） | 修改、封存、成員角色調整、移除、離開 |
| Workspace 邀請 | 🔄 | 發送、詳情、接受、拒絕、每分鐘過期排程 | Owner 取消邀請；PENDING 唯一性與併發驗收 |
| 通知 | 🔄 | 列表、未讀數、單筆／全部已讀、Socket 即時推送 | cursor／filters（目前只回最新 20 筆）、重連後補抓、跨分頁同步 |
| Project | 🔄 | 建立、列表、置頂、成員清單、候選人、新增成員、成員加入通知（成員與候選人含頭像） | 詳情、編輯、封存、角色調整、移除成員 |
| Board | 🔄 | 欄位讀取（2026-10-30 補上讀取權限）、新增欄位 | 見 [Board 規格](features/board.md) §9：Card（階段 A）、拖曳存檔（B）、多人同步（C）、拖曳衝突（D） |
| 頭像 | 🔄 本機完成 | 步驟 0–10：上傳、裁切、錯誤處理、刪除、次數限制、背景 Worker 產生 sm／lg、成員清單顯示 | 步驟 11 GCP Cloud Storage、步驟 12 部署（[頭像規格](features/avatar.md)） |
| Logging | ✅ 開發環境 | API 與 worker 共用 pino、`event` 欄位、`requestId`、5xx 由 Filter 統一記錄、Worker job 記錄、本機 Seq（[Logging 規格](architecture/logging.md)） | 正式環境的 Seq；上線前待辦見該文件 §9.1 |
| Socket.IO | 🔄 | Session Cookie handshake、user／session／workspace room、通知與成員異動推送 | project room（Board 階段 C）；reconnect 後 rejoin、快速切換競速、成員移除後清理 room |
| 部署與 CI/CD | 🔄 MVP | Docker 化、`compose.prod.yml`、CI 測試 `dev`／`feature/*`、CD 於 `main` 推 GHCR 並部署到 GCP VM、`IMAGE_TAG` 版本（[部署](operations/deployment.md)） | 網域與 HTTPS（未完成前正式環境無法登入）、靜態 IP、`restart: unless-stopped`、CI 未跑前端測試 |
| API 測試 | ✅ | Bruno collection 移入 repo（`bruno/`），涵蓋全部 API 與頭像錯誤案例 | — |

## 下一步

1. **Board 階段 A**：A-1 `Card` schema 與 migration（[Board 規格](features/board.md) §9）。A-0 讀取權限已寫好，尚待以 Bruno 驗證。
2. **頭像上線**：GCP Cloud Storage 與 Cloudflare `media.<網域>`，之後才能 merge 到 `main`。
3. **部署收尾**：網域與 HTTPS、靜態 IP、`restart: unless-stopped`、logging §9.1 的上線前待辦。

## 已知缺口

### 正確性與併發

- 邀請的前置查詢與過期更新在 transaction 外，並行發送可能產生重複的 PENDING 邀請（[邀請與通知](features/workspace-invitation-notification.md)）。
- 過期排程的 `waitForCompletion` 只防止單一 instance 重疊；多 instance 時可能同時掃描（條件式 `updateMany` 為冪等）。
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
- `email-verification.spec.ts` 在 Windows 上因 Google logo 圖檔路徑而失敗（Mac 正常）。

### API 文件

- Swagger metadata 不完整：Auth 驗證 handler、Project members／notification detail／pin、Board handlers 缺 endpoint-specific metadata；驗證／重寄的錯誤 data schema、signup 的 201 / 2007 分支尚未列出；共用 FieldError／response schema 尚未完成。以 [HTTP API](reference/http-api.md)、contracts 與程式碼共同核對。

### 安全

逐項清單見 [安全檢查清單](guides/security-checklist.md)；尚未勾選的項目即為目前缺口。

## 最近一次驗證

| 日期 | 範圍 | 結果 |
| --- | --- | --- |
| 2026-10-28 | Backend `pnpm test`（Windows） | 29 suites／294 tests 通過，4 skipped |
| 2026-10-28 | Backend `tsc --noEmit` | 通過；ESLint 剩 5 個既有錯誤（`board.controller.ts`、`common/utils`） |
| 2026-10-24 | Frontend Vitest | 20 files 中 19 通過、77 tests 通過；`email-verification.spec.ts` 為上述既有 Windows 問題 |
| 2026-10-30 | Board service 單元測試 | 3 tests 通過 |

Backend E2E（`pnpm test:backend:e2e`）自 2026-09-28 後未重跑。

## 更新方式

1. 一個功能步驟完成並實際驗證後，更新「功能狀態」與該功能文件的步驟表。
2. 「最近一次驗證」只記錄實際跑過的指令；失敗或 skipped 不能記為完成。
3. 缺口修好時從「已知缺口」刪除，不保留已完成項目。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
