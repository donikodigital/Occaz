// backend/src/config/configuration.ts
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  otp: {
    hashPepper: process.env.OTP_HASH_PEPPER,
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS ?? '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? 'console',
  },
});
