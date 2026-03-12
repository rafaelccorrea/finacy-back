import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../../common/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: registerDto.email }, { cpf: registerDto.cpf }],
    });

    if (existingUser) {
      throw new ConflictException('E-mail ou CPF já cadastrado.');
    }

    const user = this.userRepository.create({
      ...registerDto,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.isLocked()) {
      throw new UnauthorizedException(
        'Conta temporariamente bloqueada. Tente novamente em alguns minutos.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Conta suspensa. Entre em contato com o suporte.');
    }

    const isPasswordValid = await user.validatePassword(loginDto.password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    await this.userRepository.update(user.id, {
      loginAttempts: 0,
      lockedUntil: undefined,
      lastLoginAt: new Date(),
    });

    const tokens = await this.generateTokens(user);

    await this.userRepository.update(user.id, {
      refreshToken: tokens.refreshToken,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Acesso negado.');
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Token de atualização inválido.');
    }

    const tokens = await this.generateTokens(user);
    await this.userRepository.update(user.id, {
      refreshToken: tokens.refreshToken,
    });

    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: undefined });
    return { message: 'Logout realizado com sucesso.' };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtSecret = this.configService.get('JWT_SECRET') || 'fallback_secret_32chars_minimum';
    const jwtExpiresIn = this.configService.get('JWT_EXPIRES_IN') || '7d';
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET') || 'fallback_refresh_secret_32chars';
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d';

    const accessToken = await this.jwtService.signAsync(
      { ...payload },
      { secret: jwtSecret, expiresIn: jwtExpiresIn } as any,
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...payload },
      { secret: refreshSecret, expiresIn: refreshExpiresIn } as any,
    );

    return { accessToken, refreshToken };
  }

  private async handleFailedLogin(user: User) {
    const attempts = user.loginAttempts + 1;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);

      await this.userRepository.update(user.id, {
        loginAttempts: attempts,
        lockedUntil,
      });
    } else {
      await this.userRepository.update(user.id, {
        loginAttempts: attempts,
      });
    }
  }

  private sanitizeUser(user: User) {
    const { password, refreshToken, emailVerificationToken, passwordResetToken, ...sanitized } = user as any;
    return sanitized;
  }
}
