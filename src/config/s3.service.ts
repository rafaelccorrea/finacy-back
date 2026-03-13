import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  mimeType: string;
  originalName: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /**
   * Faz upload de um arquivo para o S3
   * @param file Buffer do arquivo
   * @param folder Pasta de destino (ex: 'documents/cnh', 'documents/cpf')
   * @param originalName Nome original do arquivo
   * @param mimeType Tipo MIME do arquivo
   * @param userId ID do usuário (para organizar por pasta)
   */
  async uploadFile(
    file: Buffer,
    folder: string,
    originalName: string,
    mimeType: string,
    userId: string,
  ): Promise<UploadResult> {
    const fileExtension = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueKey = `${folder}/${userId}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: uniqueKey,
      Body: file,
      ContentType: mimeType,
      ContentDisposition: `inline; filename="${originalName}"`,
      Metadata: {
        userId,
        originalName,
        uploadedAt: new Date().toISOString(),
      },
      // Garantir que o arquivo seja privado por padrão
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);

    this.logger.log(`Arquivo enviado para S3: ${uniqueKey} (${file.length} bytes)`);

    return {
      key: uniqueKey,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${uniqueKey}`,
      bucket: this.bucket,
      size: file.length,
      mimeType,
      originalName,
    };
  }

  /**
   * Gera uma URL pré-assinada para acesso temporário ao arquivo
   * @param key Chave do arquivo no S3
   * @param expiresInSeconds Tempo de expiração em segundos (padrão: 1 hora)
   */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return signedUrl;
  }

  /**
   * Verifica se um arquivo existe no S3
   * @param key Chave do arquivo no S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove um arquivo do S3
   * @param key Chave do arquivo no S3
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.log(`Arquivo removido do S3: ${key}`);
  }
}
