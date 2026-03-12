import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from './entities/payment.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { Plan } from '../plans/entities/plan.entity';
import { PaymentStatus, PaymentMethod, SubscriptionStatus } from '../../common/enums';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder',
    );
  }

  async createOrGetStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });

    await this.userRepository.update(user.id, {
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  async createSubscription(userId: string, planId: string, paymentMethod: PaymentMethod) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plano não encontrado ou inativo.');

    const customerId = await this.createOrGetStripeCustomer(user);

    try {
      const createParams: any = {
        customer: customerId,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: paymentMethod === PaymentMethod.PIX ? ['pix'] : ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId, planId },
      };

      if (plan.trialDays) {
        createParams.trial_period_days = plan.trialDays;
      }

      const stripeSubscription = await this.stripe.subscriptions.create(createParams) as any;

      const subscription = this.subscriptionRepository.create({
        userId,
        planId,
        status: SubscriptionStatus.TRIALING,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cleanNameCreditsTotal: plan.cleanNameCredits,
      });

      await this.subscriptionRepository.save(subscription);

      const invoice = stripeSubscription.latest_invoice as any;
      const clientSecret = invoice?.payment_intent?.client_secret || null;

      return {
        subscriptionId: subscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        clientSecret,
        status: stripeSubscription.status,
      };
    } catch (error) {
      this.logger.error('Erro ao criar assinatura Stripe', error);
      throw new BadRequestException('Erro ao processar pagamento. Tente novamente.');
    }
  }

  async createPixPayment(userId: string, planId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');

    const customerId = await this.createOrGetStripeCustomer(user);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(plan.price) * 100),
        currency: 'brl',
        customer: customerId,
        payment_method_types: ['pix'],
        metadata: { userId, planId },
      });

      const payment = this.paymentRepository.create({
        userId,
        amount: plan.price,
        currency: 'BRL',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
        stripePaymentIntentId: paymentIntent.id,
        pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await this.paymentRepository.save(payment);

      return {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        pixExpiresAt: payment.pixExpiresAt,
      };
    } catch (error) {
      this.logger.error('Erro ao criar pagamento PIX', error);
      throw new BadRequestException('Erro ao criar pagamento PIX.');
    }
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Webhook inválido.');
    }

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string | undefined;
    if (!subscriptionId) return;

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscriptionId },
      { status: SubscriptionStatus.ACTIVE },
    );

    this.logger.log(`Payment succeeded for subscription: ${subscriptionId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string | undefined;
    if (!subscriptionId) return;

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscriptionId },
      { status: SubscriptionStatus.PAST_DUE },
    );

    this.logger.warn(`Payment failed for subscription: ${subscriptionId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.UNPAID,
    };

    const sub = subscription as any;

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscription.id },
      {
        status: statusMap[subscription.status] || SubscriptionStatus.INACTIVE,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscription.id },
      {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    );
  }

  async getUserPayments(userId: string) {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelSubscription(subscriptionId: string, userId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) throw new NotFoundException('Assinatura não encontrada.');

    if (subscription.stripeSubscriptionId) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    });

    return { message: 'Assinatura cancelada com sucesso.' };
  }
}
