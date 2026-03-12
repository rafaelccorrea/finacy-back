import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async getUserSubscription(userId: string) {
    return this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserSubscriptionHistory(userId: string) {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionById(id: string, userId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, userId },
      relations: ['plan', 'payments'],
    });

    if (!subscription) throw new NotFoundException('Assinatura não encontrada.');
    return subscription;
  }

  async getDashboardStats(userId: string) {
    const activeSubscription = await this.getUserSubscription(userId);
    const history = await this.getUserSubscriptionHistory(userId);

    return {
      hasActiveSubscription: !!activeSubscription,
      currentPlan: activeSubscription?.plan || null,
      subscriptionStatus: activeSubscription?.status || null,
      currentPeriodEnd: activeSubscription?.currentPeriodEnd || null,
      cleanNameCreditsUsed: activeSubscription?.cleanNameCreditsUsed || 0,
      cleanNameCreditsTotal: activeSubscription?.cleanNameCreditsTotal || 0,
      totalSubscriptions: history.length,
    };
  }
}
