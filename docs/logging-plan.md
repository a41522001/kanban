# Flowboard Backend Logging Plan

日期：2026-10-24（重寫），最後更新 2026-10-27。狀態：**規則已確認，實作中**（見 §9）。

本版取代 2026-09 的初期規劃。舊版的 Loki／Grafana、Auth 與 Socket.IO 事件清單與現況差距太大，已移除；規則改由使用者以 grill 逐項確認（Q1–Q15，2026-10-24）。

## 1. 目標

- API 與 worker 兩個 process 使用同一套 structured log，可在 Seq 以欄位查詢與關聯。
- 同一個錯誤只記錄一次，不洩漏個資與機密。
- 開發環境終端機易讀；有設定 Seq 時同時送進 Seq。

## 2. 範圍（Q1）

| 階段 | 內容 |
| --- | --- |
| **本次** | 規則、程式修正、本機以 Docker 執行 Seq |
| 之後 | 正式環境的 Seq 放在哪裡、保存天數、後台存取保護。在決定之前，正式環境維持輸出 JSON 到 stdout，以 `docker logs` 查看 |

## 3. 架構

```text
API process ──┐
              ├─ nestjs-pino（共用 config/logger.config.ts）
worker process┘        │
                       ├─ 終端機：開發用 pino-pretty，正式為 JSON（一律輸出）
                       └─ Seq：只有設定 SEQ_URL 時才送（pino-seq）
```

- （Q2）worker 也接 nestjs-pino，與 API 共用 `logger.config.ts`；每筆 log 帶 `service: 'api' | 'worker'`。
- （Q11）level 門檻：開發 `debug`，正式 `info`。
- （Q12）`compose.yml` 加入 `seq` 服務（image `datalust/seq`，需 `ACCEPT_EULA=Y`，後台在容器 port 80）。未設定 `SEQ_URL` 時只印終端機，E2E 與 CI 不受影響。
- （Q13）使用 Datalust 官方維護的 `pino-seq`（4.0.0，peer `pino` 10.x；後端目前為 pino 10.3.1）。它是 stream 而非 pino transport，且**只提供 ESM**；後端編譯為 CommonJS，需實作時驗證 Node 22 的 `require(esm)` 可正常載入，不行再改用替代方案。

## 4. 寫法規則

### 4.1 呼叫方式（Q6）

```ts
this.logger.error(
  { event: 'avatar.upload.write_failed', err: error, uploadId },
  '寫入頭像檔案失敗',
);
```

- 一律 `logger.<level>({ 欄位 }, '訊息')`：物件在前、訊息在後。
- 錯誤一律放在 `err` 欄位。
- **禁止** `logger.error('訊息', error)`：經 nestjs-pino 轉交 pino 後，第二個參數會被當成格式化參數而遺失（2026-10-21 實測）。
- 應用程式的 log 一律使用 Logger，不使用 `console.*`（不經過 pino、不會被 redact，也送不進 Seq）。臨時除錯可以用 `console.log`，ESLint `no-console` 設為 `warn` 提醒（2026-10-27 由 `error` 調整，避免妨礙開發），commit 前要刪除或改成 Logger。

### 4.2 event（Q3）與訊息（Q4）

- 每筆**應用程式** log 都要有 `event`，格式 `模組.動作.結果`，全小寫，以 `.` 分層、單字間用 `_`，例如 `avatar.upload.write_failed`、`queue.job.failed`。
- `event` 給機器查詢與統計；訊息文字給人看，可改寫而不影響查詢。
- 訊息文字使用**中文**。
- pino-http 自動產生的 HTTP request log 不需要 `event`。

### 4.3 欄位名稱（Q14）

一律 camelCase，下列名稱固定，不可另取別名：

| 欄位 | 用途 |
| --- | --- |
| `event` | 事件代號 |
| `err` | 錯誤物件 |
| `service` | `api`／`worker` |
| `requestId` | HTTP 請求 ID。**目前放在 pino-http 的 `req.id`**（2026-10-27 決定，見 §7），不另外建立頂層欄位 |
| `userId`、`workspaceId`、`projectId`、`uploadId` | 資料 ID |
| `queue`、`jobName`、`jobId`、`attempt` | BullMQ job |
| `durationMs` | 花費時間（毫秒） |

