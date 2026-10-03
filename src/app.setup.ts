import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CORS_ORIGIN } from './common/config';
import { AppErrorFilter } from './common/errors/app-error.filter';

// Shared by main.ts and the e2e tests so both run the same HTTP setup.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: CORS_ORIGIN });
  app.useGlobalFilters(new AppErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
