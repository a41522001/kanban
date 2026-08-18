export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PublicUser {
  email: string;
  displayName: string;
  avatarUrl: string | null;
}
