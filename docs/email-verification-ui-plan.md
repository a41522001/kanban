# 驗證信前端與 Figma 設計提案

日期：2026-09-27。
狀態：待使用者審查。本文為目標設計，不表示功能已實作；審查通過後才產生 SVG，再更新既有 Figma Generator，最後開發前端。

## 範圍與來源

本提案涵蓋 LOCAL 帳號從註冊、等待驗證、重寄、點擊信件到驗證後登入的完整流程，包括未驗證登入與操作失敗的恢復方式。「後續功能」以此驗證信流程為範圍；Google OAuth、忘記密碼及完整帳號設定另外列為候選需求。

| 來源 | 本次用途 |
| --- | --- |
| [目前驗證信實作](email-verification-worker-spec.md)及 backend 原始碼 | 現況；本文的新 API 與行為不可冒充已完成 |
| [前端設計規則](frontend-design-guidelines.md)及 frontend/src/styles/index.css | 元件、色彩、字體、尺寸與互動規則 |
| [design 索引](../design/README.md)與 Current Auth SVG | 現有登入／註冊視覺基準；archive 不使用 |
| [Figma 流程](figma-ui-design-workflow.md)及 [Plugin](../figma-plugin/README.md) | 更新既有 Generator 與既有 Flowboard — Native Design System |
| [.agents 設計 skill](../.agents/skills/figma-plugin-native-design/SKILL.md) | 原生 Figma nodes、components、Auto Layout、manifest 與驗收 |
| [現有前端 Auth](frontend-auth-plan.md)及 frontend/src | 登入、註冊、Session 與錯誤處理的接入位置 |

保留目前實作文件作為現況；本提案核准並逐項落地後，再同步相關功能文件。

## 建議的頁面結構

共新增兩個公開頁面，重寄整合在驗證信頁，不另做第三個獨立頁面。

| 頁面 | 建議路由 | 用途 |
| --- | --- | --- |
| 驗證信頁 | /auth/check-email | 註冊後等待、登入未驗證提示、輸入信箱重寄、重寄倒數與失敗 |
| 驗證結果頁 | /auth/verify/:token | 讀 token 自動驗證，顯示處理中、成功、連結不可用或暫時失敗 |

另為 /auth/verify（缺少 token）提供相同的連結不可用畫面。路由以 meta.public 等明確規則判斷，不用比對含動態 token 的完整字串。這些頁面不要求 Session，也不為了進入頁面而連接 Socket。

現有 /login、/signup 繼續使用，更新成功後的導向與相關提示即可。

## 使用流程

### 1. 註冊成功

1. 使用者提交註冊。
2. User 建立且寄信工作成功入列後，導向 /auth/check-email。
3. 顯示註冊信箱、查看收件匣／垃圾郵件提示、有效期限說明。
4. 重寄按鈕進入建議 60 秒冷卻；後端應同時記錄首次寄信請求的冷卻。
5. 使用者開啟信件連結，在驗證結果頁完成驗證。
6. 成功後按「前往登入」；不自動登入、不自動跳轉。

註冊動作文案使用「建立帳號」。現有 SVG 的「建立工作區」與 API 只建立 User 的行為不符，需要同步修正。

### 2. 登入但尚未驗證

1. 後端先確認帳號與密碼正確。
2. emailVerifiedAt 為 null 時回傳專用 EmailVerificationRequired，且不建立 Session。
3. 前端清除密碼輸入，帶已提交的 Email 導向 /auth/check-email。
4. 顯示「請先驗證電子郵件」與主要操作「寄送驗證信」。
5. 只有使用者按下按鈕才呼叫寄信 API；進入或重新整理頁面不自動寄信。
6. 若已有冷卻期限，顯示倒數；使用者也可直接去開啟先前信件。

登入帳密錯誤仍留在登入頁，不能因 Email 存在但密碼錯誤而導向未驗證提示。

### 3. 重寄驗證信

入口包含驗證信頁、失效連結頁及登入頁的「沒有收到驗證信？」連結。

- 有 Email context：顯示信箱並提供重寄。
- 從其他裝置開啟或 context 遺失：顯示 Email 欄位與「寄送驗證信」。
- 送出中停用重複提交；受理後顯示成功回饋與倒數。
- 冷卻預設 60 秒，以後端 data.retryAfterSeconds 為準；retryAt 是前端自行計算的截止時間，不是 API 欄位。前端倒數不是限流依據。
- 429 更新倒數，不顯示一般伺服器故障。
- 網路失敗保留 Email 並允許重試；若請求結果不明確，不宣稱一定沒有寄信。
- 格式錯誤直接標在 Email 欄位。

