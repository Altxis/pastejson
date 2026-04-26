import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import { randomBytes } from 'crypto';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  async create(raw: string): Promise<{ id: string; expiresAt: Date }> {
    const byteSize = Buffer.byteLength(raw, 'utf8');

    if (byteSize > MAX_BYTES) {
      throw new PayloadTooLargeException(
        `JSON is ${(byteSize / 1024 / 1024).toFixed(1)} MB — exceeds the 50 MB limit.`,
      );
    }

    const data = await gzipAsync(Buffer.from(raw, 'utf8'));
    const id = randomBytes(8).toString('base64url');
    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await this.prisma.snapshot.create({
      data: { id, data, byteSize, expiresAt },
    });

    return { id, expiresAt };
  }

  async find(
    id: string,
  ): Promise<{ raw: string; expiresAt: Date; byteSize: number }> {
    const snapshot = await this.prisma.snapshot.findUnique({ where: { id } });

    if (!snapshot || snapshot.expiresAt < new Date()) {
      // Clean up silently if expired
      if (snapshot) {
        this.prisma.snapshot.delete({ where: { id } }).catch(() => {});
      }
      throw new NotFoundException('Snapshot not found or expired');
    }

    const raw = (await gunzipAsync(snapshot.data)).toString('utf8');
    return { raw, expiresAt: snapshot.expiresAt, byteSize: snapshot.byteSize };
  }
}
