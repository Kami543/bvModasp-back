// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';

function requiredInProd(key: string): string {
  const value = process.env[key];
  if (!value && isProduction) {
    throw new Error(`Variável de ambiente ${key} é obrigatória em produção`);
  }
  return value ?? '';
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
  jwtSecret: requiredInProd('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}));