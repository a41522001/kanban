# Session 架構與輪轉設計

## 1. 文件狀態

本文件描述 Flowboard Kanban 預計採用的 Redis server-side Session 架構。

- 狀態：設計完成，尚未實作。
- 驗證方式：HttpOnly Cookie + Redis Session。
- 不使用 Access Token / Refresh Token。
- 每位使用者最多保留 5 個有效登入裝置。
- Session ID 採 request-driven rotation。
- 輪轉後的新 Session 採 Rolling 7 天。
- 舊 Session ID 保留固定 20 秒 Grace Period，供已送出的並行請求完成。

## 2. 設計目標

1. Raw Session ID 只存在瀏覽器 Cookie，不保存至 Redis。
2. Redis key 使用 Session ID 的 SHA-256 Hash。
3. 一次裝置登入擁有穩定的 `familyId`，Session ID 輪轉不增加裝置數量。
4. 每位使用者最多存在 5 個 Current Sessions。
5. Session 到達輪轉時間後，由下一個合法請求觸發輪轉，不使用背景排程。
6. 高併發請求只能有一個請求完成輪轉，其他請求使用舊 Session Grace 完成。
7. Login、rotation、device eviction 與 logout 必須維持 Redis 資料一致性。
8. Logout 或裝置淘汰後，Current 與 Grace Session 都必須立即失效。

## 3. 核心名詞

| 名詞 | 定義 |
| --- | --- |
| Raw Session ID | 瀏覽器 Cookie 保存的不可預測隨機字串 |
| Session ID Hash | `SHA-256(rawSessionId)`，用於 Redis key 與索引 |
| Session Family | 一次裝置登入的邏輯身分，輪轉前後保持相同 `familyId` |
| Current Session | 目前正常有效、可以觸發輪轉的 Session ID |
| Grace Session | 已被新 Session ID 取代，但暫時允許既有並行請求使用的舊 Session ID |
| Rotation Interval | Current Session ID 使用多久後應進行輪轉 |
| Rolling TTL | 每次成功輪轉後，新 Current Session 重新取得完整 7 天 TTL |
| Grace Period | 舊 Session ID 輪轉後額外保留的 20 秒有效期 |

## 4. 整體架構

```text
Browser
  │ Cookie: sessionId=<rawSessionId>
  ▼
SessionGuard
  │ 解析 Cookie、驗證 Session、設定 request.userId
  ▼
SessionRotationInterceptor
  │ Session 到達 rotateAt 時執行輪轉並更新 Cookie
  ▼
SessionService
  │ 產生 ID、Hash ID、套用 Session lifecycle policy
  ▼
SessionRepository
  │ Redis Hash、ZSet、Lua 原子操作
  ▼
Redis
```

### 4.1 元件職責

| 元件 | 職責 |
| --- | --- |
| `SessionGuard` | 取得 Cookie、解析 Session、驗證 Current/Grace 狀態、設定 request identity |
| `SessionRotationInterceptor` | 對需要輪轉的請求執行原子輪轉，只有輪轉成功者更新 Cookie |
| `SessionService` | 產生 Raw Session ID、Hash ID、建立及撤銷 Session |
| `SessionRepository` | 封裝 Redis Hash、ZSet 與 Lua scripts |
| `SessionCookieService` | 集中設定與清除 Session Cookie |
| `SessionConfig` | 集中管理 Cookie name、Rolling TTL、rotation interval、Grace 與裝置限制 |

## 5. Session Cookie

瀏覽器只保存 Raw Session ID：

```http
Set-Cookie: sessionId=<rawSessionId>;
  HttpOnly;
  Secure;
  SameSite=...;
  Path=/;
  Max-Age=604800
```

Cookie 不包含：

- `userId`
- `familyId`
- 權限或角色
- 到期時間
- 裝置資訊

Cookie Max-Age 為 7 天。每次成功輪轉後，重新設定完整 7 天。

