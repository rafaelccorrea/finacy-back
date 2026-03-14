import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CleanNameRequest } from '../clean-name/entities/clean-name-request.entity';
import {
  UserRole,
  UserStatus,
  SubscriptionStatus,
  PaymentStatus,
  PaymentType,
} from '../../common/enums';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(CleanNameRequest)
    private readonly cleanNameRepo: Repository<CleanNameRequest>,
  ) {}

  // ─── Dashboard Stats ───────────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Totais gerais
    const totalUsers = await this.userRepo.count();
    const activeUsers = await this.userRepo.count({ where: { status: UserStatus.ACTIVE } });
    const totalSubscriptions = await this.subscriptionRepo.count();
    const activeSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });
    const trialingSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.TRIALING },
    });
    const canceledSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.CANCELED },
    });
    const totalCleanNameRequests = await this.cleanNameRepo.count();

    // Receita total (pagamentos confirmados)
    const revenueResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // Receita do mês atual
    const revenueMonthResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere('p.paidAt >= :start', { start: startOfMonth })
      .getRawOne();
    const revenueThisMonth = parseFloat(revenueMonthResult?.total || '0');

    // Receita do mês passado
    const revenueLastMonthResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere('p.paidAt BETWEEN :start AND :end', {
        start: startOfLastMonth,
        end: endOfLastMonth,
      })
      .getRawOne();
    const revenueLastMonth = parseFloat(revenueLastMonthResult?.total || '0');

    // Novos usuários este mês
    const newUsersThisMonth = await this.userRepo.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });

    // Novos usuários mês passado
    const newUsersLastMonth = await this.userRepo.count({
      where: { createdAt: Between(startOfLastMonth, endOfLastMonth) },
    });

    // MRR (Monthly Recurring Revenue) - soma dos preços dos planos ativos
    const mrrResult = await this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoin('s.plan', 'plan')
      .select('SUM(plan.price)', 'mrr')
      .where('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .getRawOne();
    const mrr = parseFloat(mrrResult?.mrr || '0');

    // Receita por tipo de pagamento
    const revenueByType = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.paymentType', 'type')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .groupBy('p.paymentType')
      .getRawMany();

    // Receita por mês (últimos 6 meses)
    const revenueByMonth = await this.paymentRepo
      .createQueryBuilder('p')
      .select("TO_CHAR(p.paidAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere("p.paidAt >= NOW() - INTERVAL '6 months'")
      .groupBy("TO_CHAR(p.paidAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(p.paidAt, 'YYYY-MM')", 'ASC')
      .getRawMany();

    // Distribuição de planos
    const planDistribution = await this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoin('s.plan', 'plan')
      .select('plan.name', 'planName')
      .addSelect('plan.price', 'price')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .groupBy('plan.name, plan.price')
      .getRawMany();

    // Crescimento de usuários por mês (últimos 6 meses)
    const userGrowth = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(u.id)', 'count')
      .where("u.createdAt >= NOW() - INTERVAL '6 months'")
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(u.createdAt, 'YYYY-MM')", 'ASC')
      .getRawMany();

    const revenueGrowth =
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

    const userGrowthPct =
      newUsersLastMonth > 0
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
        : 0;

    return {
      overview: {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        userGrowthPct: Math.round(userGrowthPct * 10) / 10,
        totalSubscriptions,
        activeSubscriptions,
        trialingSubscriptions,
        canceledSubscriptions,
        totalCleanNameRequests,
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        mrr,
      },
      charts: {
        revenueByMonth,
        revenueByType,
        planDistribution,
        userGrowth,
      },
    };
  }

  // ─── Users Management ──────────────────────────────────────────────────────

  async getUsers(page = 1, limit = 20, search?: string, role?: string, status?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.subscriptions', 'sub', 'sub.status IN (:...activeStatuses)', {
        activeStatuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .leftJoinAndSelect('sub.plan', 'plan')
      .orderBy('u.createdAt', 'DESC');

    if (search) {
      qb.andWhere('(u.name ILIKE :search OR u.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (role) {
      qb.andWhere('u.role = :role', { role });
    }
    if (status) {
      qb.andWhere('u.status = :status', { status });
    }

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        cpf: u.cpf,
        phone: u.phone,
        role: u.role,
        status: u.status,
        cleanNameCredits: u.cleanNameCredits,
        cleanNameCreditsUsed: u.cleanNameCreditsUsed,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        activeSubscription: u.subscriptions?.[0]
          ? {
              id: u.subscriptions[0].id,
              status: u.subscriptions[0].status,
              planName: u.subscriptions[0].plan?.name,
              currentPeriodEnd: u.subscriptions[0].currentPeriodEnd,
            }
          : null,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['subscriptions', 'subscriptions.plan', 'payments', 'cleanNameRequests'],
    });
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      phone: user.phone,
      role: user.role,
      status: user.status,
      cleanNameCredits: user.cleanNameCredits,
      cleanNameCreditsUsed: user.cleanNameCreditsUsed,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      subscriptions: user.subscriptions,
      payments: user.payments,
      cleanNameRequests: user.cleanNameRequests,
    };
  }

  async updateUserRole(userId: string, role: UserRole) {
    await this.userRepo.update(userId, { role });
    return this.getUserDetails(userId);
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    await this.userRepo.update(userId, { status });
    return this.getUserDetails(userId);
  }

  async addCreditsToUser(userId: string, credits: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    await this.userRepo.update(userId, {
      cleanNameCredits: user.cleanNameCredits + credits,
    });
    return this.getUserDetails(userId);
  }

  // ─── Subscriptions Management ──────────────────────────────────────────────

  async getSubscriptions(page = 1, limit = 20, status?: string, planId?: string) {
    const qb = this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.plan', 'plan')
      .orderBy('s.createdAt', 'DESC');

    if (status) {
      qb.andWhere('s.status = :status', { status });
    }
    if (planId) {
      qb.andWhere('s.planId = :planId', { planId });
    }

    const [subs, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: subs.map((s) => ({
        id: s.id,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        canceledAt: s.canceledAt,
        cleanNameCreditsUsed: s.cleanNameCreditsUsed,
        cleanNameCreditsTotal: s.cleanNameCreditsTotal,
        createdAt: s.createdAt,
        user: {
          id: s.user?.id,
          name: s.user?.name,
          email: s.user?.email,
        },
        plan: {
          id: s.plan?.id,
          name: s.plan?.name,
          price: s.plan?.price,
          slug: s.plan?.slug,
        },
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  // ─── Payments Management ───────────────────────────────────────────────────

  async getPayments(page = 1, limit = 20, status?: string, type?: string) {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.subscription', 'sub')
      .leftJoinAndSelect('sub.plan', 'plan')
      .orderBy('p.createdAt', 'DESC');

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }
    if (type) {
      qb.andWhere('p.paymentType = :type', { type });
    }

    const [payments, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paymentType: p.paymentType,
        creditsAmount: p.creditsAmount,
        paidAt: p.paidAt,
        failedAt: p.failedAt,
        failureReason: p.failureReason,
        receiptUrl: p.receiptUrl,
        createdAt: p.createdAt,
        user: {
          id: p.user?.id,
          name: p.user?.name,
          email: p.user?.email,
        },
        plan: p.subscription?.plan
          ? {
              name: p.subscription.plan.name,
              price: p.subscription.plan.price,
            }
          : null,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  // ─── Plans Management ──────────────────────────────────────────────────────

  async getPlans() {
    return this.planRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async updatePlan(planId: string, data: Partial<Plan>) {
    await this.planRepo.update(planId, data);
    return this.planRepo.findOne({ where: { id: planId } });
  }
}
