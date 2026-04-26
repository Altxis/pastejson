import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ShareController],
  providers: [ShareService, PrismaService],
})
export class ShareModule {}