## 6. Redis 資料結構

### 6.1 Current Session Hash

Redis key：

```text
session:token:<sessionIdHash>
```

Redis type：`HASH`

| 欄位 | Redis 型別 | 必要性 | 用途 |
| --- | --- | --- | --- |
| `userId` | string | 必要 | Session 所屬使用者 ID |
| `familyId` | string | 必要 | 穩定的裝置／登入識別，輪轉時不變 |
| `state` | `current` | 必要 | 表示這是目前有效的 Session ID |
| `generation` | integer string | 必要 | 輪轉代數，初始為 `1`，每次輪轉加一 |
| `familyCreatedAtMs` | timestamp string | 必要 | 此裝置登入最初建立時間，供稽核與裝置列表使用 |
| `tokenIssuedAtMs` | timestamp string | 必要 | 目前 Session ID 的簽發時間 |
| `rotateAtMs` | timestamp string | 必要 | 超過此時間後，下一個合法請求需要輪轉 |
| `expiresAtMs` | timestamp string | 必要 | Current Session 的 Rolling 到期時間 |
| `previousSessionIdHash` | string | 選用 | 前一個 Grace Session Hash，供 logout 或裝置撤銷時一起刪除 |

Current Session Redis key TTL：

```text
7 天
```

每次成功輪轉後，新 Current Session 重新取得完整 7 天 TTL。

> Redis Hash 所有值實際上都是字串。Repository 讀取後必須使用 runtime schema 驗證與轉型，不可只使用 TypeScript type assertion。

### 6.2 Grace Session Hash

輪轉成功後，舊 Session Hash 不立即刪除，而是降級成 Grace：

```text
session:token:<oldSessionIdHash>
```

| 欄位 | Redis 型別 | 必要性 | 用途 |
| --- | --- | --- | --- |
| `userId` | string | 必要 | Session 所屬使用者 ID |
| `familyId` | string | 必要 | 與新 Current Session 相同，代表同一次裝置登入 |
| `state` | `grace` | 必要 | 表示這是已被取代的舊 Session ID |
| `generation` | integer string | 必要 | 此舊 Session ID 的輪轉代數 |
| `familyCreatedAtMs` | timestamp string | 必要 | 此裝置登入最初建立時間 |
| `tokenIssuedAtMs` | timestamp string | 必要 | 舊 Session ID 原始簽發時間 |
| `graceUntilMs` | timestamp string | 必要 | 舊 Session ID 最晚可使用時間 |
| `replacedBySessionIdHash` | string | 必要 | 指向取代它的新 Current Session Hash |

Grace Session Redis key TTL：

```text
20 秒
```

Grace Session 規則：

1. 可以完成目前請求。
2. 不可再次輪轉。
3. 不可延長 Grace TTL。
4. 不可更新 Cookie。
5. `replacedBySessionIdHash` 對應的 Current Session 不存在或 family 不一致時，立即視為無效。

第 5 點可確保 logout 或裝置淘汰後，舊 Grace Session 不會繼續使用到 TTL 自然結束。

### 6.3 使用者 Session 索引

Redis key：

```text
user:sessions:<userId>
```

Redis type：`ZSET`

```text
member = currentSessionIdHash
score  = expiresAtMs
```

用途：

- 計算目前有效裝置數量。
- 依 `expiresAtMs` 清理已過期索引。
- 找出最早到期、最久未成功輪轉的 Session。
- 第六次登入時撤銷最舊 Session。

ZSet 只保存 Current Session。Grace Session 不加入 ZSet，因此輪轉前後仍只計算一個裝置。

## 7. Session 狀態

```text
CURRENT
  │ now >= rotateAtMs
  │ 原子輪轉成功
  ▼
GRACE
  │ 20 秒到期
  ▼
EXPIRED
```

新產生的 Session ID 會成為下一個 `CURRENT`：

