import { Controller, Get, Patch, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { User } from './entities/user.entity';

@ApiTags('Usuários')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar perfil' })
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Listar todos os usuários (Admin)' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(+page, +limit);
  }
}
