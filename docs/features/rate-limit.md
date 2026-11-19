# 登入與註冊 Rate Limit

日期：2026-11-17。狀態：規則已確認（grill Q1–Q12），實作中（§10）。

對應 [安全檢查清單](../guides/security-checklist.md) 第 13 行「Login 與 signup 有 rate limit，並考慮 IP 與帳號兩個維度」，以及 §12 上線前阻擋條件「Login 沒有 rate limit」。

## 1. 範圍（Q1）

| Endpoint | 這次處理 | 原因 |
| --- | --- | --- |
| `POST /auth/login` | ✅ | 猜密碼 |
| `POST /auth/signup` | ✅ | 大量建立帳號、寄出大量驗證信 |
| `POST /auth/resend-verification-email` | 不變 | 已有每個 email 的冷卻（`RATE_LIMIT_VERIFY_EMAIL_SECONDS`） |
| `PATCH /auth/verify/:token` | 不做 | token 為 32 bytes 隨機值，無法暴力猜中 |
| `POST /auth/logout` | 不做 | 需要已登入 |

做成共用元件，之後的忘記密碼直接套用。

## 2. 規則（Q3、Q4、Q7、Q8）

| 規則 | key 維度 | 上限 | 視窗 | 計數對象 |
| --- | --- | --- | --- | --- |
| login | `email + IP` | 5 | 15 分鐘 | 失敗 |
| login | `IP` | 50 | 15 分鐘 | 失敗 |
| login | `email` | 100 | 1 小時 | 失敗 |
| signup | `IP` | 20 | 1 小時 | 每次請求（成功也算） |

- **三個 login 維度各擋一種攻擊**：`email + IP` 是同一來源反覆猜同一帳號，正常使用者打錯密碼只會碰到這一層；`IP` 擋一個 IP 對很多帳號各猜幾次（撞庫）；`email` 擋從很多 IP 猜同一帳號。`email` 的門檻最寬，攻擊者要鎖住別人的帳號至少需要 20 個 IP。任一個超過就擋。
- **signup 只用 IP**：同一個 email 第二次註冊就會失敗，以 email 計數沒有意義。signup 要防的是「成功」本身（每次成功都建立帳號並寄信），所以每次請求都算，成功也不清除。
- **固定視窗**：第一次計數時建立 key 並設定 TTL，之後只 +1，TTL 不重設。重設 TTL 會讓攻擊者每隔 14 分鐘試一次就永遠不歸零，也會延長正常使用者的等待。視窗交界時最多可連續 2N 次，對猜密碼影響可忽略。
- email 已由 DTO `trim().toLowerCase()` 正規化，key 直接使用。

## 3. 計數流程（Q5、Q6、Q12）

### 3.1 login：先記一筆，密碼正確再退回

```
1. hit：一段 Lua 先讀三個 key，任一個已到上限 → 429，不比對密碼、不加計數
   都未到上限 → 三個 key 各 +1（讀取與 +1 在同一個 script 內，原子操作）
2. 比對密碼
3. 失敗（email 不存在、不是 LOCAL 帳號、密碼錯誤）→ 不做事，這次已算進去
   密碼正確（登入成功，或信箱未驗證的 403 / 2005）→ 退回：
     email + IP：刪除（Q6，成功後從 0 開始）
     IP、email：各 -1（只退回這次自己加的，不歸零）
```

- **被擋時不比對密碼**（Q5）：否則被擋時仍能從「密碼正確回 200、錯誤回 429」分辨答案，限制形同虛設。代價是被擋的正常使用者輸入正確密碼也要等到視窗結束。
- **成功時不清除 `IP`、`email`**（Q6）：清除的話，攻擊者每猜幾次別人的帳號就用自己的帳號登入一次，把 IP 計數歸零。
- **為什麼在比對密碼之前就 +1**（Q12）：如果「檢查」在比對密碼前、「+1」在比對失敗後，兩者分成兩次往返 Redis、中間隔著 bcrypt（約 100ms），同時送出的 1000 個請求都會在檢查時讀到 0 而全部通過。改成在同一個 Lua script 內「檢查、+1」：Redis 一次只執行一個 script，1000 個請求會排隊，只有前 5 個能進到比對密碼。
- **被擋住的請求不加計數**（2026-11-17 R-3 討論）：被擋的使用者繼續按登入，若照樣 +1，`IP` 計數會被灌高而擋到共用 IP 的同事，`email` 計數也會被灌高。不加則只影響他自己。
- **退回必須用 Lua「key 存在才 -1」**：比對密碼期間視窗可能剛好到期、key 消失，此時直接 `DECR` 會建立值為 -1、沒有 TTL 的 key（永久多一次機會且永不過期）。`DECR` 會保留既有 TTL。

