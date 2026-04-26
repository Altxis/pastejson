import {
  Controller,
  Get,
  Query,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const TIMEOUT_MS = 30_000; // 30 s

@Controller('proxy')
export class ProxyController {
  @Get()
  async proxyFetch(@Query('url') url: string) {
    if (!url) throw new BadRequestException('url query param is required');

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only http and https URLs are supported');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain, */*' },
      });
    } catch (e: unknown) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpException(
        `Could not reach ${parsed.hostname}: ${msg}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    clearTimeout(timer);

    if (!res.ok) {
      throw new HttpException(
        `Remote returned ${res.status} ${res.statusText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Reject oversized responses early via Content-Length
    const cl = res.headers.get('content-length');
    if (cl && Number(cl) > MAX_BYTES) {
      throw new HttpException('Response too large (max 50 MB)', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    // Stream body and enforce size cap
    const reader = res.body?.getReader();
    if (!reader) throw new HttpException('Empty response body', HttpStatus.BAD_GATEWAY);

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        reader.cancel().catch(() => {});
        throw new HttpException('Response too large (max 50 MB)', HttpStatus.PAYLOAD_TOO_LARGE);
      }
      chunks.push(value);
    }

    const raw = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    const contentType = res.headers.get('content-type') ?? '';

    return { raw, contentType, status: res.status };
  }
}