公開重寄介面對不存在、已驗證或 Google 帳號使用一致的受理文案：「若此信箱有尚未驗證的帳號，我們會寄送驗證信。」不另外顯示「查無帳號」。只有符合條件的 LOCAL 帳號實際入列。

### 4. 點擊驗證連結

| 狀態 | 建議文案 | 操作 |
| --- | --- | --- |
| 驗證中 | 正在驗證你的電子郵件 | 顯示進度提示，同一次載入避免重複請求 |
| 成功 | 電子郵件驗證成功 | 前往登入 |
| 缺少／無效／到期／已使用 token | 此驗證連結已無法使用 | 重新寄送驗證信；返回登入 |
| 網路／服務暫時失敗 | 暫時無法完成驗證，請稍後再試 | 再試一次；返回登入 |

Redis key 被刪除或到期後，現有資料不足以區分「已使用」「已過期」「隨機錯誤 token」，所以合併為連結不可用，不設計沒有資料支持的個別判斷。

若仍有效的 token 對應到同一個已驗證信箱，後端已直接視為成功、清除該 token、不改寫原驗證時間。已刪除 token 再開啟則顯示連結不可用。後端 E2E 已涵蓋此差異；前端仍需驗收重複開啟與重試畫面。

驗證頁只根據 token 的後端結果顯示成功，不根據目前登入者或瀏覽器暫存的 Email 推定被驗證的帳號。

## 文案與「已寄出」狀態：需審查

目前註冊成功及重寄受理，預設只代表工作已入列，不能保證 SMTP 已完成。

建議第一版把等待頁標題定為「請查看你的信箱」。已確認註冊成功的入口可寫「驗證信正在寄送至 user@example.com，可能需要一點時間」；公開重寄入口顯示「重寄申請已受理」與上述條件式文案，不宣稱該信箱一定有帳號或一定會寄信。

如果必須精確顯示「驗證信已寄出」，需再加入寄信結果查詢或推播，並把寄送中、寄出成功與 SMTP 失敗都納入 API contract 和 UI。即使 SMTP 成功，也不能保證信件已進收件匣。

本提案建議先採「請查看你的信箱」方案；是否加入真實寄送狀態追蹤，由使用者審查決定。未核准前不增加查詢 API 或 Socket 流程。

## 原需求之外需要補齊的情境

| 情境 | 建議處理 |
| --- | --- |
| 重新整理驗證信頁 | sessionStorage 僅保存 Email、入口原因與 retryAt；遺失時退回 Email 表單，不誤顯示寄信成功 |
| 另一裝置開啟信件 | 驗證只依賴 URL token，不依賴註冊頁的暫存 |
| 在另一分頁完成驗證 | 原頁提供「已完成驗證？前往登入」，登入時由後端判定；第一版不新增自動輪詢 |
| 重寄產生多封信 | 建議各 token 保留自己的期限；任一成功後不再改寫時間，其他有效 token 可回報成功 |
| 驗證中重新整理 | 可以重新請求，但後端需處理重複驗證；若 token 已消耗，顯示不可用並提供登入入口 |
| 註冊帳號已建立但入列失敗 | 顯示「帳號已建立，暫時無法寄送驗證信」，提供再次寄送；需專用 API 結果，不能靠一般 500 猜測 |
| 註冊 Email 已存在 | 留在註冊頁提示，提供登入及重寄入口；不能直接推定該帳號尚未驗證 |
| 信箱填錯 | 「使用其他信箱」只切換重寄目標，不修改帳號 Email；原註冊信箱錯誤時提供返回註冊的入口 |
| 已登入其他帳號又點信件 | 驗證不切換或覆寫現有 Session；需要切換帳號時提供明確「切換帳號登入」，由使用者操作登出 |
| 網路錯誤、重複點擊、429 | 保留輸入、送出中 disabled、可恢復操作、伺服器決定冷卻 |
| 長 Email、手機鍵盤、英文文案 | Email 可換行，畫面可垂直捲動，不能截掉按鈕或使橫向溢出 |
| 無障礙操作 | 鍵盤 focus、欄位錯誤關聯、aria-live 結果提示；倒數不逐秒打斷螢幕閱讀器 |

不把密碼、Session ID 或驗證 token 放入 sessionStorage / localStorage。Email 暫存只協助 UX，不作為驗證身分的依據。

