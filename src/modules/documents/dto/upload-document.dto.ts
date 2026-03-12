import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../entities/document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Tipo do documento a ser enviado',
    example: DocumentType.CNH,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description: 'Observações adicionais sobre o documento',
    example: 'CNH frente e verso',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewDocumentDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    description: 'Decisão da revisão',
    example: 'approved',
  })
  @IsEnum(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Motivo da rejeição (obrigatório se decision=rejected)',
    example: 'Documento ilegível ou fora de validade',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
