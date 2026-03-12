import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus, DocumentType } from './entities/document.entity';
import { S3Service } from '../../config/s3.service';
import { UploadDocumentDto, ReviewDocumentDto } from './dto/upload-document.dto';

// Tipos MIME permitidos para upload de documentos
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// Tamanho máximo de arquivo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Faz upload de um documento para o S3 e salva no banco
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ): Promise<Document> {
    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Tipos aceitos: JPEG, PNG, WEBP, PDF`,
      );
    }

    // Validar tamanho do arquivo
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Arquivo muito grande. Tamanho máximo: 10MB`,
      );
    }

    // Verificar se já existe documento pendente do mesmo tipo
    const existingPending = await this.documentRepository.findOne({
      where: {
        userId,
        documentType: dto.documentType,
        status: DocumentStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        `Já existe um documento do tipo ${dto.documentType} aguardando análise`,
      );
    }

    // Fazer upload para S3
    const folder = `documents/${dto.documentType}`;
    const uploadResult = await this.s3Service.uploadFile(
      file.buffer,
      folder,
      file.originalname,
      file.mimetype,
      userId,
    );

    // Salvar no banco de dados
    const document = this.documentRepository.create({
      userId,
      documentType: dto.documentType,
      originalName: file.originalname,
      s3Key: uploadResult.key,
      s3Bucket: uploadResult.bucket,
      mimeType: file.mimetype,
      fileSize: file.size,
      status: DocumentStatus.PENDING,
    });

    const saved = await this.documentRepository.save(document);
    this.logger.log(`Documento enviado: ${saved.id} (${dto.documentType}) por usuário ${userId}`);

    return saved;
  }

  /**
   * Lista todos os documentos de um usuário
   */
  async findUserDocuments(userId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Busca um documento específico do usuário
   */
  async findOne(id: string, userId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Documento ${id} não encontrado`);
    }

    // Verificar se o documento pertence ao usuário (ou se é admin)
    if (document.userId !== userId) {
      throw new ForbiddenException('Acesso negado a este documento');
    }

    return document;
  }

  /**
   * Gera URL pré-assinada para visualização temporária do documento
   */
  async getDocumentUrl(id: string, userId: string): Promise<{ url: string; expiresIn: number }> {
    const document = await this.findOne(id, userId);

    const url = await this.s3Service.getSignedUrl(document.s3Key, 3600); // 1 hora

    return { url, expiresIn: 3600 };
  }

  /**
   * Revisa um documento (admin)
   */
  async reviewDocument(
    id: string,
    reviewerId: string,
    dto: ReviewDocumentDto,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Documento ${id} não encontrado`);
    }

    if (document.status !== DocumentStatus.PENDING && document.status !== DocumentStatus.ANALYZING) {
      throw new BadRequestException(
        `Documento já foi revisado com status: ${document.status}`,
      );
    }

    if (dto.decision === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('Motivo da rejeição é obrigatório');
    }

    document.status = dto.decision === 'approved'
      ? DocumentStatus.APPROVED
      : DocumentStatus.REJECTED;
    document.reviewedBy = reviewerId;
    document.reviewedAt = new Date();
    document.rejectionReason = dto.rejectionReason;

    const updated = await this.documentRepository.save(document);
    this.logger.log(`Documento ${id} ${dto.decision} por ${reviewerId}`);

    return updated;
  }

  /**
   * Remove um documento (soft delete - remove do banco e do S3)
   */
  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.findOne(id, userId);

    // Só pode deletar documentos pendentes ou rejeitados
    if (
      document.status === DocumentStatus.APPROVED ||
      document.status === DocumentStatus.ANALYZING
    ) {
      throw new BadRequestException(
        'Não é possível remover um documento aprovado ou em análise',
      );
    }

    // Remover do S3
    await this.s3Service.deleteFile(document.s3Key);

    // Remover do banco
    await this.documentRepository.remove(document);
    this.logger.log(`Documento ${id} removido por usuário ${userId}`);
  }

  /**
   * Lista todos os documentos (admin) com filtros
   */
  async findAll(filters: {
    status?: DocumentStatus;
    documentType?: DocumentType;
    userId?: string;
  }): Promise<Document[]> {
    const query = this.documentRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.user', 'user')
      .orderBy('doc.createdAt', 'DESC');

    if (filters.status) {
      query.andWhere('doc.status = :status', { status: filters.status });
    }

    if (filters.documentType) {
      query.andWhere('doc.documentType = :type', { type: filters.documentType });
    }

    if (filters.userId) {
      query.andWhere('doc.userId = :userId', { userId: filters.userId });
    }

    return query.getMany();
  }

  /**
   * Retorna estatísticas de documentos do usuário
   */
  async getUserDocumentStats(userId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byType: Record<string, number>;
  }> {
    const documents = await this.findUserDocuments(userId);

    const byType: Record<string, number> = {};
    documents.forEach(doc => {
      byType[doc.documentType] = (byType[doc.documentType] || 0) + 1;
    });

    return {
      total: documents.length,
      pending: documents.filter(d => d.status === DocumentStatus.PENDING).length,
      approved: documents.filter(d => d.status === DocumentStatus.APPROVED).length,
      rejected: documents.filter(d => d.status === DocumentStatus.REJECTED).length,
      byType,
    };
  }
}
