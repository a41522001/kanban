# Session 架構與輪轉設計

## 1. 文件狀態

本文件記錄 Flowboard 已定案的 Redis server-side Session 設計，並以目前執行中的程式為準。

- HttpOnly Cookie + Redis Session，不使用 Access Token／Refresh Token。
- 每位使用者最多 5 個 Current Sessions，視為最多 5 個登入裝置。
- 預設每 15 分鐘允許 request-driven rotation。
- 新 Current Session 自輪轉時間起重新取得 7 天效期。
- 舊 Session 輪轉後保留 20 秒 Grace，讓已送出的並行請求完成。

| 功能 | 狀態 |
| --- | --- |
| Current Hash、ZSET 索引與 5 裝置淘汰 | 已實作於 create Lua |
| Current／Grace runtime schema | 已實作 |
| 原子輪轉與 20 秒 Grace | 已實作於 rotate Lua |
| Guard 驗證與輪轉成功後更新 Cookie | 已實作 |
| Logout 同步清理 Current、Grace 與 ZSET | 尚未完成；目前只刪除請求攜帶的 Hash |
| Service／Repository／Lua 整合測試 | 尚未完成 |

## 2. 不變條件

1. Raw Session ID 只存在瀏覽器 Cookie 與當次應用程式記憶體，不進 Redis 或 log。
2. Redis key 與 ZSET member 使用 `SHA-256(rawSessionId)`。
3. 一次登入建立穩定的 `familyId`；輪轉不增加裝置數量。
4. 同一個 family 同時最多只有一個 Current Session。
5. Grace 只能通過既有請求，不能再次輪轉、延長 TTL 或更新 Cookie。
6. 只有 Lua 原子輪轉的勝出者可以把新 Raw Session ID 寫回 Cookie。
7. Redis Hash 解析失敗時 fail closed。
8. 使用者 Session ZSET 只保存 Current，不保存 Grace。

## 3. 核心名詞與時間

| 名詞 | 定義 |
| --- | --- |
| Raw Session ID | `randomBytes(32).toString('base64url')` 產生、保存在 Cookie 的高熵字串 |
| Session ID Hash | `SHA-256(rawSessionId)`，用於 Redis key 與索引 |
| Session family | 一次裝置登入的邏輯身分，輪轉前後維持相同 `familyId` |
| Current Session | 目前有效，且可在到達 `rotateAtMs` 後觸發輪轉的 Session |
| Grace Session | 已被取代、只在 20 秒內接受既有並行請求的舊 Session |
| Rolling TTL | 成功輪轉後，新 Current 從當下重新取得完整 7 天效期 |

所有 `*AtMs` 都是 Unix epoch 的 UTC 絕對毫秒，例如 `DateTime.utc().toMillis()`。Redis Hash 值實際為字串，Repository 讀取後由 Zod 驗證並轉為 number。

## 4. 實際元件

```text
Browser Cookie
  → SessionGuard
      → SessionService.authenticateSession()
          → SessionRepository
              → RedisService + session.script.ts
                  → Redis Hash／ZSET／Lua
```

- `SessionGuard`：讀 Cookie、呼叫驗證、設定 `request.userId`；輪轉成功時設定新 Cookie。
- `SessionService`：產生 Raw ID、Hash、family ID 與 UTC 時間，負責流程編排。
- `SessionRepository`：組 Redis keys、解析 Hash schema、呼叫內建 scripts。
- `session.script.ts`：`createCurrentSession` 與 `rotateSession` 的實際執行時 Lua source。

目前沒有 `SessionRotationInterceptor`。Service 會先判斷是否需要輪轉，但 Lua 仍會重新檢查 Redis 當下狀態，處理高併發競爭。

獨立的 `backend/src/session/session.rotateSession.lua` 不是執行時來源；修改腳本時以 `session.script.ts` 為準，避免兩份內容漂移。

## 5. Cookie

Cookie 名稱目前固定為 `sessionId`：

```http
Set-Cookie: sessionId=<rawSessionId>; HttpOnly; Path=/; Max-Age=604800
```

- Development：`Secure=false`、`SameSite=Lax`。
- Production：`Secure=true`、目前為 `SameSite=None`。
- 普通請求不重設 Cookie；只有登入與成功輪轉重新設定完整 Max-Age。
- Cookie 不包含 `userId`、`familyId`、權限、角色或裝置資訊。

若 production 採同站部署，需重新評估是否需要 `SameSite=None`；跨站 Cookie 則必須另外完成 CSRF 防護。

## 6. Redis 資料結構

### 6.1 Current Session Hash

