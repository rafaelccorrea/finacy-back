import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto, ReviewDocumentDto } from './dto/upload-document.dto';
import { DocumentStatus, DocumentType } from './entities/document.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Documentos')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ─── Upload de Documento ──────────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // Manter em memória para enviar ao S3
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de arquivo não permitido. Use: JPEG, PNG, WEBP ou PDF'), false);
        }
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload de documento',
    description: 'Envia um documento (CNH, CPF, RG, etc.) para o S3. Tipos aceitos: JPEG, PNG, WEBP, PDF. Tamanho máximo: 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo do documento (JPEG, PNG, WEBP ou PDF)',
        },
        documentType: {
          type: 'string',
          enum: Object.values(DocumentType),
          description: 'Tipo do documento',
          example: 'cnh',
        },
        notes: {
          type: 'string',
          description: 'Observações adicionais (opcional)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documento enviado com sucesso' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou tipo não permitido' })
  async uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(user.id, file, dto);
  }

  // ─── Listar Documentos do Usuário ─────────────────────────────────────────

  @Get('my')
  @ApiOperation({
    summary: 'Listar meus documentos',
    description: 'Retorna todos os documentos enviados pelo usuário autenticado',
  })
  @ApiResponse({ status: 200, description: 'Lista de documentos do usuário' })
  async getMyDocuments(@CurrentUser() user: any) {
    return this.documentsService.findUserDocuments(user.id);
  }

  // ─── Estatísticas de Documentos do Usuário ────────────────────────────────

  @Get('my/stats')
  @ApiOperation({
    summary: 'Estatísticas dos meus documentos',
    description: 'Retorna contagem de documentos por status e tipo',
  })
  async getMyDocumentStats(@CurrentUser() user: any) {
    return this.documentsService.getUserDocumentStats(user.id);
  }

  // ─── URL Pré-assinada para Visualização ───────────────────────────────────

  @Get(':id/url')
  @ApiOperation({
    summary: 'Obter URL temporária do documento',
    description: 'Gera uma URL pré-assinada válida por 1 hora para visualizar o documento no S3',
  })
  @ApiResponse({ status: 200, description: 'URL gerada com sucesso' })
  @ApiResponse({ status: 404, description: 'Documento não encontrado' })
  async getDocumentUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.getDocumentUrl(id, user.id);
  }

  // ─── Detalhes de um Documento ─────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhes de um documento',
    description: 'Retorna os detalhes de um documento específico do usuário',
  })
  @ApiResponse({ status: 200, description: 'Detalhes do documento' })
  @ApiResponse({ status: 404, description: 'Documento não encontrado' })
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.findOne(id, user.id);
  }

  // ─── Remover Documento ────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remover documento',
    description: 'Remove um documento pendente ou rejeitado do S3 e do banco de dados',
  })
  @ApiResponse({ status: 204, description: 'Documento removido com sucesso' })
  @ApiResponse({ status: 400, description: 'Não é possível remover documento aprovado ou em análise' })
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.deleteDocument(id, user.id);
  }

  // ─── Admin: Listar Todos os Documentos ────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[ADMIN] Listar todos os documentos',
    description: 'Lista todos os documentos com filtros opcionais. Requer role de admin.',
  })
  @ApiQuery({ name: 'status', enum: DocumentStatus, required: false })
  @ApiQuery({ name: 'documentType', enum: DocumentType, required: false })
  @ApiQuery({ name: 'userId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Lista de documentos' })
  async findAll(
    @Query('status') status?: DocumentStatus,
    @Query('documentType') documentType?: DocumentType,
    @Query('userId') userId?: string,
  ) {
    return this.documentsService.findAll({ status, documentType, userId });
  }

  // ─── Admin: Revisar Documento ─────────────────────────────────────────────

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[ADMIN] Revisar documento',
    description: 'Aprova ou rejeita um documento enviado pelo usuário. Requer role de admin.',
  })
  @ApiResponse({ status: 200, description: 'Documento revisado com sucesso' })
  @ApiResponse({ status: 400, description: 'Documento já revisado ou dados inválidos' })
  async reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() reviewer: any,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.documentsService.reviewDocument(id, reviewer.id, dto);
  }
}