```text
S0 CURRENT
  │ rotation
  ├── S0 GRACE，TTL 20 秒
  └── S1 CURRENT，TTL 7 天
```

## 8. 登入流程

```text
POST /auth/login
→ 驗證帳號密碼
→ 產生 familyId
→ 產生 Raw Session ID
→ 計算 SHA-256 Session ID Hash
→ 建立 Current Session Hash
→ Redis TTL 設定 7 天
→ 加入 user Session ZSet
→ 設定 Cookie，Max-Age 7 天
```

建立 Session 時必須原子完成：

1. 清除使用者 ZSet 中已過期的索引。
2. 建立 Current Session Hash。
3. 設定 Current Hash TTL 7 天。
4. 把 Current Session Hash 加入使用者 ZSet。
5. 如果數量超過 5，取出並撤銷最舊 Current Session。
6. 被淘汰的 Current 若仍有 Previous Grace，也要一起刪除。
7. 最終保證使用者 ZSet 最多只有 5 個成員。

如果登入請求已帶有有效 Session Cookie，應先完整撤銷該 Cookie 對應的既有 Session，避免同一瀏覽器留下無法再操作的孤兒 Session。

## 9. 一般請求驗證流程

```text
取得 Cookie 中的 Raw Session ID
→ 驗證格式與型別
→ SHA-256(rawSessionId)
→ HGETALL session:token:<sessionIdHash>
→ Runtime schema validation
→ 依 state 與時間判斷
```

### 9.1 Current 且未到輪轉時間

條件：

```text
state = current
now < rotateAtMs
```

行為：

- 設定 `request.userId` 與 Session context。
- 直接放行。
- 不更新 Cookie。
- 不更新 Redis TTL。

### 9.2 Current 且已到輪轉時間

條件：

```text
state = current
now >= rotateAtMs
```

Guard 設定：

```ts
request.sessionContext = {
  userId,
  familyId,
  presentedSessionIdHash,
  needsRotation: true,
};
```

接著由 `SessionRotationInterceptor` 執行原子輪轉。

### 9.3 Grace Session

條件：

```text
state = grace
now <= graceUntilMs
```

還必須確認：

1. `replacedBySessionIdHash` 對應的 Current Session 存在。
2. Current 與 Grace 的 `familyId` 相同。

驗證成功後：

- 設定 `request.userId`。
- 允許目前請求完成。
- 不再次輪轉。
- 不設定 Cookie。
- 不延長 20 秒 Grace。

### 9.4 Session 不存在或無效

```text
Redis Hash 不存在
或 runtime schema 驗證失敗
或 state/時間關係不合法
```

行為：

```text
回傳 401
清除 Session Cookie
不執行 Controller
```

Cookie 仍存在但 Redis Session 已過期是正常狀況。Redis 是有效登入狀態的權威來源。

## 10. 輪轉流程

假設原本 Cookie 是 `S0`，且 `S0` 已到 `rotateAtMs`：

1. 應用程式產生新的 Raw Session ID `S1`。
2. 應用程式計算 `hash(S1)`。
3. Redis Lua script 原子執行輪轉。

Lua script 必須完成：

1. 確認 `S0.state === current`。
2. 確認 `now >= S0.rotateAtMs`。
3. 建立 `S1` Current Session Hash。
4. 設定 `S1.familyId = S0.familyId`。
5. 設定 `S1.generation = S0.generation + 1`。
6. 設定 `S1.tokenIssuedAtMs = now`。
7. 設定 `S1.rotateAtMs = now + rotationInterval`。
8. 設定 `S1.expiresAtMs = now + 7 days`。
9. 設定 `S1.previousSessionIdHash = hash(S0)`。
10. 設定 S1 Redis TTL 為完整 7 天。
11. 將 S0 修改為 Grace Session。
12. 設定 `S0.graceUntilMs = now + 20 seconds`。
13. 設定 `S0.replacedBySessionIdHash = hash(S1)`。
14. 將 S0 Redis TTL 改為 20 秒。
15. 從使用者 ZSet 移除 `hash(S0)`。
16. 將 `hash(S1)` 加入使用者 ZSet，score 使用 S1 的 `expiresAtMs`。
17. 回傳輪轉結果。

