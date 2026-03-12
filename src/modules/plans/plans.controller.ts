import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Planos')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar todos os planos ativos' })
  findAll() {
    return this.plansService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um plano' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar planos padrão (apenas super admin)' })
  seed() {
    return this.plansService.seed();
  }
}
