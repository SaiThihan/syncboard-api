import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CORS_ORIGIN } from './common/config';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';

// Shared by main.ts and the e2e tests so both run the same HTTP setup.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: CORS_ORIGIN });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
