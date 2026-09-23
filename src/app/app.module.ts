// src/app/app.module.ts
import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';

import { UserModule } from '../users/users.module';
import { ProdutoModule } from '../produto/produto.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { QueueModule } from '../queue/queue.module';
import { HealthModule } from '../health/health.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { UploadModule } from '../upload/upload.module';
import { MailModule } from '../mail/mail.module';

import redisConfig from '../config/redis.config';
import appConfig from '../config/app.config';
import supabaseConfig from '../config/supabase.config';   // ← ADICIONADO

const isProduction = process.env.NODE_ENV === 'production';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const hasRedis = !!(redisUrl || redisHost);

const getBullConfig = () => {
  if (redisUrl) {
    return {
      url: redisUrl,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 50,
        removeOnFail: 50,
        timeout: 15000,
      },
    };
  }

  if (redisHost) {
    const isUpstash = redisHost.includes('upstash');
    return {
      redis: {
        host: redisHost,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: isUpstash ? { rejectUnauthorized: false } : undefined,
        enableOfflineQueue: false,
        lazyConnect: true,
        connectTimeout: 8000,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => {
          if (times > 2) return null;
          return times * 500;
        },
      },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 50,
        removeOnFail: 50,
        timeout: 15000,
      },
    };
  }
  return null;
};

const bullConfig = getBullConfig();

const bullModules = bullConfig
  ? [
      BullModule.forRoot(bullConfig),
      BullModule.registerQueue(
        { name: 'payment' },
        { name: 'notification' },
        { name: 'email' },
        { name: 'fraud-check' },
        { name: 'order-processing' },
        { name: 'inventory' },
      ),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.prod', '.env.dev'],
      load: [redisConfig, appConfig, supabaseConfig],   // ← supabaseConfig incluído
      cache: true,
      expandVariables: true,
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    ...bullModules,

    PrismaModule,
    AuthModule,
    UserModule,
    ProdutoModule,
    CartModule,
    PedidosModule,
    NotificacoesModule,
    SupabaseModule,
    UploadModule,
    MailModule,

    ...(hasRedis && bullModules.length === 0
      ? [QueueModule.forRoot()]
      : []),

    ...(hasRedis ? [PagamentoModule] : []),

    ...(!isProduction ? [HealthModule] : []),
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit() {
    this.logger.log(`Ambiente: ${isProduction ? 'produção' : 'desenvolvimento'}`);
    this.logger.log(`Redis: ${hasRedis ? '✅' : '❌'}`);
    this.logger.log(`Bull (queues): ${bullModules.length > 0 ? '✅' : '❌'}`);
    this.logger.log(`Supabase: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  }
}