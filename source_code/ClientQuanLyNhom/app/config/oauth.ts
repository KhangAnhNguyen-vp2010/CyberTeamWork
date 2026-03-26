import { ENV_CONFIG } from "./env";

// OAuth Configuration
export const OAUTH_CONFIG = {
  GOOGLE: {
    CLIENT_ID: ENV_CONFIG.GOOGLE_CLIENT_ID,
    REDIRECT_URI: ENV_CONFIG.GOOGLE_REDIRECT_URI,
    SCOPE: "openid email profile",
    RESPONSE_TYPE: "code",
    ACCESS_TYPE: "offline",
    PROMPT: "consent",
  },
  FACEBOOK: {
    APP_ID: ENV_CONFIG.FACEBOOK_APP_ID,
    REDIRECT_URI: ENV_CONFIG.FACEBOOK_REDIRECT_URI,
    SCOPE: "email,public_profile",
    RESPONSE_TYPE: "code",
  },
};

// Google OAuth URLs
export const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USER_INFO_URL =
  "https://www.googleapis.com/oauth2/v2/userinfo";

// Facebook OAuth URLs
export const FACEBOOK_OAUTH_URL = "https://www.facebook.com/v18.0/dialog/oauth";
export const FACEBOOK_TOKEN_URL =
  "https://graph.facebook.com/v18.0/oauth/access_token";
export const FACEBOOK_USER_INFO_URL = "https://graph.facebook.com/v18.0/me";

// OAuth Response Types
export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

export interface FacebookUserInfo {
  id: string;
  email: string;
  name: string;
  picture: {
    data: {
      url: string;
    };
  };
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface OAuthUserResponse {
  success: boolean;
  user?: {
    UserId: number;
    Mail: string;
    HoTen: string;
    GioiTinh?: string;
    NgaySinh?: string;
    MoTaBanThan?: string;
    // Có thể bổ sung các trường khác nếu backend trả về
  };
  error?: string;
}
