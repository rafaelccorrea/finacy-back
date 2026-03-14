import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  // Security Headers (crossOriginResourcePolicy: cross-origin para permitir CORS do frontend)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS - lê origens permitidas da variável de ambiente CORS_ORIGINS
  const corsOriginsEnv = configService.get<string>('CORS_ORIGINS', '');
  const allowedOrigins: string[] = corsOriginsEnv
    ? corsOriginsEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: Postman, mobile apps, SSR)
      if (!origin) return callback(null, true);

      // Se não houver origens configuradas, permite todas (fallback de desenvolvimento)
      if (allowedOrigins.length === 0) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS: origem não permitida — ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Class Serializer
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger Documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Finacy API')
      .setDescription('Plataforma de Gestão Financeira e Limpeza de Nome')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
      .addTag('Autenticação')
      .addTag('Usuários')
      .addTag('Planos')
      .addTag('Assinaturas')
      .addTag('Pagamentos')
      .addTag('Limpa Nome')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Finacy API Docs',
    });
  }

  await app.listen(port);
  console.log(`🚀 Finacy API rodando em http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger disponível em http://localhost:${port}/api/docs`);
  console.log(`🔒 CORS origens permitidas: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'todas (fallback)'}`);
}

bootstrap();
