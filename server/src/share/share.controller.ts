import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { raw: string }) {
    return this.shareService.create(body.raw);
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.shareService.find(id);
  }
}
