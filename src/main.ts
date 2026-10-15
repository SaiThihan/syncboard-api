import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PORT } from './common/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks(); // lets a restart close sockets and run the module cleanup
  await app.listen(PORT);
}
void bootstrap();
