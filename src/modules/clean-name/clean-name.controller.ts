import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CleanNameService } from './clean-name.service';
import { CreateCleanNameRequestDto } from './dto/create-clean-name-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Limpa Nome')
@Controller('clean-name')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CleanNameController {
  constructor(private readonly cleanNameService: CleanNameService) {}

  @Post('request')
  @Permissions(Permission.CLEAN_NAME_REQUEST)
  @ApiOperation({ summary: 'Criar solicitação de Limpa Nome' })
  @ApiResponse({ status: 201, description: 'Solicitação criada com sucesso' })
  @ApiResponse({ status: 403, description: 'Sem assinatura ativa ou créditos insuficientes' })
  async createRequest(
    @CurrentUser() user: User,
    @Body() dto: CreateCleanNameRequestDto,
  ) {
    return this.cleanNameService.createRequest(user.id, dto);
  }

  @Get('requests')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Listar solicitações do usuário' })
  async getMyRequests(@CurrentUser() user: User) {
    return this.cleanNameService.getUserRequests(user.id);
  }

  @Get('requests/:id')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Detalhes de uma solicitação' })
  async getRequest(@CurrentUser() user: User, @Param('id') id: string) {
    return this.cleanNameService.getRequestById(id, user.id);
  }

  @Get('stats')
  @Permissions(Permission.CLEAN_NAME_VIEW)
  @ApiOperation({ summary: 'Estatísticas de Limpa Nome do usuário' })
  async getStats(@CurrentUser() user: User) {
    return this.cleanNameService.getStats(user.id);
  }
}