```text
key  = session:token:<sessionIdHash>
type = HASH
```

| 欄位 | Runtime 型別 | 說明 |
| --- | --- | --- |
| `userId` | string | Session 所屬使用者 |
| `familyId` | string | 同一次裝置登入的穩定 ID |
| `state` | `current` | Current discriminator |
| `generation` | number | 首次登入為 1，每次輪轉加 1 |
| `familyCreatedAtMs` | number | family 首次建立時間 |
| `tokenIssuedAtMs` | number | 這一代 Session 的簽發時間 |
| `rotateAtMs` | number | 到達後由下一個合法請求嘗試輪轉 |
| `expiresAtMs` | number | Current 絕對到期時間 |
| `previousSessionIdHash` | string，可省略 | 上一代 Grace Hash；首次登入沒有 |

Hash 使用 `PEXPIREAT(expiresAtMs)` 設定絕對到期時間。

### 6.2 Grace Session Hash

邏輯 schema：

| 欄位 | Runtime 型別 | 說明 |
| --- | --- | --- |
| `userId` | string | Session 所屬使用者 |
| `familyId` | string | 與新 Current 相同 |
| `state` | `grace` | Grace discriminator |
| `generation` | number | 舊 Session 的世代 |
| `familyCreatedAtMs` | number | family 首次建立時間 |
| `tokenIssuedAtMs` | number | 舊 Session 的簽發時間 |

輪轉 Lua 只把舊 Hash 的 `state` 改為 `grace`，再用 `PEXPIREAT(graceUntilMs)` 將 key 設為 20 秒後到期。原本的 Current 專用欄位可能仍物理存在，但 Grace runtime schema 不使用它們；有效期完全由 Redis TTL 決定，所以不需要保存 `graceUntilMs` 或指向新 Current 的欄位。

### 6.3 使用者 Session ZSET

```text
key    = user:sessions:<userId>
type   = ZSET
member = currentSessionIdHash
score  = expiresAtMs
```

用途：計算 Current／裝置數、清理過期索引、超過 5 個裝置時淘汰最早到期的 Current。每次建立或輪轉後，ZSET 以目前最大 score 設定 `PEXPIREAT`，避免較早到期的新寫入縮短整個索引 TTL。

## 7. 建立與裝置限制

`saveCurrentSession(userId)`：

1. 讀取 `SESSION_EXPIRE_DAY`、`SESSION_ROTATE_MINUTE`、`MAX_DEVICE`。
2. 計算 `tokenIssuedAtMs`、`rotateAtMs`、`expiresAtMs`。
3. 產生 Raw Session ID、SHA-256 Hash 與 `familyId`。
4. 呼叫 `createCurrentSession` Lua。

Lua 原子完成：

1. 用 `ZREMRANGEBYSCORE ... -inf nowMs` 清除已過期索引。
2. 建立 Current Hash 並設定 `PEXPIREAT`。
3. 加入 ZSET，score 為 `expiresAtMs`。
4. 超過 `MAX_DEVICE` 時，由最小 score 開始淘汰，但不淘汰本次新 Session。
5. 刪除被淘汰 Current，以及它的 `previousSessionIdHash` 所指向的 Grace。
6. 移除 ZSET member 並更新 ZSET TTL。

因 Grace 不在 ZSET，輪轉不會多佔裝置名額。

## 8. 驗證與輪轉

```text
Hash rawSessionId
→ HGETALL
→ Zod runtime schema
→ Grace：驗證成功，不輪轉
→ Current 且 now < rotateAtMs：驗證成功
→ Current 且 now >= rotateAtMs：產生候選新 Session，呼叫 rotate Lua
```

Rotate Lua 的結果：

1. 舊 Hash 不存在：`MISSING`。
2. 舊 Hash 已是 Grace：`GRACE`。
3. 舊 Hash 是 Current，但尚未到輪轉時間：`CURRENT`。
4. 已到輪轉時間：建立新 Current、舊 Session 改為 Grace、替換 ZSET member：`ROTATED`。

```ts
type RotateSessionReply =
  | { status: 'MISSING' }
  | { status: 'GRACE'; userId: string }
  | { status: 'CURRENT'; userId: string }
  | { status: 'ROTATED'; userId: string };

type AuthenticateSessionResult = {
  userId: string;
  rotatedSessionId?: string;
};
```

只有 `ROTATED` 會帶 `rotatedSessionId`，Guard 才設定新 Cookie。

## 9. 高併發行為

假設 A、B、C 同時攜帶已到輪轉時間的 S0：

