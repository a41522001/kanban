# Backend Config Namespace

日期：2026-11-03。由使用者以 grill 逐項確認（Q1–Q11）。狀態：**已實作**（2026-11-03）；`gcs` namespace 於 [頭像規格](../features/avatar.md) 步驟 11-2 新增 `GCS_*` 變數時一併建立，目前為 8 個。

把目前扁平的環境變數依領域分成 namespace（`registerAs`），程式內以 `avatar.storageRoot` 這類路徑讀值，取代 `AVATAR_STORAGE_ROOT` 這類環境變數名稱。API（`app.module.ts`）與 worker（`worker/worker.module.ts`）共用同一套設定。

## 1. 已查證的 `@nestjs/config` 行為（4.0.4）

以下依 `node_modules/@nestjs/config/dist` 原始碼確認，是本規格 §3 的前提。

- `forRoot({ validate })` 驗證後呼叫 `assignVariablesToProcess`，把結果寫回 `process.env`，但：
  - **只寫入原本不在 `process.env` 的 key**；
  - number、boolean 會轉回字串。
- 因此 `registerAs` factory 若直接讀 `process.env`：
  - `SESSION_EXPIRE_DAY` 讀到 `"7"`（字串），不是 `7`。
  - 正式環境的變數由 Docker 事先放進 `process.env`，不會被覆寫，**zod 的 transform（例如 `GCS_PRIVATE_KEY` 的 `\n` 轉換）不會生效**。
- `ConfigService.get` 的讀取順序：namespace（internal config）→ zod 驗證後的結果 → `process.env`。目前 `get('SESSION_EXPIRE_DAY')` 讀到 number，是因為讀的是驗證後的結果。
- `ConfigService<T, true>` 的 `get(path, { infer: true })` 支援點路徑型別推斷（`Path<T>`／`PathValue<T, P>`）；第二個型別參數 `true` 代表已驗證，必填欄位的回傳型別不含 `undefined`。

## 2. Namespace 與欄位

環境變數名稱**不變**（Q2），VM 的 `.env.prod`、CI、E2E 設定都不必修改。程式內路徑的命名規則（Q9）：

- camelCase；
- 去掉與 namespace 重複的前綴；
- 保留單位（`expireDay`、`rotateMinute`）；
- namespace 內只有一層，不再巢狀。

每個 namespace 一個檔案：`backend/src/config/namespaces/<namespace>.config.ts`（Q1）。2026-11-03 修訂：原為 `src/config/<namespace>.config.ts`，但 `src/config/logger.config.ts` 已是 pino 設定，與 `logger` namespace 撞名，因此集中放在 `namespaces/`，既有檔案不動。

| Namespace | 環境變數 | 程式內路徑 |
| --- | --- | --- |
| `app` | `NODE_ENV` | `app.nodeEnv` |
| | `PORT` | `app.port` |
| | `FRONTEND_URL` | `app.frontendUrl` |
| `database` | `DATABASE_URL` | `database.url` |
| `redis` | `REDIS_URL` | `redis.url` |
| `session` | `SESSION_EXPIRE_DAY` | `session.expireDay` |
| | `SESSION_ROTATE_MINUTE` | `session.rotateMinute` |
| | `MAX_DEVICE` | `session.maxDevice` |
| `auth` | `SALT_ROUNDS` | `auth.saltRounds` |
| | `VERIFY_MAIL_EXPIRE_MINUTE` | `auth.verifyMailExpireMinute` |
| | `RATE_LIMIT_VERIFY_EMAIL_SECONDS` | `auth.rateLimitVerifyEmailSeconds` |
| `mail` | `EMAIL_TRANSPORT` | `mail.transport` |
| | `SMTP_HOST` | `mail.smtpHost` |
| | `SMTP_PORT` | `mail.smtpPort` |
| | `SMTP_USER` | `mail.smtpUser` |
| | `SMTP_PASSWORD` | `mail.smtpPassword` |
| | `MAIL_FROM` | `mail.from` |
| `avatar` | `AVATAR_STORAGE_ROOT` | `avatar.storageRoot` |
| | `AVATAR_TEMP_ROOT` | `avatar.tempRoot` |
| | `AVATAR_PUBLIC_BASE_URL` | `avatar.publicBaseUrl` |
| | `AVATAR_STORAGE_DRIVER`（GCS 步驟 11-2 新增） | `avatar.storageDriver` |
| | `AVATAR_MEDIA_BUCKET`（同上） | `avatar.mediaBucket` |
| | `AVATAR_TEMP_BUCKET`（同上） | `avatar.tempBucket` |
| `gcs` | `GCS_CLIENT_EMAIL`（同上） | `gcs.clientEmail` |
| | `GCS_PRIVATE_KEY`（同上） | `gcs.privateKey` |
| `logger` | `SEQ_URL` | `logger.seqUrl` |

驗證信的兩個設定歸在 `auth`：它們決定註冊驗證流程的規則，與「信怎麼寄出」（`mail`）無關。

