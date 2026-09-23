// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = parseInt(process.env.PORT || '3001', 10);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: isProduction ? ['error', 'warn'] : ['error', 'warn', 'log', 'debug'],
  });

  // ─── Validação ────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: isProduction,
      transform: true,
      disableErrorMessages: isProduction,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── CORS ─────────────────────────────────────────────────────
  const corsOrigins = isProduction
    ? (process.env.CORS_ORIGIN || '').split(',').filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
      ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 204,
  });

  // ─── Prefixo global ──────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Swagger (só em dev) ─────────────────────────────────────
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('API BV Modas')
      .setDescription('API para Sistema de E-commerce BV Modas')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addTag('Auth', 'Autenticação')
      .addTag('Users', 'Usuários')
      .addTag('Produtos', 'Catálogo de produtos')
      .addTag('Carrinho', 'Carrinho de compras')
      .addTag('Pedidos', 'Gerenciamento de pedidos')
      .addTag('Notificacoes', 'Notificações')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
      },
    });
  }

  // ─── Listen ──────────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 BV Modas backend rodando na porta ${port}`);
  logger.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📦 Banco: ${process.env.DATABASE_URL ? '✅' : '❌'}`);
  logger.log(`📦 Redis: ${process.env.REDIS_HOST || process.env.REDIS_URL ? '✅' : '❌'}`);
  if (!isProduction) {
    logger.log(`📚 Swagger: http://localhost:${port}/api/v1/docs`);
  }
}

// ─── Retry com limite (3 tentativas) ─────────────────────────
let bootAttempts = 0;
const MAX_BOOT_ATTEMPTS = 3;

async function startWithRetry() {
  try {
    await bootstrap();
  } catch (error: any) {
    bootAttempts++;
    logger.error(`❌ Falha no bootstrap (tentativa ${bootAttempts}/${MAX_BOOT_ATTEMPTS}): ${error.message}`);
    if (error.stack && !process.env.NODE_ENV?.includes('production')) {
      logger.error(error.stack);
    }

    if (bootAttempts < MAX_BOOT_ATTEMPTS) {
      logger.warn(`🔄 Tentando novamente em 5s...`);
      setTimeout(startWithRetry, 5000);
    } else {
      logger.error(`💥 Bootstrap falhou após ${MAX_BOOT_ATTEMPTS} tentativas. Encerrando.`);
      process.exit(1);
    }
  }
}

startWithRetry();