只有得到 `ROTATED` 的請求可以設定新 Cookie：

```http
Set-Cookie: sessionId=S1; Max-Age=604800
```

## 11. 高併發請求

假設 A、B、C 同時攜帶 S0：

```text
A ─ S0 ─┐
B ─ S0 ─┼→ Redis Lua
C ─ S0 ─┘
```

原子輪轉結果：

| 請求 | Redis 結果 | 是否放行 | 是否設定 Cookie |
| --- | --- | --- | --- |
| A | `ROTATED` | 是 | 設定 S1 |
| B | `GRACE` | 是 | 否 |
| C | `GRACE` | 是 | 否 |

只有一個請求可以從 Current 完成輪轉。其他請求即使在 Guard 階段曾讀到 Current，Lua compare-and-swap 仍會發現 S0 已變成 Grace，並回傳 `GRACE`。

建議結果型別：

```ts
type SessionRotationResult =
  | { status: 'active' }
  | { status: 'rotated'; newSessionId: string }
  | { status: 'grace' }
  | { status: 'invalid' };
```

## 12. Rolling 7 天

本設計的 Rolling TTL 定義是：

> Session 從最後一次成功輪轉開始，再存活完整 7 天。

```text
S0 建立
→ S0 Redis TTL 7 天
→ Cookie Max-Age 7 天

S0 輪轉成 S1
→ S1 Redis TTL 全新 7 天
→ Cookie Max-Age 全新 7 天

S1 輪轉成 S2
→ S2 Redis TTL 全新 7 天
→ Cookie Max-Age 全新 7 天
```

在 `rotateAtMs` 之前的普通請求不更新 Redis TTL，也不重新設定 Cookie。因此本設計是「最後一次成功輪轉後 7 天」，不是嚴格的「最後一次 API 活動後 7 天」。

如果 Current Session 7 天內完全沒有成功輪轉：

```text
Redis Session 過期
→ 下一個請求找不到 Hash
→ 回傳 401
→ 清除 Cookie
```

## 13. 第六個裝置登入

當使用者已有五個 Current Sessions，第六次登入時必須原子執行：

1. 清理 ZSet 中 `score <= now` 的過期索引。
2. 建立第六個 Current Session。
3. 把第六個 Session 加入 ZSet。
4. 若 `ZCARD > 5`，取得 score 最小的 Current Session。
5. 讀取該 Current 的 `previousSessionIdHash`。
6. 刪除被淘汰的 Current Session Hash。
7. 刪除仍存在的 Previous Grace Session Hash。
8. 從 ZSet 移除被淘汰的 Current Session。
9. 最終保證 `ZCARD <= 5`。

由於 score 使用 `expiresAtMs`，被淘汰的是最早到期、最久未成功輪轉的裝置登入。

## 14. Logout

### 14.1 使用 Current Session 登出

1. 讀取 Current Session Hash。
2. 從使用者 ZSet 移除 Current Session Hash。
3. 刪除 Current Session Hash。
4. 若有 `previousSessionIdHash`，一起刪除 Grace Session Hash。
5. 清除 Cookie。

### 14.2 使用 Grace Session 登出

1. 讀取 Grace 的 `replacedBySessionIdHash`。
2. 讀取對應的 Current Session。
3. 確認兩者 `familyId` 相同。
4. 從使用者 ZSet 移除 Current Session Hash。
5. 刪除 Current 與 Grace Session Hash。
6. 清除 Cookie。

Logout 撤銷的是整個裝置登入，不只是目前請求攜帶的單一 Session ID。

## 15. 設定

