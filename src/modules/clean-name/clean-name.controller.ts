import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CleanNameService } from './clean-name.service';
import { CreateCleanNameRequestDto } from './dto/create-clean-name-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Permission } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { DocumentsService } from '../documents/documents.service';
import { DocumentType } from '../documents/entities/document.entity';

@ApiTags('Limpa Nome')
@Controller('clean-name')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CleanNameController {
  constructor(
    private readonly cleanNameService: CleanNameService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('request')
  @Permissions(Permission.CLEAN_NAME_REQUEST)
  @ApiOperation({ summary: 'Criar solicitacao de Limpa Nome' })
  @ApiResponse({ status: 201, description: 'Solicitacao criada com sucesso' })
  @ApiResponse({ status: 403, description: 'Sem assinatura ativa ou creditos insuficientes' })
  async createRequest(
    @CurrentUser() user: User,
    @Body() dto: CreateCleanNameRequestDto,
  ) {
    return this.cleanNameService.createRequest(user.id, dto);
  }

  @Post('upload-document')
  @Permissions(Permission.CLEAN_NAME_REQUEST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de documento de identificacao para Limpa Nome' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['cnh', 'cpf', 'rg'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documento enviado com sucesso' })
  async uploadDocument(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo e obrigatorio');
    }
    const validTypes = ['cnh', 'cpf', 'rg'];
    if (!validTypes.includes(documentType)) {
      throw new BadRequestException('Tipo de documento invalido. Use: cnh, cpf, rg');
    }
    return this.documentsService.uploadDocument(user.id, file, {
      documentType: documentType as DocumentType,
    });
  }

  @Get('requests')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Listar solicitacoes do usuario' })
  async getMyRequests(@CurrentUser() user: User) {
    return this.cleanNameService.getUserRequests(user.id);
  }

  @Get('requests/:id')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Detalhes de uma solicitacao' })
  async getRequest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cleanNameService.getRequestById(id, user.id);
  }

  @Get('stats')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Estatisticas de Limpa Nome do usuario' })
  async getStats(@CurrentUser() user: User) {
    return this.cleanNameService.getStats(user.id);
  }

  @Public()
  @Post('webhook/autentique')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Autentique - eventos de assinatura digital' })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso' })
  async handleAutentiqueWebhook(@Body() payload: any) {
    return this.cleanNameService.processAutentiqueWebhook(payload);
  }
}
