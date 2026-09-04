export const en = {
  brand: {
    name: 'Flowboard',
    tagline: 'FLOWBOARD / REAL-TIME COLLABORATION',
  },
  alert: {
    title: 'System message',
  },
  userMenu: {
    open: 'Open account menu',
    accountSettings: 'Account settings',
    logout: 'Sign out',
    loggingOut: 'Signing out…',
  },
  workplace: {
    navigation: {
      label: 'Primary navigation',
      workspaces: 'Workspaces',
      recent: 'Recent',
    },
    sidebar: {
      label: 'Workspace sidebar',
      yourWorkspaces: 'Your workspaces',
      management: 'Workspace management',
      members: 'Members',
      archivedProjects: 'Archived projects',
      workspaceMembers: 'Workspace members',
      memberSummary: '{count} members are moving work forward together',
    },
    mobile: {
      currentWorkspace: 'Current workspace',
      selectWorkspace: 'Select workspace',
    },
    roles: {
      owner: 'Owner',
      member: 'Member',
    },
    eyebrow: 'Workspace',
    description: 'See every project in one place, then choose one to enter its main board.',
    projects: {
      title: 'All projects',
      sortHint: 'Sorted by most recently updated',
    },
    actions: {
      createWorkspace: 'New workspace',
      createProject: 'New project',
      create: 'Create workspace',
      cancel: 'Cancel',
      retry: 'Try again',
    },
    dialog: {
      title: 'Create a new workspace',
      description: 'A workspace can start with just you. Invite people when you are ready.',
      nameLabel: 'Workspace name',
      namePlaceholder: 'For example: Product team',
    },
    validation: {
      nameRequired: 'Enter a workspace name',
      nameMaxLength: 'Workspace name must be {count} characters or fewer',
    },
    states: {
      loadErrorTitle: 'Unable to load workspaces',
      loadErrorDescription: 'Check your connection and try again.',
      noWorkspaceTitle: 'Start with your first workspace',
      noWorkspaceDescription: 'Create a workspace to organize projects and boards in one place.',
      noProjectsTitle: 'Your projects will appear here',
      projectApiPending:
        'Projects are being built. You will be able to create and open them here soon.',
    },
  },
  auth: {
    sidebar: {
      login: {
        titleLineOne: 'Don’t just sync messages.',
        titleLineTwo: 'Sync the next step.',
        description:
          'Break work into actionable pieces so everyone can see where the flow is going.',
      },
      signup: {
        titleLineOne: 'Start with one card.',
        titleLineTwo: 'Build your rhythm.',
        description: 'Create a workspace, then invite your team to move work forward together.',
      },
      timeline: {
        setup: {
          title: 'Set up your board',
          description: 'Break goals into the next action you can complete.',
        },
        sync: {
          title: 'Keep changes in sync',
          description: 'Notify your team whenever a card changes.',
        },
        progress: {
          title: 'Move work forward',
          description: 'Everyone knows what to do next.',
        },
      },
    },
    fields: {
      name: {
        label: 'Display name',
        placeholder: 'For example: Jeffery',
      },
      email: {
        label: 'Email address',
        placeholder: "you{'@'}example.com",
      },
      password: {
        label: 'Password',
        placeholder: 'At least 8 characters',
      },
      confirmPassword: {
        label: 'Confirm password',
        placeholder: 'Enter your password again',
      },
    },
    common: {
      divider: 'or',
      googleContinue: 'Continue with Google',
      googleSignIn: 'Sign in with Google',
      googleLogo: 'Google logo',
    },
    login: {
      eyebrow: 'Sign in to your workspace',
      title: 'Return to the work in progress',
      description: 'Enter your details to pick up where you left off.',
      forgotPassword: 'Forgot password?',
      submit: 'Sign in to Flowboard',
      submitting: 'Signing in…',
      noAccount: 'New to Flowboard?',
      createAccount: 'Create an account',
    },
    signup: {
      eyebrow: 'Create an account',
      title: 'Start your workspace',
      description: 'It only takes a minute. You can invite your team afterwards.',
      agreeToPolicy: 'I agree to the Terms of Service and Privacy Policy',
      submit: 'Create workspace',
      submitting: 'Creating your account…',
      hasAccount: 'Already have an account?',
      signIn: 'Back to sign in',
    },
  },
  validation: {
    required: 'This field is required',
    email: 'Enter a valid email address',
    displayNameMaxLength: 'Display name must be 100 characters or fewer',
    emailMaxLength: 'Email address must be 320 characters or fewer',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordMaxLength: 'Password must be 72 characters or fewer',
    passwordMismatch: 'Passwords do not match',
    policyRequired: 'Please agree to the Terms of Service and Privacy Policy',
  },
  error: {
    invalidCredentials: 'Incorrect email address or password',
    requestFailed: 'Unable to complete the request. Please try again.',
  },
};
