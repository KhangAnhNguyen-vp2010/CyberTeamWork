// Helper function to get origin safely
const getOrigin = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000"; // Default for SSR
};

// Environment Configuration
export const ENV_CONFIG = {
  // Google OAuth
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI:
    import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
    `${getOrigin()}/auth/google/callback`,

  // Facebook OAuth
  FACEBOOK_APP_ID: import.meta.env.VITE_FACEBOOK_APP_ID || "",
  FACEBOOK_APP_SECRET: import.meta.env.VITE_FACEBOOK_APP_SECRET || "",
  FACEBOOK_REDIRECT_URI:
    import.meta.env.VITE_FACEBOOK_REDIRECT_URI ||
    `${getOrigin()}/auth/facebook/callback`,
};

// Validation
export const validateOAuthConfig = () => {
  const errors: string[] = [];

  if (!ENV_CONFIG.GOOGLE_CLIENT_ID) {
    errors.push("Google Client ID is required");
  }

  if (!ENV_CONFIG.FACEBOOK_APP_ID) {
    errors.push("Facebook App ID is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