「修改已建立帳號的 Email」「忘記密碼」「Google 登入」「寄信投遞狀態追蹤」為額外候選功能，尚未核准納入本輪。若要真正修改 Email，需要獨立的身分驗證與帳號更新流程。

## 視覺方向

- 沿用 Current Login / Signup：Desktop 左側深藍品牌區、右側淺灰開放內容區；Mobile 簡化為 Logo、標題、狀態與操作。
- 品牌主操作沿用珊瑚色 #DF6E51、背景 #F7F8FA、文字 #29324A；錯誤沿用 feedback-danger。
- 沿用 Noto Sans TC 與既有語意 tokens、Button、Input、FormField、Logo。狀態圖示用向量，搭配文字，不只靠顏色。
- 不在驗證結果頁重複展示登入／註冊表單或不相關行銷內容；每個狀態突出一個主要下一步。
- 持久狀態顯示於頁面；重寄受理可補短暫提示，但不能只有 Toast。
- Desktop 1440 × 900；Mobile 390 × 844；Tablet 沿用自適應版型，有實際結構差異時才另畫 768 × 1024。
- 控制項觸控區約 44px，手機保留至少 16px gutter；內容超出 viewport 時正常捲動。
- 所有文案提供繁中／英文 i18n 對應；設計稿先用繁中與 example.com 的假資料。

現有 CSS 的 font token 指定 Noto Sans TC，但 Google Fonts import 載入 Noto Sans，需在前端實作階段核對並統一，避免 Figma 與瀏覽器字形不同。

## SVG → Figma → Vue manifest（待審查）

核准後新增 12 個狀態，各做 Desktop / Mobile，預計 24 個 SVG。每個檔案只含一個產品畫面，檔名以以下 basename 加 .svg 或 -mobile.svg。

| Basename | 頁面／狀態 | Figma section |
| --- | --- | --- |
| auth-email-notice-signup-pending | 註冊後等待驗證信 | Auth / Email Verification |
| auth-email-notice-verification-required | 登入遭擋後，提示寄送 | Auth / Email Verification |
| auth-email-notice-enter-email | 無暫存資料，輸入信箱 | Auth / Email Verification |
| auth-email-notice-sending | 正在提交寄信請求 | Auth / Email Verification |
| auth-email-notice-resend-accepted | 重寄受理與回饋 | Auth / Email Verification |
| auth-email-notice-cooldown | 冷卻中及 429 回饋 | Auth / Email Verification |
| auth-email-notice-request-error | 寄信請求失敗／輸入錯誤示例 | Auth / Email Verification |
| auth-email-notice-signup-mail-error | 帳號已建立但寄信排程失敗 | Auth / Email Verification |
| auth-email-verify-loading | 驗證中 | Auth / Email Verification |
| auth-email-verify-success | 驗證成功 | Auth / Email Verification |
| auth-email-verify-unavailable | 缺少、錯誤、到期或已使用 token | Auth / Email Verification |
| auth-email-verify-request-error | 可重試的網路／服務錯誤 | Auth / Email Verification |

既有 auth-login、auth-signup 的 Desktop / Mobile 共 4 個 SVG 同步入口、CTA 與導向說明，維持原視覺語言。若核准真實寄送狀態追蹤，再擴充 manifest 中的寄送成功／失敗狀態。

Figma 沿用既有檔案的 01 · Foundations、02 · Components、03 · Screens。更新既有 figma-plugin，不建立另一套 Generator，不直接匯入 SVG 當成交付。

建議新增兩個 domain component sets：Email Verification Notice、Email Verification Result，包含 Viewport 與 State variants。重複使用現有 Button / Input / FormField；Screens 使用 Instances 與 Auto Layout。既有 Auth / Login、Auth / Signup section 保留。

Vue 建議對應 EmailVerificationNoticeView、EmailVerificationResultView；Notice / Result 組合元件放在 components/account，基礎控制項使用既有 components/ui 與 shared。實作時沿用 <template>、<script setup lang="ts">、<style scoped> 順序。

## 後端與 contract 依賴（2026-09-27 更新）