```env
SESSION_COOKIE_NAME=sessionId
SESSION_TTL_SECONDS=604800
SESSION_GRACE_SECONDS=20
SESSION_MAX_PER_USER=5
SESSION_ROTATION_SECONDS=<待決定>
```

| 設定 | 用途 |
| --- | --- |
| `SESSION_COOKIE_NAME` | Session Cookie 名稱 |
| `SESSION_TTL_SECONDS` | Current Session 與 Cookie 的 Rolling TTL，固定 7 天 |
| `SESSION_GRACE_SECONDS` | Previous Session ID 的容忍時間，固定 20 秒 |
| `SESSION_MAX_PER_USER` | 每位使用者最多有效裝置數，固定 5 |
| `SESSION_ROTATION_SECONDS` | Session ID 輪轉週期，尚未決定 |

Rotation interval 必須明顯短於 7 天。實際數值需要依安全需求、Redis 寫入量與使用者請求頻率決定。

## 16. 必須維持的不變條件

1. Raw Session ID 只能存在 Cookie 與建立該 Cookie 的應用程式記憶體中。
2. Redis 與 log 不得保存 Raw Session ID。
3. 一個 Session Family 同時最多只有一個 Current Session。
4. 一個 Current Session 同時最多只有一個 Previous Grace Session。
5. 只有 Current Session 可以輪轉。
6. Grace Session 不可輪轉或延長 TTL。
7. 只有 Redis 原子輪轉的勝出者可以設定新 Cookie。
8. 輪轉不建立新的裝置槽位，`familyId` 必須保持相同。
9. 使用者 ZSet 只計算 Current Session。
10. Logout 與裝置淘汰必須同時撤銷 Current 與 Grace Session。
11. 每次成功輪轉後，Current Redis TTL 與 Cookie Max-Age 都重新設定為完整 7 天。
12. Redis 資料解析失敗時必須 fail closed，回傳未授權而不是信任不完整資料。

## 17. 測試矩陣

### 17.1 建立與裝置限制

- 第一個登入建立一個 Current Session。
- 五個登入建立五個 Current Sessions。
- 第六個登入後仍只有五個 Current Sessions。
- 第六個登入會撤銷最早到期的 Current 與其 Grace Session。
- 多個並行登入後仍不會超過五個 Current Sessions。

### 17.2 一般驗證

- Cookie 缺少時回傳 401。
- Session Hash 不存在時回傳 401 並清除 Cookie。
- Redis Hash schema 不合法時 fail closed。
- Current 且未到 `rotateAtMs` 時直接放行。
- Current 到達 Redis TTL 後失效。

### 17.3 輪轉與並行

- Current 超過 `rotateAtMs` 時產生新 Session ID。
- 輪轉後 `familyId` 不變、`generation` 加一。
- 新 Current Redis TTL 為完整 7 天。
- 新 Cookie Max-Age 為完整 7 天。
- 舊 Current 轉為 Grace 並只保留 20 秒。
- 多個並行請求只有一個得到 `ROTATED`。
- 其他並行請求得到 `GRACE` 並可完成。
- Grace 請求不設定 Cookie。
- Grace 請求不延長 Grace TTL。
- Grace 到期後舊 Session ID 無效。

### 17.4 撤銷

- Current logout 會刪除 Current 與 Previous Grace。
- Grace logout 會刪除 Grace 與其對應 Current。
- 裝置淘汰後，該裝置的 Grace Session 也無法繼續使用。
- 使用者 Session index 不會殘留已撤銷的 Current Session。

## 18. 尚未決定

- `SESSION_ROTATION_SECONDS` 的實際數值。
- Production Cookie 的 `SameSite` 與 Domain，需依最終 frontend/API 部署方式決定。
- 是否提供使用者裝置管理 API 與裝置顯示名稱。
- Socket.IO 登出後採立即 disconnect，或在下一個敏感事件重新驗證 Session。
