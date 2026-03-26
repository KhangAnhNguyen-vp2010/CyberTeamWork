import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { oauthService } from "../../../services/oauthService";
import type { OAuthUserResponse } from "../../../config/oauth";

export function useSocialLogin() {
  const [loading, setLoading] = useState(false);

  // Handle OAuth callbacks on component mount
  useEffect(() => {
    // Skip callback handling - được xử lý bởi dedicated route /auth/google/callback
    return;
    
    const handleCallback = async () => {
      if (oauthService.isCallback()) {
        const params = oauthService.getCallbackParams();
        if (params) {
          setLoading(true);
          try {
            // Handle Google callback
            const result = await oauthService.handleGoogleCallback(
              params.code,
              params.state
            );

            if (result.success && result.user) {
              // TODO: Handle successful login (redirect, store user data, etc.)
              console.log("OAuth login successful:", result.user);
            } else {
              toast.error(result.error || "Đăng nhập thất bại!");
            }
          } catch (error) {
            console.error("OAuth callback error:", error);
            toast.error("Lỗi xử lý đăng nhập!");
          } finally {
            setLoading(false);
            // Clean up URL
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
        }
      }
    };

    handleCallback();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await oauthService.initiateGoogleLogin();
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Lỗi đăng nhập Google!");
      setLoading(false);
    }
  };

  return {
    handleGoogleLogin,
    loading,
  };
}
