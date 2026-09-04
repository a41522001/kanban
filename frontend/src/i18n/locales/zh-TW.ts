export const zhTW = {
  brand: {
    name: 'Flowboard',
    tagline: 'FLOWBOARD / REAL-TIME COLLABORATION',
  },
  alert: {
    title: '系統提示',
  },
  userMenu: {
    open: '開啟帳號選單',
    accountSettings: '帳號設定',
    logout: '登出',
    loggingOut: '登出中…',
  },
  workplace: {
    navigation: {
      label: '主要導覽',
      workspaces: '工作區',
      recent: '最近',
    },
    sidebar: {
      label: '工作區側欄',
      yourWorkspaces: '你的工作區',
      management: '工作區管理',
      members: '成員',
      archivedProjects: '已封存專案',
      workspaceMembers: '工作區成員',
      memberSummary: '{count} 位成員正在一起推進工作',
    },
    mobile: {
      currentWorkspace: '目前工作區',
      selectWorkspace: '選擇工作區',
    },
    roles: {
      owner: '擁有者',
      member: '成員',
    },
    eyebrow: '工作區',
    description: '集中查看所有專案，選一個進入主要看板。',
    projects: {
      title: '所有專案',
      sortHint: '依最近更新排序',
    },
    actions: {
      createWorkspace: '新增工作區',
      createProject: '新增專案',
      create: '建立工作區',
      cancel: '取消',
      retry: '重新載入',
    },
    dialog: {
      title: '建立新的工作區',
      description: '工作區可以先從你一個人開始，之後再邀請成員加入。',
      nameLabel: '工作區名稱',
      namePlaceholder: '例如：產品開發團隊',
    },
    validation: {
      nameRequired: '請輸入工作區名稱',
      nameMaxLength: '工作區名稱不可超過 {count} 個字元',
    },
    states: {
      loadErrorTitle: '暫時無法載入工作區',
      loadErrorDescription: '請檢查連線後再試一次。',
      noWorkspaceTitle: '從第一個工作區開始',
      noWorkspaceDescription: '建立工作區後，就能集中管理專案與看板。',
      noProjectsTitle: '專案會在這裡出現',
      projectApiPending: '專案功能正在建立中，完成後就能從這裡新增與開啟專案。',
    },
  },
  auth: {
    sidebar: {
      login: {
        titleLineOne: '不只同步訊息，',
        titleLineTwo: '也同步下一步。',
        description: '把工作切成能推進的小塊，讓每個人看見流程正在往哪裡走。',
      },
      signup: {
        titleLineOne: '從第一張卡片，',
        titleLineTwo: '開始建立節奏。',
        description: '建立工作區，再邀請團隊一起把工作往前推。',
      },
      timeline: {
        setup: {
          title: '設定看板',
          description: '把目標切成下一個可完成的行動。',
        },
        sync: {
          title: '同步變更',
          description: '任何卡片異動，都能即時通知團隊。',
        },
        progress: {
          title: '推進完成',
          description: '每個人都知道現在應該做什麼。',
        },
      },
    },
    fields: {
      name: {
        label: '顯示名稱',
        placeholder: '例如：Jeffery',
      },
      email: {
        label: '電子郵件',
        placeholder: "you{'@'}example.com",
      },
      password: {
        label: '密碼',
        placeholder: '至少 8 個字元',
      },
      confirmPassword: {
        label: '確認密碼',
        placeholder: '再次輸入密碼',
      },
    },
    common: {
      divider: '或',
      googleContinue: '使用 Google 繼續',
      googleSignIn: '使用 Google 登入',
      googleLogo: 'Google 標誌',
    },
    login: {
      eyebrow: '登入你的工作區',
      title: '回到正在推進的工作',
      description: '輸入帳號後，繼續上次停下的地方。',
      forgotPassword: '忘記密碼？',
      submit: '登入 Flowboard',
      submitting: '登入中…',
      noAccount: '第一次使用？',
      createAccount: '建立帳號',
    },
    signup: {
      eyebrow: '建立帳號',
      title: '開始你的工作區',
      description: '只需要一分鐘，之後可以再邀請成員。',
      agreeToPolicy: '我同意服務條款與隱私權政策',
      submit: '建立工作區',
      submitting: '建立帳號中…',
      hasAccount: '已經有帳號？',
      signIn: '返回登入',
    },
  },
  validation: {
    required: '此欄位為必填',
    email: '請輸入有效的電子郵件',
    displayNameMaxLength: '名稱不可超過 100 個字元',
    emailMaxLength: 'Email 長度不可超過 320 個字元',
    passwordMinLength: '密碼至少需要 8 個字元',
    passwordMaxLength: '密碼不可超過 72 個字元',
    passwordMismatch: '兩次輸入的密碼不一致',
    policyRequired: '請先同意服務條款與隱私權政策',
  },
  error: {
    invalidCredentials: '電子郵件或密碼錯誤',
    requestFailed: '目前無法完成請求，請稍後再試。',
  },
};
