import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  // Disable the default body parser so we can set a 50 MB limit
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '50mb' }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: false,
  });
  app.setGlobalPrefix('api', { exclude: ['/health'] });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