### 3.2 signup

```
1. hit：IP key +1，超過上限 → 429
2. 照原本流程註冊
```

不退回、不清除。

## 4. Redis（Q2、Q11）

自己用 Redis 實作（不使用 `@nestjs/throttler`）：throttler 預設存在記憶體（重啟歸零、多 instance 各算各的），只能計算請求次數、無法只算失敗，以 email 計數也要在 DTO 驗證之前的 guard 階段取 body。

**位置**：`infrastructure/redis`，與 `RedisLockService` 相同層級，script 經 `redis.scripts.ts` 彙整。

| 操作 | 實作 | 說明 |
| --- | --- | --- |
| hit（login、signup 各一支） | Lua：先讀每個 key（不存在當作 0），任一個已到上限 → 回傳這些 key 中最長的剩餘毫秒數（`PTTL`，至少 1），不加計數；否則每個 key `INCR`，結果為 1 時 `EXPIRE` 視窗秒數，回傳 0 | 檢查與 +1 在同一個 script 內，不會被同時送出的請求繞過；不會出現「有值沒 TTL」。login 固定 3 個 key、signup 固定 1 個 key，各自設定 `NUMBER_OF_KEYS`（2026-11-19 決定分成兩支，不做可變 key 數的通用版） |
| refund（login） | Lua：`DEL` `email + IP`；`IP`、`email` 存在才 `DECR` | 見 §3.1；`DEL` 與退回放在同一個 script，一次往返 |

**Key 格式**（`redisKeys`）：

| key | 格式 |
| --- | --- |
| login `email + IP` | `rateLimit:login:emailIp:{email}:{ip}` |
| login `IP` | `rateLimit:login:ip:{ip}` |
| login `email` | `rateLimit:login:email:{email}` |
| signup `IP` | `rateLimit:signup:ip:{ip}` |

**Redis 錯誤：擋下（fail-closed，Q11）**。不接住錯誤，交給 Filter 回 500。和拖曳鎖相反：拖曳鎖是體驗輔助，放行頂多兩人都存檔；限流是安全防護，放行等於讓攻擊者趁 Redis 故障無限猜。而且 Redis 故障時登入（Session 存在 Redis）與註冊後寄信（BullMQ 在 Redis）本來就無法完成，擋下沒有額外代價。

## 5. 回應（Q9）

| 項目 | 內容 |
| --- | --- |
| HTTP status | 429 |
| 錯誤碼 | `LoginRateLimited = 2009`、`SignupRateLimited = 2010` |
| `data` | `{ retryAfterSeconds }`：超過上限的 key 中剩餘時間最長者，毫秒無條件進位成秒 |
| 訊息 | 「嘗試次數過多，請稍後再試」；**不說明是哪個維度被擋**，避免透露防護細節 |
| 前端 | 登入、註冊表單顯示訊息與倒數，倒數結束前停用送出（參考重寄驗證信的倒數） |

分成兩個錯誤碼，前端不必依呼叫的 API 判斷要顯示哪一種訊息。

## 6. 取得使用者 IP（Q10）

**現況**：正式環境經 Nginx 轉發，Nginx 沒有傳 `X-Forwarded-For`、Express 沒有設定 `trust proxy`，`req.ip` 全部是 Nginx container 的 IP，所有使用者會被算成同一個 IP。

**Nginx**（`frontend/nginx.conf` 的 `/v1/api/`）：

| Header | 值 | 意思 |
| --- | --- | --- |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` | 經過的 IP 清單，越左越接近使用者；Nginx 在收到的清單後面加上直接連進來的 IP |
| `X-Forwarded-Proto` | `$scheme` | 使用者原本用 http 或 https；HTTPS 在 Nginx 結束後，backend 靠它判斷 `req.secure` |

`X-Real-IP` 不加：Express 不讀取。

**Express `trust proxy`**：env `TRUST_PROXY_HOPS`，代表「使用者與 backend 之間有幾層自己控制的 proxy」。Express 把 `X-Forwarded-For` 清單加上直接連線的位址排成一串，由右往左信任 N 個，再往左一個就是 `req.ip`。

```
攻擊者送出 X-Forwarded-For: 1.1.1.1（偽造）
Express 看到：[1.1.1.1, 203.0.113.5, 172.18.0.3]
               偽造      真正的使用者   Nginx（直接連線）
