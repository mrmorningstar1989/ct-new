// Sensitive features stay off unless explicitly enabled at build time.
export const biometricFeatureEnabled = process.env.REACT_APP_BIOMETRIC_FEATURE_ENABLED === "true";
