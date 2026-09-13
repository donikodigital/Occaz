// backend/src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { patchBigIntJsonSerialization } from './common/utils/bigint-json.util';

async function bootstrap() {
  patchBigIntJsonSerialization();

  const app = await NestFactory.create(AppModule, {
    // 'debug' est bruyant en production ; ajusté par NODE_ENV si besoin.
    logger: ['log', 'warn', 'error'],
  });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  // CORS_ALLOWED_ORIGINS="https://admin.example.com,https://app.example.com"
  // Vide/non défini → tout est autorisé (pratique en dev ; JAMAIS souhaitable
  // en production avec `credentials: true`, d'où cette liste explicite).
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
  app.enableCors({
    origin: allowedOrigins ? allowedOrigins.split(',').map((origin) => origin.trim()) : true,
    credentials: true,
  });

  // whitelist: rejette tout champ non déclaré dans un DTO plutôt que de
  // l'ignorer silencieusement — évite qu'un champ oublié dans un DTO
  // passe discrètement jusqu'au service.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Plateforme de transport partagé — API')
    .setDescription(
      'API REST versionnée (Trajets, Envois, Paiements, Litiges...) — voir le cahier des charges pour le détail fonctionnel.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API démarrée sur http://localhost:${port}/api/v1 (docs: /api/docs)`);
}

bootstrap();