## 5. 錯誤由誰記錄（Q5）

| 情況 | 誰記 | level |
| --- | --- | --- |
| 預期內的錯誤（`AppException` 4xx，例如 400、401、429） | **不記**；HTTP request log 已有狀態碼 | — |
| 非預期錯誤（500） | 全域 `HttpExceptionFilter`，含 stack | `error` |
| 轉成 `AppException` 的 5xx（例如寫檔失敗轉 503） | 全域 `HttpExceptionFilter`，`err` 為 `cause` | `error` |
| 接住後**不再丟出**（例如刪檔失敗只記 log） | service 自己 | `error`／`warn` |

- `AppException` 新增 `cause`（原始錯誤）與 `event`。service 只需 `throw new XxxException(message, { cause: error, event: '...' })`，不另外寫 log。
- 不在 `AppException` 的 constructor 記 log：會連預期內的 4xx 都記錄、建立後未丟出也會記錄，且拿不到 request 資訊。
- **禁止**「接住、記 log、再原樣丟出」，避免同一錯誤被上層重複記錄。
- 回應給前端的內容永遠不含 stack 或內部錯誤訊息。

## 6. 個資與機密（Q7）

- **一律不記**：password、password hash、Cookie、session ID、驗證 token、整包 `job.data`、request／response body。
- 使用者以 `userId` 識別，**不記 email**。`userId` 不可出現在公開網址與 API 回應，但可出現在內部 log。
- 既有 redact：`req.headers.cookie`、`req.headers.authorization`、`req.body.password`、`res.headers['set-cookie']`。

## 7. HTTP（Q8、Q10）

- 每個請求以 UUID 產生 `requestId`（pino-http `genReqId`），回應 header 加 `X-Request-Id`。
- 同一請求的 log 以 `req.id` 對應：pino-http 預設會在請求期間的每筆 log 附帶整包 `req`（含 `id`），因此不另外加 `customProps`／`quietReqLogger`。代價是 service log 會重複帶 `req`；之後在 Seq 覺得太長時，再改為 `quietReqLogger: true` ＋ `customAttributeKeys: { reqId: 'requestId' }`（2026-10-27 已用 pino-http 11.0.0 實驗確認可行）。
- **不採用**請求自帶的 `X-Request-Id`，避免偽造或塞入超長字串。
- request log level：2xx／3xx `info`、4xx `warn`、5xx `error`。
- `/health` 不記錄。**延後**：目前沒有 `/health` 路由（`main.ts` 只在 `setGlobalPrefix` 排除），等實作該路由時再以 `autoLogging.ignore` 略過。

## 8. Worker（Q9）

- job 的完成與失敗，在 Worker 的 `completed`、`failed` 事件**統一**記錄，固定欄位 `queue`、`jobName`、`jobId`、`attempt`、`durationMs`；`failed` 每次失敗（含之後會重試的）都記錄。
- 處理函式只記業務上的事（例如「頭像已被取代，略過」）。
- Email 與 avatar 兩個 Worker 套用同一規則。

## 9. 實作步驟

