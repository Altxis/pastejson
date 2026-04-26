import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShareModule } from './share/share.module';

// Frontend is served by Vercel — this server is API-only.
@Module({
  imports: [ShareModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
