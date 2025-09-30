import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: [
      'http://localhost:3001',    
      'null',                     
      'file://',                  
      'http://127.0.0.1:5500',    
      'http://localhost:5500',    
      'http://localhost:5173',    

    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log(`Configuración CORS actualizada para archivos locales`);
}
bootstrap();