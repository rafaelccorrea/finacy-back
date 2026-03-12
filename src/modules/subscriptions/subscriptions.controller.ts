import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('Assinaturas')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  @Permissions(Permission.SUBSCRIPTIONS_VIEW)
  @ApiOperation({ summary: 'Assinatura ativa do usuário' })
  getCurrent(@CurrentUser() user: User) {
    return this.subscriptionsService.getUserSubscription(user.id);
  }

  @Get('history')
  @Permissions(Permission.SUBSCRIPTIONS_VIEW)
  @ApiOperation({ summary: 'Histórico de assinaturas' })
  getHistory(@CurrentUser() user: User) {
    return this.subscriptionsService.getUserSubscriptionHistory(user.id);
  }

  @Get(':id')
  @Permissions(Permission.SUBSCRIPTIONS_VIEW)
  @ApiOperation({ summary: 'Detalhes de uma assinatura' })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.subscriptionsService.getSubscriptionById(id, user.id);
  }

  @Get('stats/dashboard')
  @Permissions(Permission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Estatísticas para o dashboard' })
  getDashboardStats(@CurrentUser() user: User) {
    return this.subscriptionsService.getDashboardStats(user.id);
  }
}
