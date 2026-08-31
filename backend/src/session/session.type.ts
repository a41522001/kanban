/** 舊版 Session 資料結構，待 Session 重構完成後移除。 */
export type Session = {
  /** Session 所屬的使用者 ID。 */
  userId: string;

  /** Session 建立時間的 ISO 8601 字串。 */
  createdAt: string;
};

/** Current Session 與 Grace Session 共用的基礎資料。 */
export type SessionBase = {
  /** Session 所屬的使用者 ID。 */
  userId: string;

  /**
   * 同一個裝置登入家族的 ID。
   * Session 輪轉後仍會保持相同的 familyId。
   */
  familyId: string;

  /**
   * Session 家族的輪轉世代。
   * 首次登入為 1，每次輪轉加 1。
   */
  generation: number;

  /**
   * Session 家族首次建立的時間。
   * 使用 Unix epoch 絕對毫秒。
   */
  familyCreatedAtMs: number;

  /**
   * 這一代 Session token 的簽發時間。
   * 使用 Unix epoch 絕對毫秒。
   */
  tokenIssuedAtMs: number;
};

/** 目前有效且可以進行輪轉的 Session。 */
export type CurrentSession = SessionBase & {
  /** Session 目前處於正常使用狀態。 */
  state: 'current';

  /**
   * Session 開始允許輪轉的時間。
   * 使用 Unix epoch 絕對毫秒。
   */
  rotateAtMs: number;

  /**
   * Current Session 的過期時間。
   * 使用 Unix epoch 絕對毫秒，並對應 Redis Hash 的 PEXPIREAT。
   */
  expiresAtMs: number;

  /**
   * 上一代 Grace Session ID 的 SHA-256 hash。
   * 輪轉產生的 Current Session 才會有這個欄位。
   */
  previousSessionIdHash?: string;
};

/** 輪轉後暫時保留，供併發請求繼續驗證的舊 Session。 */
export type GraceSession = SessionBase & {
  /** Session 目前處於短暫寬限狀態，不能再次輪轉。 */
  state: 'grace';
};

/** Redis Session Hash 解析後可能得到的 Session 型別。 */
export type StoredSession = CurrentSession | GraceSession;

export type AuthenticateSessionResult = {
  userId: string;
  rotatedSessionId?: string;
};
