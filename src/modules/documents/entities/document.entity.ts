import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DocumentType {
  CNH = 'cnh',
  CPF = 'cpf',
  RG = 'rg',
  COMPROVANTE_RESIDENCIA = 'comprovante_residencia',
  CONTRATO = 'contrato',
  OUTRO = 'outro',
}

export enum DocumentStatus {
  PENDING = 'pending',       // Aguardando análise
  ANALYZING = 'analyzing',   // Em análise
  APPROVED = 'approved',     // Aprovado
  REJECTED = 'rejected',     // Rejeitado
  EXPIRED = 'expired',       // Expirado
}

@Entity('documents')
@Index(['userId', 'documentType'])
@Index(['status'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 's3_bucket' })
  s3Bucket: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ nullable: true, name: 'rejection_reason' })
  rejectionReason?: string;

  @Column({ nullable: true, name: 'reviewed_by' })
  reviewedBy?: string;

  @Column({ nullable: true, name: 'reviewed_at', type: 'timestamp' })
  reviewedAt?: Date;

  @Column({ nullable: true, name: 'expires_at', type: 'timestamp' })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
