// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';

export interface RequestLog {
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  statusCode?: number;
  responseTime?: number;
  timestamp: string;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly excludeRoutes = ['/health', '/metrics', '/api/v1/docs'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const url = this.sanitizeUrl(request.originalUrl || request.url);

    if (this.shouldExcludeRoute(url)) {
      return next.handle();
    }

    const startTime = Date.now();
    const baseLog: RequestLog = {
      method,
      url,
      ip: this.getClientIp(request),
      userAgent: request.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📥 ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        // apenas placeholder para casos onde queremos interceptar o "sucesso"
      }),
      finalize(() => {
        const statusCode = response.statusCode;
        const responseTime = Date.now() - startTime;
        const statusIcon = this.getStatusColor(statusCode);

        this.logger.log(
          `📤 ${statusIcon} ${method} ${url} [${statusCode}] - ${responseTime}ms`,
        );

        if (responseTime > 1000) {
          this.logger.warn(
            `⚠️ Resposta lenta: ${method} ${url} levou ${responseTime}ms`,
          );
        }
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;

        this.logger.error(
          `❌ ${method} ${url} [${statusCode}] - ${responseTime}ms - ${error.message}`,
        );

        return throwError(() => error);
      }),
    );
  }

  private getClientIp(request: Request): string {
    // Requer app.set('trust proxy', 1) no main.ts para funcionar atrás de proxy
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private shouldExcludeRoute(url: string): boolean {
    return this.excludeRoutes.some((route) => url.startsWith(route));
  }

  private getStatusColor(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '✅';
    if (statusCode >= 300 && statusCode < 400) return '🔄';
    if (statusCode >= 400 && statusCode < 500) return '⚠️';
    return '❌';
  }

  private sanitizeUrl(url: string): string {
    return url.replace(
      /([?&])(token|senha|password|api[_-]?key|secret|access_token)=[^&]*/gi,
      '$1$2=***',
    );
  }
}