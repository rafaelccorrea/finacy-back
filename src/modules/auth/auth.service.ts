import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { UserStatus, SubscriptionStatus } from '../../common/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: registerDto.email }, { cpf: registerDto.cpf }],
    });
    if (existingUser) {
      throw new ConflictException('E-mail ou CPF ja cadastrado.');
    }
    const user = this.userRepository.create({
      ...registerDto,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });
    await this.userRepository.save(user);
    const tokens = await this.generateTokens(user);
    const subscriptionInfo = await this.getSubscriptionInfo(user.id);
    return {
      user: this.sanitizeUser(user),
      ...subscriptionInfo,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas.');
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
      throw new UnauthorizedException('Credenciais invalidas.');
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
    const subscriptionInfo = await this.getSubscriptionInfo(user.id);
    return {
      user: this.sanitizeUser(user),
      ...subscriptionInfo,
      ...tokens,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }
    const subscriptionInfo = await this.getSubscriptionInfo(userId);
    return {
      user: this.sanitizeUser(user),
      ...subscriptionInfo,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Acesso negado.');
    }
    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Token de atualizacao invalido.');
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

  /**
   * Verifica se o usuario tem assinatura ativa (ACTIVE ou TRIALING)
   */
  private async getSubscriptionInfo(userId: string) {
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    return {
      hasActiveSubscription: !!activeSubscription,
      subscription: activeSubscription
        ? {
            id: activeSubscription.id,
            status: activeSubscription.status,
            planId: activeSubscription.planId,
            planName: activeSubscription.plan?.name || null,
            planSlug: activeSubscription.plan?.slug || null,
            currentPeriodEnd: activeSubscription.currentPeriodEnd,
            cleanNameCreditsUsed: activeSubscription.cleanNameCreditsUsed,
            cleanNameCreditsTotal: activeSubscription.cleanNameCreditsTotal,
          }
        : null,
    };
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
