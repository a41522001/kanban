# SVG 設計前功能盤點

核對日期：2026-09-27。依目前原始碼與 contracts 靜態盤點；本次只更新文件，沒有修改功能、執行測試或產生 SVG。現行 API 以 [HTTP API](http-api.md) 為準；下表「可設計」代表已有足夠規格，不表示使用者已核准設計。

## 驗證信：本輪設計依據

後端已具備註冊入列、Worker 寫 Redis token／TTL 並透過 Nodemailer 寄信、驗證與重寄 API、冷卻及未驗證登入限制。可依現有 API 規劃兩頁：`/auth/check-email` 與 `/auth/verify/:token`。本輪 UI 提案已生成 14 個狀態與桌機／手機 SVG manifest，畫面仍待審查，見 [驗證信前端設計](email-verification-ui-plan.md)。

| 項目 | 現況 | 還缺什麼／對設計的影響 |
| --- | --- | --- |
| 註冊與首次寄信 | 後端已完成；signupApi 型別已更新 | SignupView 仍導向 Login，需處理 201 / 1 與 201 / 2007 兩種結果 |
| 未驗證登入 | 後端 403 / 2005，不建立 Session | LoginView 仍通用 Alert，需導向驗證信頁 |
| 前端驗證頁 | 尚未建立 | 公開動態 route、讀取 token、自動 PATCH、載入／成功／失效／暫時失敗 |
| 重寄 | 後端 202／429／503 與倒數已完成 | API service、Email 表單、重寄狀態、倒數、重新整理恢復 |
| 既有未驗證帳號 | 已受登入限制 | 需提供登入頁重寄入口，不只依賴新註冊導流 |
| 信件有效期限 | 信件有分鐘數；API 沒有 expiresAt／expiresIn | 首版畫面引用信件期限，不硬編碼 30 分鐘 |
| 登入 403 的倒數 | data 只有 email | 無本機倒數時不能顯示精確剩餘秒數；提交後以 429 校正 |
| SMTP 狀態 | QueueEvents 只印出工作結果 | 使用「請查看信箱／申請已受理」，若要真實「已寄出」需新增狀態 API／推播與 contract |
| 開發時免寄真信 | E2E 有 EmailService 測試替身 | EMAIL_TRANSPORT 設定目前無效，開發用 console provider 尚未實作 |
| 寄信失敗處理 | Worker throw 會使工作失敗 | 尚無明確 attempts／backoff、failed 告警／前端狀態、完成工作清理規則；人工重寄可先使用 |
| Google OAuth／忘記密碼 | 有 UI 按鈕，無 API 流程 | 本輪不視為完成；SVG 暫隱藏，現行 Vue 按鈕仍需對齊 |

精確回應與前端分流已寫於 [Auth API](http-api.md#auth-api-詳細規格)。入列成功、SMTP 寄送成功、收件匣收到信是不同階段，目前 API 只提供第一階段結果。

## 全站現況與未完成項目

| 領域 | 已有功能 | 未完成／限制 |
| --- | --- | --- |
| Workspace | 建立、列表、成員列表與切換 UI | 修改／封存、成員角色調整、移除／離開 API |
| Workspace Invitation | 網站通知、detail、接受／拒絕、到期排程 | Owner 取消、併行 PENDING 唯一性與更完整併發驗收；目前不寄邀請 Email |
| Notification | 列表、未讀數、單筆／全部已讀、Socket 推送 | Controller 未接 cursor／filters；只能取預設首 20 筆；重連漏收同步待補 |
| Project | 建立、列表、members、候選人、addMember、pin、通知 detail；overview 已串接 | detail／編輯／封存、角色調整與移除；列表無 currentUserRole、members 無 joinedAt，設計不可直接假設有這些資料 |
| Board 讀取 | GET /board/:projectId 已接 DB，前端已有載入／空／錯誤重試 | 只含 Columns，缺讀取授權及完整 snapshot／revision／cards |
| Column 新增 | POST /board/addColumn 已寫 DB 與 revision | 前端目前只有讀取 service，新增 UI／shared response DTO／實際驗收待補 |
| Column 拖曳 | VueDraggable 改本機陣列；moveColumn 已有 route | handler／Service 未實作，DTO 無 validation；排序不持久化 |
| Card／Category／Label | 已有視覺與前端型別／Dialog | 無持久化 schema／API；目前 cards 為空，不能視為可建立或編輯卡片 |
| 即時協作 | user room、workspace room、通知推送 | project room、拖曳鎖、ack／idempotency／衝突／snapshot resync 尚未完成 |
| Session／跨頁 | Cookie、登入恢復、logout、公開 login/signup | 驗證路由公開化、redirect target、Socket reconnect 後 rejoin／HTTP resync 待補 |
| API 文件 | 已同步 HTTP 表格、Auth 錯誤碼與 data | Swagger 部分 handler 缺 metadata；共用 FieldError／response schema 尚未完整 |

## 優先處理的程式缺口

1. **Board 讀取授權**：BoardService.getBoardColumn 收到 userId 但未用於授權，只查 projectId。需驗證 ProjectMember 以及 Project／Workspace 未封存，再提供可用的 Board API。
2. **Project members 的封存邊界**：getSingleProjectMember 目前只檢查 membership 與 Project 封存，未檢查 Workspace.archivedAt；錯誤使用一般 NotFoundException，對外是 404 / RequestError。
3. **驗證信前端接入**：後端已擋未驗證登入，目前一般使用者點信件還沒有可操作的驗證頁；本輪 SVG 優先解決這段產品流程。
4. **Board 拖曳／Card**：若下一輪要開發協作看板，先完成 moveColumn、snapshot、Card persistence 的 contract，再依實際資料設計操作。

以上是本次檢查發現的待辦，未在本次文件更新中修改程式。

## SVG 審查範圍

已生成驗證信兩頁、14 個狀態（桌機／手機共 28 張），另有註冊 Email 重複狀態 2 張，既有登入／註冊 4 張 SVG 也已更新；以下是畫面審查重點。仍需確認：

- 等待頁使用「請查看你的信箱」與條件式受理文案；真實寄送狀態追蹤另列需求。
- 驗證成功提供「前往登入」，不自動登入；公開頁保留現有 Session。
- 倒數使用 API 秒數；Email 遺失時顯示輸入表單；不把 token 放入 Storage。
- SVG 已暫隱藏 Google／忘記密碼入口；前端首版如何對齊，避免看似可用但沒有操作。

本輪 Auth 設計不需要等待所有 Board／Card 功能完成。若擴充全站 SVG，需先逐項核准上表未完成功能的目標規格；不能把現有設計圖當作已實作功能。

## 核對來源與驗證界線

- backend/src/auth、worker、queue、email：Auth、Redis、BullMQ、SMTP 流程。
- backend/src/*/*.controller.ts、board.service.ts、project.service.ts：實際 HTTP routes 與授權。
- packages/contracts、backend/prisma/schema.prisma：公開資料與持久化模型，User 驗證欄位同步至 [資料庫文件](database-schema.md)。
- frontend/src/router、services、views：實際導頁、API 呼叫與畫面狀態。
- design/README.md、docs/email-verification-ui-plan.md：現有 SVG 與待審查 manifest。

上一輪程式修改曾通過後端 169 tests（5 skipped）、E2E 4 suites / 13 tests 及前後端型別檢查；本次只作靜態核對，不把舊結果視為新增 Board 授權／拖曳／瀏覽器流程的驗收。
