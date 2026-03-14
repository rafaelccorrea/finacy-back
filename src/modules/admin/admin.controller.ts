import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, UserStatus } from '../../common/enums';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Métricas gerais do painel administrativo' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Listar todos os usuários com filtros' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers(page, limit, search, role, status);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalhes completos de um usuário' })
  async getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Alterar role de um usuário' })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Alterar status de um usuário' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    return this.adminService.updateUserStatus(id, status);
  }

  @Post('users/:id/credits')
  @ApiOperation({ summary: 'Adicionar créditos de Limpa Nome a um usuário' })
  async addCredits(
    @Param('id') id: string,
    @Body('credits', ParseIntPipe) credits: number,
  ) {
    return this.adminService.addCreditsToUser(id, credits);
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  @Get('subscriptions')
  @ApiOperation({ summary: 'Listar todas as assinaturas com filtros' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'planId', required: false })
  async getSubscriptions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('planId') planId?: string,
  ) {
    return this.adminService.getSubscriptions(page, limit, status, planId);
  }

  // ─── Payments ──────────────────────────────────────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'Listar todos os pagamentos com filtros' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  async getPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getPayments(page, limit, status, type);
  }

  // ─── Plans ─────────────────────────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'Listar todos os planos' })
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Atualizar um plano' })
  async updatePlan(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.adminService.updatePlan(id, data);
  }
}
