import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SESSION_COOKIE } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function configureApp(app: INestApplication, options: { swagger?: boolean } = {}) {
  const config = app.get(ConfigService);
  const express = app as NestExpressApplication;

  express.set('trust proxy', config.get<number>('TRUST_PROXY') ?? 1);
  express.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  express.useBodyParser('json', { limit: '100kb' });

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties (mass-assignment protection)
      forbidNonWhitelisted: true, // …and reject requests that try
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());

  if (options.swagger) {
    const doc = new DocumentBuilder()
      .setTitle('MediFind Kosovo API')
      .setDescription(
        'Reported medicine availability at Kosovo pharmacies. Availability is reported by pharmacies and is not real-time confirmed stock.',
      )
      .setVersion('1.0')
      .addCookieAuth(SESSION_COOKIE)
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), {
      jsonDocumentUrl: 'api/docs-json',
    });
  }
  return app;
}
