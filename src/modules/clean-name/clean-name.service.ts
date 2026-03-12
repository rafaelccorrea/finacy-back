import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CleanNameRequest } from './entities/clean-name-request.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CleanNameRequestStatus, SubscriptionStatus } from '../../common/enums';
import { CreateCleanNameRequestDto } from './dto/create-clean-name-request.dto';

@Injectable()
export class CleanNameService {
  constructor(
    @InjectRepository(CleanNameRequest)
    private readonly cleanNameRepository: Repository<CleanNameRequest>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async createRequest(userId: string, dto: CreateCleanNameRequestDto) {
    // Verify active subscription with available credits
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new ForbiddenException(
        'Você precisa de uma assinatura ativa para solicitar limpeza de nome.',
      );
    }

    if (!subscription.hasCredits()) {
      throw new ForbiddenException(
        'Créditos de Limpa Nome esgotados. Faça upgrade do seu plano.',
      );
    }

    // Check for duplicate CPF in pending/processing requests
    const existingRequest = await this.cleanNameRepository.findOne({
      where: {
        userId,
        cpf: dto.cpf,
        status: CleanNameRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'Já existe uma solicitação em andamento para este CPF.',
      );
    }

    const request = this.cleanNameRepository.create({
      userId,
      personName: dto.personName,
      cpf: dto.cpf,
      status: CleanNameRequestStatus.PENDING,
      metadata: { requestedAt: new Date() },
    });

    await this.cleanNameRepository.save(request);

    // Decrement credits
    await this.subscriptionRepository.update(subscription.id, {
      cleanNameCreditsUsed: subscription.cleanNameCreditsUsed + 1,
    });

    return request;
  }

  async getUserRequests(userId: string) {
    return this.cleanNameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRequestById(id: string, userId: string) {
    const request = await this.cleanNameRepository.findOne({
      where: { id, userId },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    return request;
  }

  async updateRequestStatus(
    id: string,
    status: CleanNameRequestStatus,
    data?: Partial<CleanNameRequest>,
  ) {
    const request = await this.cleanNameRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    await this.cleanNameRepository.update(id, {
      status,
      ...data,
      processedAt: status === CleanNameRequestStatus.COMPLETED ? new Date() : undefined,
    });

    return this.cleanNameRepository.findOne({ where: { id } });
  }

  async getStats(userId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });

    const total = await this.cleanNameRepository.count({ where: { userId } });
    const completed = await this.cleanNameRepository.count({
      where: { userId, status: CleanNameRequestStatus.COMPLETED },
    });
    const pending = await this.cleanNameRepository.count({
      where: { userId, status: CleanNameRequestStatus.PENDING },
    });

    return {
      total,
      completed,
      pending,
      creditsUsed: subscription?.cleanNameCreditsUsed || 0,
      creditsTotal: subscription?.cleanNameCreditsTotal || 0,
      creditsAvailable:
        (subscription?.cleanNameCreditsTotal || 0) -
        (subscription?.cleanNameCreditsUsed || 0),
    };
  }
}