| 能力 | 現況 | 目標 |
| --- | --- | --- |
| 註冊成功導向等待頁 | 後端回傳 SignupResult 與 retryAfterSeconds；前端仍導向登入 | 前端改導向等待頁 |
| 未驗證登入 | 已回傳 403 + EmailVerificationRequired，不建立 Session | 前端依 code 導向驗證信頁 |
| 重寄 | 已實作 POST /auth/resend-verification-email；受理 202，冷卻 429 | 串接重寄按鈕 |
| 重寄結果 | contracts 已提供 ResendVerificationEmailResult；data.retryAfterSeconds | 依後端秒數倒數，不從 header 取值 |
| 驗證結果 | PATCH /auth/verify/:token；400 / AuthVerifyFail、500 / InternalError | 分別顯示連結不可用與服務故障 |
| token 一次性使用 | DB 成功後刪 key；其他有效 token 不重寫時間 | 顯示成功或連結不可用 |
| 部分註冊成功 | 201 / SignupEmailQueueFailed；data.accountCreated 為 true、emailQueued 為 false | 告知帳號已建立並提供重寄 |
| 有效期限文案 | Worker 用 VERIFY_MAIL_EXPIRE_MINUTE，只有信件提供分鐘數；HTTP 未回傳到期時間 | SVG 先寫「請在信件標示的期限內完成驗證」；若需精確數字再擴充 contract |
| 已登入狀態 | 已有 User Store 與 logout | 公開驗證頁保留 Session；切換帳號必須明確操作 |

前端根據 ApiCode 切換狀態，不比對 message 字串。上述後端 contracts 已實作；細節見 email-verification-worker-spec.md。UI / SVG / Figma 仍依本提案審查後再生成。

## API 與畫面狀態對照（靜態盤點）

以下沿用 [目前 HTTP API](http-api.md#auth-api-詳細規格)，不是新增 API 的提案。

| API 結果 | 設計狀態 | 前端注意事項 |
| --- | --- | --- |
| signup 201 / 1 | signup-pending | data.emailQueued=true 僅代表入列 |
| signup 201 / 2007 | signup-mail-error | Axios 成功分支也要處理；帳號已建立 |
| login 403 / 2005 | verification-required | data 僅有 email，沒有倒數；無暫存時允許提交，再以 429 校正 |
| resend 202 / 1 | resend-accepted | 不確認信箱存在或 SMTP 成功 |
| resend 429 / 2006 | cooldown | data.retryAfterSeconds 控制倒數 |
| resend 503 / 2008 | request-error | 保留 Email，依剩餘秒數提供稍後重試 |
| resend 400 / 1000 | request-error 的欄位錯誤變體 | 在 Email 欄位下呈現 error.email.messages |
| verify 200 / 1 | verify-success | 提供登入操作，不自動建立 Session |
| verify 400 / 2004 | verify-unavailable | 無效／到期／已使用共用一種畫面 |
| verify 500 或網路失敗 | verify-request-error | 可重試，不宣稱連結已過期 |

既有 request-error manifest 應在 Figma / Vue 中保留「欄位錯誤、冷卻中的服務失敗、網路失敗」差異，不能把 503 的倒數丟掉。無 token 頁面由前端直接顯示 unavailable。頁面重新整理、瀏覽器返回或跨分頁完成驗證也需保留登入入口。

目前仍待前端實作 service functions、路由、狀態分流、暫存／倒數與 i18n；Google 登入、忘記密碼目前只有按鈕外觀，審查時需決定首版隱藏或明示尚未開放。Workspace／Board 等全站缺口見 [設計前功能盤點](feature-readiness.md)。

## 審查與交付階段

1. 本提案審查：確認頁面、狀態、文案、重寄規則與額外功能範圍。
2. 核准後：產生 SVG、更新 design/README 的 Current manifest，執行現有 audit-svg-pages 腳本並檢查畫面。
3. 更新既有 Plugin components / screens，完成 typecheck、build、可見版本標記。
4. 在既有 Figma 檔案執行 Generate All，檢查畫面、instance、Auto Layout，連續重跑確認不累積重複節點。
5. 依 Figma 與現有 contract 開發前端；後端已啟用未驗證登入限制。
6. 驗收註冊、未驗證登入、跨裝置驗證、重寄冷卻、連結不可用、暫時錯誤與手機版流程。

目前只進行第 1 階段。核准前不生成 SVG、不修改 Figma、不開發前端功能。

## 請使用者審查的決策

- 兩頁架構是否接受：重寄整合在 /auth/check-email？
- 等待文案採「請查看你的信箱」，還是加入實際寄送狀態追蹤後顯示「驗證信已寄出」？
- 重寄冷卻建議 60 秒；舊信在各自期限內仍有效，帳號驗證後不重寫時間，是否接受？
- 驗證成功由使用者按「前往登入」，不自動登入；目前不做輪詢，是否接受？
- 本輪涵蓋驗證信完整流程；真正修改帳號 Email、忘記密碼、Google 登入是否維持另案？