| 步驟 | 內容 | 狀態 |
| --- | --- | --- |
| L1 | worker 接上 nestjs-pino（共用 `logger.config.ts`），加上 `service` 欄位 | ✅ 2026-10-26：`WorkerModule` 加入 `LoggerModule`、`worker/main.ts` 以 `bufferLogs` + `useLogger`；`loggerFactory(configService, service)` 以 pino `base: { pid, hostname, service }` 加上欄位。實測 API／worker 分別帶 `service: 'api'`／`'worker'`，production JSON 保留 `pid`、`hostname` |
| L2 | HTTP：`requestId`、`X-Request-Id`、依狀態碼的 level、略過 `/health` | ✅ 2026-10-27：L2-1 `genReqId` 產生 UUID 並設定 `X-Request-Id`（不採用請求自帶的值，實測偽造 header 被忽略）。L2-2 不實作，沿用 `req.id`（見 §7）。L2-3 `customLogLevel`：`err` 或 5xx 為 `error`、4xx 為 `warn`、其餘 `info`，實測 200 INFO、400／401／404 WARN；5xx 待 L7 測試。L2-4 延後到實作 `/health` 時 |
| L3 | `AppException` 加 `cause`／`event`；`HttpExceptionFilter` 只在 5xx 記錄 | ✅ 2026-10-27：L3-1 `AppExceptionOptions` 加可選的 `cause`、`event`；`cause` 以 Nest `HttpException` 第三個參數 `{ cause }` 傳入（`exception.cause`），不放進回應內容，`event` 為 `AppException` 屬性。L3-2 Filter 在 `status >= 500` 時統一記錄一筆 `error`（訊息「請求處理失敗」），`err` 有 `cause` 取 `cause`、否則取 exception 本身，`event` 取 `AppException.event`、否則為 `http.request.unexpected_error`；4xx 不記。L3-3 `AvatarStorageUnavailableException` 可帶 `{ cause, event }`，avatar 上傳的兩個 503 使用 `avatar.upload.write_failed`／`avatar.upload.save_failed`，移除 service 中重複的 `logger.error`。已知取捨：Filter 的 log 不含 `uploadId`，以 `req.id` 對應請求。`auth.service.ts` 重寄驗證信的 503 同樣模式，於 L5 一併處理 |
| L4 | Worker `completed`／`failed` 統一記錄（email、avatar） | ✅ 2026-10-27：新增 `worker/jobLogFields.ts` 產生 `queue`、`jobName`、`jobId`、`attempt`（`job.attemptsStarted`，第幾次執行）、`durationMs`（`Date.now() - job.processedOn`，不含 backoff）；兩個 Worker 的 `completed` 記 `info`／`queue.job.completed`，`failed` 每次失敗記 `error`／`queue.job.failed`（含 `err`）。avatar 的 `handleFinalFailure` 改為 `warn`／`avatar.variants.marked_failed`，不再重複記錄原因。Email worker 改名為 `EmailWorkerService`（`emailWorker.service.ts`），移除未使用的 `AvatarWorkerService` 依賴，並刪除印出 `job.data`（含驗證 token）的 `console.log`。以本機 Redis 測試佇列實測失敗重試與完成的欄位值 |
| L5 | 修正既有 log：`auth.service.ts` 遺失 error 的寫法、~~worker 印出 `job.data`（含 token）~~（L4 已處理）、`QueueService` 的 `console.log(job)`、Redis／Socket.IO 的 `console.*`；既有 log 補上 `event`；ESLint `no-console` | ✅ 2026-10-27：L5-1 刪除 API 的 email `QueueEvents`（唯一用途是印出含 token 的 job）與 `board.service.ts` 的 `console.log(userId)`。L5-2 Redis、Socket.IO、`worker/main.ts` 的 `console.*` 改為 Logger（Redis 錯誤 `error`、Socket 連線／斷線 `info`、加入工作區被拒 `warn`）。新增 `common/constants/logEvents.ts`：`LOG_EVENTS` 集中所有 event，`LogEvent` 型別約束 `AppException.event`。L5-3 `auth.service.ts` 註冊入列失敗改為物件寫法並以 `userId` 識別（不記 email）；重寄入列失敗改為 503 帶 `cause`／`event`，交給 Filter 記錄。L5-4 所有應用程式 log 補上 `event`；刪除 avatar worker 的三筆處理進度 log（已由 `queue.job.completed` 涵蓋）與 `avatar.service.ts` 一個不會執行到的 `try/catch`；刪檔失敗統一為 `avatar.storage.delete_failed`。L5-5 `no-console` 設為 `warn` |
| L6 | Seq：`compose.yml` 加 `seq` 服務、`SEQ_URL`、`pino-seq`（先驗證 ESM 相容性） | ⬜ |
| L7 | 測試：redaction、Filter 5xx／4xx、Worker 失敗 log（Q15） | ⬜ |

## 10. 測試（Q15）

只測容易出錯又重要的部分，不逐筆測 log 內容：

1. redaction：password、Cookie、token 被遮住。
2. 全域 Filter：5xx 會記錄且帶 `cause`；4xx 不記錄。
3. Worker：job 失敗時有記錄，且帶 `queue`、`jobId`。

`no-console` 由 ESLint 以 `warn` 提醒，不另寫測試。
