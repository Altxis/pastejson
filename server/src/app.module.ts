import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShareModule } from './share/share.module';
import { ProxyModule } from './proxy/proxy.module';

// Frontend is served by Vercel — this server is API-only.
@Module({
  imports: [ShareModule, ProxyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
