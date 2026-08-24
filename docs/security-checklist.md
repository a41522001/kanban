# Security Checklist

## 1. 使用方式

這份文件是開發與上線前的安全檢查表。每個項目必須標記完成、接受風險或建立後續工作，不應只在部署當天快速掃過。

## 2. Authentication 與 Session

- [ ] Password 只保存 bcrypt hash，不保存或記錄明文。
- [ ] 限制並驗證 password 長度；注意 bcrypt 只處理前 72 bytes。
- [ ] Login 與 signup 有 rate limit，並考慮 IP 與帳號兩個維度。
- [ ] Login 失敗回應不洩漏帳號是否存在。
- [ ] 成功登入後 rotation Session ID，避免 session fixation。
- [ ] Logout 刪除 server-side Session，並清除 Cookie。
- [ ] Session 有 idle timeout 與 absolute expiration。
- [ ] Redis Session value 只保存必要資訊。
- [ ] 變更密碼後可撤銷既有 Session。

## 3. Cookie、CORS 與 CSRF

- [ ] Cookie 啟用 HttpOnly。
- [ ] Production Cookie 啟用 Secure。
- [ ] SameSite 根據同站或跨站部署模式明確設定。
- [ ] Cookie Path、Domain 與 Max-Age 使用最小必要範圍。
- [ ] CORS origin 使用 allowlist，不以星號搭配 credentials。
- [ ] 若使用跨站 Cookie，所有 mutation API 有 CSRF token 或等價防護。
- [ ] HTTP 與 Socket.IO 使用一致的 Origin 與 credentials 策略。

## 4. Validation 與輸入處理

- [ ] Global ValidationPipe 啟用 whitelist、transform、forbidNonWhitelisted。
- [ ] DTO 對 email、password、UUID、字串長度與必要欄位有明確限制。
- [ ] Nested DTO 使用 ValidateNested 與 Type。
- [ ] 不直接把 request body 傳給 Prisma，避免 mass assignment。
- [ ] 檔案、URL、富文字與 Markdown 等輸入另做類型專用驗證。
- [ ] Validation error 的 value 經過遮蔽，不回傳 password、token 等敏感值。
- [ ] 對大型 payload 設定 body size limit。

## 5. Authorization 與資源隔離

- [ ] 每次資源操作都從 Session 取得 userId。
- [ ] 查詢 Board、Column、Card 時透過 `Board → Project → ProjectMember` 驗證權限，避免 BOLA/IDOR。
- [ ] 不能只依賴前端 route guard、Controller guard 或 Socket room。
- [ ] WorkspaceRole 與 ProjectRole 的權限集中定義並有測試。
- [ ] 修改、刪除與邀請成員等敏感操作有 audit log。
- [ ] 被移除的 ProjectMember 必須離開該 Project 的所有 Board rooms，既有 Socket 不能繼續修改資料。

## 6. API 與錯誤處理

- [ ] Production response 不回傳 stack trace、SQL、Prisma detail 或內部路徑。
- [ ] 錯誤有穩定 code，message 可調整但不作為前端邏輯依據。
- [ ] 401、403、404 的使用策略一致，避免洩漏不該知道的資源存在性。
- [ ] Global Exception Filter 能處理未知 exception 並回一致格式。
- [ ] 每個 request 有 requestId，可與 log 對照。
- [ ] Security headers 由 Helmet 或 reverse proxy 統一設定。

## 7. Socket.IO

- [ ] Handshake 驗證 Cookie 與 Session。
- [ ] 不信任 payload 中的 userId、role、board owner。
- [ ] join room 與每個 mutation event 都重新做 authorization。
- [ ] Event payload 有 validation 與大小限制。
- [ ] Event 有 rate limit 或基本節流策略。
- [ ] Ack 不暴露內部 exception。
- [ ] DB commit 前不 broadcast 成功事件。

## 8. Database 與 Redis

- [ ] Production DB 與 Redis 不直接暴露到公網。
- [ ] App 使用最小權限的 DB 帳號，不使用 PostgreSQL superuser。
- [ ] Production migration 使用受控 release step。
- [ ] Backup 加密並定期做 restore drill。
- [ ] Redis 啟用密碼或私有網路，並限制可用指令與存取來源。
- [ ] Foreign key、unique constraint 與 transaction 保護資料完整性。
- [ ] 敏感資料的 retention 與刪除政策有文件。

## 9. Secrets 與設定

- [ ] .env 已加入 .gitignore，repository 只提交 .env.example。
- [ ] CI/CD secrets 不寫入 image layer、artifact 或 log。
- [ ] Production secrets 與 development secrets 完全分離。
- [ ] Secret rotation 有操作流程，不依賴修改原始碼。
- [ ] 啟動時驗證必要環境變數，缺少時 fail fast。
- [ ] 不使用可預測或範例值作為 production Session secret。

## 10. Logging 與個資

- [ ] 不記錄 password、passwordHash、Cookie、Session ID、Authorization header。
- [ ] Email 等識別資料只在必要情境記錄，並考慮遮蔽或 hash。
- [ ] Structured log 有 level、timestamp、requestId、event、duration。
- [ ] Log retention、讀取權限與刪除週期明確。
- [ ] Authentication、authorization 與管理操作有安全事件 log。
- [ ] Log injection 字元與過長輸入受到限制。

## 11. Dependency、Container 與主機

- [ ] pnpm lockfile 提交版本控制，CI 使用 frozen lockfile。
- [ ] 定期執行 dependency audit 並處理高風險漏洞。
- [ ] Docker image 使用固定版本，不依賴 floating latest。
- [ ] Container 以 non-root user 執行。
- [ ] Image 不包含 .env、測試資料或 development dependencies。
- [ ] 只暴露 Nginx 對外 port，Backend、PostgreSQL、Redis 位於內部 network。
- [ ] VPS 啟用防火牆、SSH key、停用密碼登入並定期更新。
- [ ] TLS 憑證自動續期並監控失敗。

## 12. 上線前阻擋條件

以下任一項未完成時，不應公開上線：

- Production secrets 仍使用範例值或已提交 Git。
- Login 沒有 rate limit。
- Cookie、CORS、CSRF 策略未確定。
- Board/Card 存取沒有 server-side authorization。
- Database 或 Redis 直接暴露公網。
- 無可驗證的 PostgreSQL backup 與 restore 流程。
- Exception response 可能洩漏 stack trace 或資料庫細節。
