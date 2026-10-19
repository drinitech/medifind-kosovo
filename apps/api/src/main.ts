import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  configureApp(app, { swagger: config.get('NODE_ENV') !== 'production' || process.env.SWAGGER_ENABLED === 'true' });
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1 (docs: /api/docs)`, 'Bootstrap');
}

void bootstrap();