| 請求 | Lua 看到的狀態 | 結果 | 新 Cookie |
| --- | --- | --- | --- |
| A | Current 且到期 | `ROTATED` | 設定 S1 |
| B | Grace | `GRACE` | 不設定 |
| C | Grace | `GRACE` | 不設定 |

即使三個請求在進 Lua 前都讀到 Current，Lua 仍是原子執行。只有一個腳本能先把 S0 改為 Grace，其他舊 Cookie 請求只在 20 秒內繼續完成，不會產生 S2、S3。

## 10. 到期語意

目前不是 idle timeout，也沒有獨立的 family absolute lifetime。

- 首次登入：Current Hash 與 Cookie 取得完整 7 天。
- 普通請求：不延長 Redis TTL，不重設 Cookie。
- 成功輪轉：新 Current 與 Cookie 從輪轉時間起重新取得完整 7 天。
- Grace：固定 20 秒。

精確語意是「最後一次成功輪轉後 7 天」。

## 11. Logout 與撤銷現況

`POST /auth/logout` 目前會清除 Cookie，並用 `SessionRepository.delete()` 刪除請求攜帶的單一 Session Hash。

尚未做到：

- 從 `user:sessions:<userId>` 移除對應 Current member。
- Current logout 時一起刪除 `previousSessionIdHash` 指向的 Grace。
- Grace logout 時找到並撤銷同 family 的新 Current。
- 變更密碼後撤銷全部 Sessions，或主動撤銷指定裝置。

Current logout 可在不改 schema 的情況下，用 Lua 讀取 `userId` 與 `previousSessionIdHash`，原子刪除 Current、Previous Grace 與 ZSET member。

最小 Grace schema 沒有指向新 Current 的反向欄位，所以「攜帶 Grace Cookie 登出時撤銷新 Current」目前做不到。若需要此保證，必須新增 family/current 索引或調整 Grace schema；這是公開上線前仍需處理的限制。

## 12. 設定

```env
SESSION_EXPIRE_DAY=7
SESSION_ROTATE_MINUTE=15
MAX_DEVICE=5
```

| 設定 | 預設值 | 用途 |
| --- | --- | --- |
| `SESSION_EXPIRE_DAY` | 7 | Current TTL 與 Cookie Max-Age |
| `SESSION_ROTATE_MINUTE` | 15 | 開始允許輪轉的時間 |
| `MAX_DEVICE` | 5 | 每位使用者最多 Current Sessions |

Cookie name `sessionId` 與 Grace 20 秒目前是程式常數，尚未環境變數化。

## 13. Redis 部署限制

兩支 Lua 同時操作 Session Hash 與使用者 ZSET，目前以單一 Redis instance 為部署目標。若未來使用 Redis Cluster，跨 slot keys 不能直接由同一支 script 操作，必須重新設計 key hash tag 或資料分區。

## 14. 測試矩陣

### 建立與裝置限制

- 五個登入建立五個 Current Sessions。
- 第六個登入後仍只有五個，並淘汰最早到期的 Current 與 Previous Grace。
- 多個並行登入後仍不超過 `MAX_DEVICE`。

### Schema 與 Guard

- Current／Grace Redis 字串欄位可正確轉型。
- 缺欄位或數字格式錯誤時 fail closed。
- Cookie 缺少、型別錯誤、Session 不存在時回 401。
- Current 有效時設定 `request.userId`。

### 輪轉與並行

- 未到 `rotateAtMs` 回 `CURRENT`。
- 到達時間後，新 Current 的 `familyId` 不變、`generation + 1`。
- 舊 Current 轉為 Grace 並在 20 秒後到期。
- 多個並行請求只有一個 `ROTATED`，其餘 `GRACE`。
- 只有勝出者設定新 Cookie；Grace 不延長 TTL、不再次輪轉。

### 撤銷

- Current logout 原子刪除 Current、Previous Grace 與 ZSET member。
- 登出後 Cookie 被清除。
- 裝置淘汰後 Current 與 Previous Grace 都無法使用。
- ZSET 不殘留已撤銷 member。

## 15. 後續工作

1. 完成原子 logout／revoke，並決定 Grace Cookie logout 的保證範圍。
2. 補齊 SessionService、SessionRepository 與兩支 Lua 的 unit／integration tests。
3. 決定無效 Session 回 401 時是否由 Server 主動清除 Cookie；目前未實作。
4. Socket.IO 接入前，決定 handshake 是否允許觸發輪轉；不能讓 Redis 已輪轉但瀏覽器沒有收到新 Cookie。
5. 若提供裝置管理頁，再新增 device metadata 與 revoke endpoint，不提前把 user-agent 塞進核心 Session Hash。