新增環境變數時，同時修改 `env.ts` 的 schema、對應的 namespace 檔案與本表。

## 3. 驗證與 factory（Q3、Q11）

- **維持一份 `envSchema`**（`backend/src/config/env.ts`），所有欄位與跨 namespace 的規則（例如 [頭像規格](../features/avatar.md) §0.4.2「正式環境禁止 local／禁止 `GCS_*`」）都寫在這裡。`forRoot({ validate: (config) => envSchema.parse(config) })` 維持不變，啟動時一次驗證全部。
- `env.ts` 新增 `getValidatedEnv()`：以 `envSchema` 解析 `process.env` 並回傳 `Env`。**不快取**：啟動時 9 個 factory 各解析一次，成本可忽略；快取會讓測試在案例之間修改 `process.env` 時讀到舊結果。
- 每個 namespace 的 factory 只透過 `getValidatedEnv()` 取值，**不直接讀 `process.env`**（理由見 §1）。

```ts
// backend/src/config/namespaces/session.config.ts
export const sessionConfig = registerAs('session', () => {
  const env = getValidatedEnv();
  return {
    expireDay: env.SESSION_EXPIRE_DAY,
    rotateMinute: env.SESSION_ROTATE_MINUTE,
    maxDevice: env.MAX_DEVICE,
  };
});
```

## 4. 註冊（Q5）

`backend/src/config/index.ts`（不在 `namespaces/` 內，使用端以 `@/config` 匯入）匯出：

- `configNamespaces`：9 個 namespace 的陣列；
- `AppConfig`：總型別（Q8）。

```ts
export const configNamespaces = [appConfig, databaseConfig, /* ... */ loggerConfig];

export type AppConfig = {
  app: ConfigType<typeof appConfig>;
  database: ConfigType<typeof databaseConfig>;
  // ...其餘 namespace
};
```

`app.module.ts` 與 `worker/worker.module.ts` 的 `ConfigModule.forRoot` 都加上 `load: configNamespaces`，全域載入；不使用 `ConfigModule.forFeature`。

## 5. 使用端（Q4、Q8、Q10）

- 繼續注入 `ConfigService`（Q4）。一個 service 用到多個 namespace 時，不必注入多個 token。
- 型別一律為 `ConfigService<AppConfig, true>`，讀值一律 `get(path, { infer: true })`。
- **不使用 `getOrThrow`**：必填欄位已由 zod 保證有值；選填欄位（`logger.seqUrl`、`gcs.*`）未設定時是正常狀態，`getOrThrow` 會誤丟錯。
- 預設讀單一欄位：`get('session.expireDay', { infer: true })`。同一處用到同一個 namespace 3 個以上的值時，可以讀整組：`get('mail', { infer: true })`（Q10）。讀單一欄位時，搜尋路徑就能找到所有使用處；讀整組則只搜尋得到 namespace 名稱。
- 沒有 DI 的地方（`main.ts`）：`app.get<ConfigService<AppConfig, true>>(ConfigService)`。
- 遷移完成後，`get('AVATAR_STORAGE_ROOT')` 這類舊寫法在 `ConfigService<AppConfig, true>` 下是型別錯誤，不會殘留。`Env` 型別只保留給 `env.ts`、namespace 檔案與測試使用。

```ts
constructor(private readonly configService: ConfigService<AppConfig, true>) {}

const expireDay = this.configService.get('session.expireDay', { infer: true }); // number
```

## 6. 遷移範圍與分工（Q6、Q7）

- 目前注入 `ConfigService` 的 19 個檔案**一次全部改完**，包含 `modules/socket/socket.service.ts`。該檔案另一台電腦正在進行 Board 多人同步，改完後盡快推到 `dev`，並提醒另一台在修改 `socket.service.ts` 前先 pull。
- 分工：

| 誰 | 負責 |
| --- | --- |
| 使用者 | 9 個 namespace 檔案、`config/index.ts`、`getValidatedEnv()`、19 個使用端改寫、兩個 `forRoot` 加上 `load` |
| AI | 現有 spec 中 mock `ConfigService` 的地方改為點路徑；新增 namespace 對應測試（每個路徑對應到正確的值、數字為 number、選填欄位未設定時為 `undefined`）；本文件 |

- 與頭像 GCS 步驟 11 的順序：先完成本規格；11-1 `GcsStorageService` 不讀設定，可隨時進行；11-2 直接以 `avatar.*`、`gcs.*` 實作。

## 7. 驗收

1. Backend `pnpm test`、`tsc --noEmit` 通過；ESLint 不新增錯誤。
2. 專案中不再出現 `ConfigService<Env>`，也不再以環境變數名稱呼叫 `get`／`getOrThrow`。
3. `pnpm dev:backend`、`pnpm dev:worker` 正常啟動；登入、Session 輪轉、驗證信、頭像上傳在瀏覽器或 Bruno 行為不變。
4. 缺少必填環境變數時，兩個 process 仍在啟動時失敗。
