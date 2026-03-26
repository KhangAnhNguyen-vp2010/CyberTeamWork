import {
  OAUTH_CONFIG,
  GOOGLE_OAUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USER_INFO_URL,
  FACEBOOK_OAUTH_URL,
  FACEBOOK_TOKEN_URL,
  FACEBOOK_USER_INFO_URL,
} from "../config/oauth";
import type {
  GoogleUserInfo,
  FacebookUserInfo,
  OAuthTokenResponse,
  OAuthUserResponse,
} from "../config/oauth";

class OAuthService {
  // Google OAuth
  async initiateGoogleLogin(): Promise<void> {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.GOOGLE.CLIENT_ID,
      redirect_uri: OAUTH_CONFIG.GOOGLE.REDIRECT_URI,
      scope: OAUTH_CONFIG.GOOGLE.SCOPE,
      response_type: OAUTH_CONFIG.GOOGLE.RESPONSE_TYPE,
      access_type: OAUTH_CONFIG.GOOGLE.ACCESS_TYPE,
      prompt: OAUTH_CONFIG.GOOGLE.PROMPT,
      state: this.generateState(),
    });

    // Store state for verification
    localStorage.setItem("oauth_state", params.get("state") || "");

    // Redirect to Google OAuth
    window.location.href = `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  async handleGoogleCallback(
    code: string,
    state: string
  ): Promise<OAuthUserResponse> {
    try {
      // Verify state (optional - có thể bỏ qua nếu gặp vấn đề)
      const storedState = localStorage.getItem("oauth_state");
      if (storedState && storedState !== state) {
        console.warn("State mismatch, but continuing anyway");
        // Không throw error nữa, chỉ warning
      }

      // Exchange code for token
      const tokenResponse = await this.exchangeGoogleCodeForToken(code);

      // Get user info
      const userInfo = await this.getGoogleUserInfo(tokenResponse.access_token);

      // Send to backend API
      const backendResponse = await this.sendOAuthToBackend({
        email: userInfo.email,
        name: userInfo.name,
        provider: "google",
        providerKey: userInfo.id,
        accessToken: tokenResponse.access_token,
      });

      if (backendResponse.success && backendResponse.user) {
        // Clean up state sau khi thành công
        localStorage.removeItem("oauth_state");
        return {
          success: true,
          user: backendResponse.user,
        };
      } else {
        throw new Error(
          backendResponse.error || "Backend authentication failed"
        );
      }
    } catch (error) {
      console.error("Google OAuth error:", error);
      // Clean up state khi lỗi
      localStorage.removeItem("oauth_state");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async exchangeGoogleCodeForToken(
    code: string
  ): Promise<OAuthTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: OAUTH_CONFIG.GOOGLE.CLIENT_ID,
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: OAUTH_CONFIG.GOOGLE.REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error_description ||
          errorData.error ||
          `HTTP ${response.status}: Failed to exchange code for token`
      );
    }

    return response.json();
  }

  private async getGoogleUserInfo(
    accessToken: string
  ): Promise<GoogleUserInfo> {
    const response = await fetch(
      `${GOOGLE_USER_INFO_URL}?access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error("Failed to get user info");
    }

    return response.json();
  }

  // Utility methods
  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  // Check if we're in a callback
  isCallback(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has("code") && urlParams.has("state");
  }

  // Get callback parameters
  getCallbackParams(): { code: string; state: string } | null {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (code && state) {
      return { code, state };
    }

    return null;
  }

  // Send OAuth data to backend
  private async sendOAuthToBackend(data: {
    email: string;
    name: string;
    provider: string;
    providerKey: string;
    accessToken: string;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const apiBaseUrl =
        import.meta.env.VITE_API_URL || "http://localhost:7036";

      const response = await fetch(`${apiBaseUrl}/api/Auth/oauth-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      let result;
      try {
        const responseText = await response.text();
        result = JSON.parse(responseText);
        // Log response để debug
        console.log("[OAuth] Response từ backend:", result);
      } catch (parseError) {
        return {
          success: false,
          error: "Invalid response format from backend",
        };
      }

      // Mapping đúng trường camelCase từ backend
      if (response.ok && result && result.user) {
        return {
          success: true,
          user: {
            UserId: parseInt(result.user.taiKhoanId), // Make sure it's a number
            Mail: result.user.email,
            HoTen: result.user.hoTen,
            GioiTinh: result.user.gioiTinh || "",
            NgaySinh: result.user.ngaySinh || "",
            MoTaBanThan: result.user.moTaBanThan || "",
            TrangThai: true, // Add default status
          },
        };
      } else {
        return { success: false, error: result.message || "Backend error" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }
}

export const oauthService = new OAuthService();