```

| 值 | `req.ip` | 使用時機 |
| --- | --- | --- |
| `0`（預設） | `172.18.0.3` | 開發環境：前端直接連 `localhost:4001`，沒有 proxy |
| `1` | `203.0.113.5` ✅ | 正式環境：只有 Nginx，backend 不對外開 port |
| `2` | — | 之後在 Nginx 前面加 Cloudflare 或 Load Balancer |

不使用 `true`：會取最左邊的 `1.1.1.1`，攻擊者每次換一個偽造 IP 就能繞過 IP 限制。數字設得比實際層數多同樣危險，所以預設為 0。

## 7. 設定（Q7）

放 env（`auth` namespace；`TRUST_PROXY_HOPS` 放 `app` namespace），附預設值：

| env | 預設 |
| --- | --- |
| `RATE_LIMIT_LOGIN_EMAIL_IP_MAX` | 5 |
| `RATE_LIMIT_LOGIN_EMAIL_IP_WINDOW_SECONDS` | 900 |
| `RATE_LIMIT_LOGIN_IP_MAX` | 50 |
| `RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS` | 900 |
| `RATE_LIMIT_LOGIN_EMAIL_MAX` | 100 |
| `RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS` | 3600 |
| `RATE_LIMIT_SIGNUP_IP_MAX` | 20 |
| `RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS` | 3600 |
| `TRUST_PROXY_HOPS` | 0 |

放 env 的原因：E2E 全部從 `127.0.0.1` 發出、會註冊大量帳號，`.env.e2e` 需要調高門檻；專門測限流的測試再用自己的低門檻。`.env.prod` 設 `TRUST_PROXY_HOPS=1`。

## 8. Log

被擋時記 `warn`：`auth.login.rate_limited`、`auth.signup.rate_limited`，帶 `ip`，**不記 email**（[logging](../architecture/logging.md) 規則）。

## 9. 不做

- 驗證碼（CAPTCHA）、逐次加長的鎖定、帳號被大量嘗試時通知本人。
- 滑動視窗：精準但每個 key 要存 N 筆，程式較複雜；固定視窗的交界誤差對猜密碼影響可忽略（Q4）。
- 其他 endpoint（§1）。

## 10. 實作步驟

| 步驟 | 內容 | 負責 | 狀態 |
| --- | --- | --- | --- |
| R-1 | contracts：`LoginRateLimited = 2009`、`SignupRateLimited = 2010`；429 `data` 型別 | 使用者 | 完成（2026-11-19） |
| R-2 | env 與 namespace（§7）、`main.ts` 設定 `trust proxy`、`nginx.conf` 加 header（§6） | 使用者 | 完成（2026-11-19） |
| R-3 | `redisKeys`、`rateLimit.script.ts`（hit、refund）、`RateLimitService`（`hitLogin`、`hitSignup`、`refundLogin`） | 使用者 | 完成（2026-11-19） |
| R-4 | `auth.controller` 傳入 `req.ip`；`auth.service` login、signup 套用 §3 | 使用者 | 完成（2026-11-19） |
| R-5 | `LOG_EVENTS`；單元測試；E2E（真 Redis：門檻、同時送出、退回時 key 已過期、trust proxy）；Bruno；`.env.e2e` 補上限流 env | Claude | 完成（2026-11-19）：單元 520、E2E 51 全部通過 |
| R-6 | 前端：登入、註冊處理 2009／2010 與倒數 | Claude | 待實作 |
| R-7 | 文件：安全檢查清單、`progress.md`、`http-api.md`、`deployment.md`；新增 `backend/.env.prod.example`（全部變數，敏感值留空；正式環境特有值如 `TRUST_PROXY_HOPS=1`、`NODE_ENV=production`、DB／Redis host 用 service 名稱直接寫好），`deployment.md` 指向它 | Claude | 待實作 |
