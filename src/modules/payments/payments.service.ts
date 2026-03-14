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
import { CreditPackage } from '../credit-packages/entities/credit-package.entity';
import {
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  SubscriptionStatus,
} from '../../common/enums';

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
    @InjectRepository(CreditPackage)
    private readonly creditPackageRepository: Repository<CreditPackage>,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder',
    );
  }

  // ─── Criar ou recuperar Stripe Customer ──────────────────────────────────────
  async createOrGetStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });

    await this.userRepository.update(user.id, { stripeCustomerId: customer.id });
    return customer.id;
  }

  // ─── CHECKOUT: Assinatura Mensal ──────────────────────────────────────────────
  async createSubscriptionCheckout(
    userId: string,
    planId: string,
    paymentMethod: 'card' | 'pix',
    successUrl: string,
    cancelUrl: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plano não encontrado ou inativo');

    // PIX não é suportado pelo Stripe para assinaturas recorrentes (mode: 'subscription').
    // O Stripe aceita apenas cartão de crédito/débito para cobranças recorrentes.
    if (paymentMethod === 'pix') {
      throw new BadRequestException(
        'PIX não está disponível para assinaturas recorrentes. Por favor, utilize cartão de crédito.',
      );
    }

    const customerId = await this.createOrGetStripeCustomer(user);

    const interval = (plan.interval === 'yearly' ? 'year' : 'month') as 'month' | 'year';
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = plan.stripePriceId
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'brl',
            product_data: {
              name: plan.name,
              description: plan.description || `${plan.cleanNameCredits} créditos Limpa Nome`,
              metadata: { planId },
            },
            unit_amount: Math.round(Number(plan.price) * 100),
            recurring: { interval },
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      // Apenas cartão para assinaturas recorrentes (PIX não suportado pelo Stripe neste modo)
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: cancelUrl,
      metadata: { userId, planId, type: 'subscription' },
      subscription_data: {
        metadata: { userId, planId },
        trial_period_days: plan.trialDays || undefined,
      },
      locale: 'pt-BR',
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  // ─── CHECKOUT: Compra de Créditos Avulsos ─────────────────────────────────────
  async createCreditPurchaseCheckout(
    userId: string,
    packageId: string,
    paymentMethod: 'card' | 'pix',
    successUrl: string,
    cancelUrl: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const pkg = await this.creditPackageRepository.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Pacote de créditos não encontrado');

    const customerId = await this.createOrGetStripeCustomer(user);

    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      paymentMethod === 'pix' ? ['pix'] : ['card'];

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;

    if (pkg.stripePriceId) {
      lineItem = { price: pkg.stripePriceId, quantity: 1 };
    } else {
      lineItem = {
        price_data: {
          currency: 'brl',
          product_data: {
            name: pkg.name,
            description: pkg.description || `${pkg.credits} créditos Limpa Nome`,
          },
          unit_amount: Math.round(Number(pkg.price) * 100),
        },
        quantity: 1,
      };
    }

    // Configuração adicional para PIX: expiração do QR Code em 1 hora
    // Nota: payment_method_options.pix é configurado via payment_intent_data com cast any
    const pixOptions: Record<string, any> =
      paymentMethod === 'pix'
        ? {
            payment_intent_data: {
              payment_method_options: {
                pix: { expires_after_seconds: 3600 },
              },
            },
          }
        : {};

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      // PIX é suportado apenas para pagamentos únicos (mode: 'payment')
      // Requer conta Stripe configurada para o Brasil (BR)
      payment_method_types: paymentMethodTypes,
      line_items: [lineItem],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&type=credits`,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        packageId,
        credits: String(pkg.credits),
        type: 'credit_purchase',
      },
      locale: 'pt-BR',
      ...pixOptions,
    });

    // Registrar pagamento pendente
    const payment = this.paymentRepository.create({
      userId,
      amount: pkg.price,
      currency: 'BRL',
      status: PaymentStatus.PENDING,
      paymentMethod: paymentMethod === 'pix' ? PaymentMethod.PIX : PaymentMethod.CREDIT_CARD,
      paymentType: PaymentType.CREDIT_PURCHASE,
      creditsAmount: pkg.credits,
      metadata: { sessionId: session.id, packageId, packageName: pkg.name },
    });
    await this.paymentRepository.save(payment);

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      credits: pkg.credits,
      amount: pkg.price,
    };
  }

  // ─── WEBHOOK: Processar eventos Stripe ───────────────────────────────────────
  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature inválida: ${err.message}`);
      throw new BadRequestException('Webhook signature inválida');
    }

    this.logger.log(`Webhook recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.debug(`Evento não tratado: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, packageId, credits, type } = session.metadata || {};

    if (type === 'credit_purchase' && userId && packageId && credits) {
      await this.userRepository.increment({ id: userId }, 'cleanNameCredits', parseInt(credits));

      await this.paymentRepository.update(
        { metadata: { sessionId: session.id } as any },
        { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      );

      this.logger.log(`${credits} créditos adicionados ao usuário ${userId}`);
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = (invoice as any).subscription as string;
    if (!stripeSubscriptionId) return;

    const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const userId = stripeSubscription.metadata?.userId;
    const planId = stripeSubscription.metadata?.planId;
    if (!userId || !planId) return;

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    const sub = stripeSubscription as any;
    const periodStart = new Date(sub.current_period_start * 1000);
    const periodEnd = new Date(sub.current_period_end * 1000);

    let subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      subscription = this.subscriptionRepository.create({
        userId,
        planId,
        stripeSubscriptionId,
        stripeCustomerId: stripeSubscription.customer as string,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cleanNameCreditsTotal: plan?.cleanNameCredits || 0,
      });
    } else {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
    }

    await this.subscriptionRepository.save(subscription);

    if (plan && plan.cleanNameCredits > 0) {
      await this.userRepository.update(userId, {
        cleanNameCredits: plan.cleanNameCredits,
        cleanNameCreditsUsed: 0,
      });
    }

    const payment = this.paymentRepository.create({
      userId,
      subscriptionId: subscription.id,
      amount: Number(invoice.amount_paid) / 100,
      currency: 'BRL',
      status: PaymentStatus.SUCCEEDED,
      paymentType: PaymentType.SUBSCRIPTION,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      stripeInvoiceId: invoice.id,
      paidAt: new Date(),
      receiptUrl: invoice.hosted_invoice_url || undefined,
    });
    await this.paymentRepository.save(payment);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = (invoice as any).subscription as string;
    if (!stripeSubscriptionId) return;
    await this.subscriptionRepository.update(
      { stripeSubscriptionId },
      { status: SubscriptionStatus.PAST_DUE },
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscription.id },
      { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const sub = subscription as any;
    await this.subscriptionRepository.update(
      { stripeSubscriptionId: subscription.id },
      {
        status: subscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    );
  }

  // ─── Listar pacotes de créditos ───────────────────────────────────────────────
  async listCreditPackages() {
    return this.creditPackageRepository.find({
      where: { status: 'active' as any },
      order: { sortOrder: 'ASC', price: 'ASC' },
    });
  }

  // ─── Histórico de pagamentos ──────────────────────────────────────────────────
  async getUserPayments(userId: string, page = 1, limit = 10) {
    const [payments, total] = await this.paymentRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { payments, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Saldo de créditos ────────────────────────────────────────────────────────
  async getUserCreditsBalance(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'cleanNameCredits', 'cleanNameCreditsUsed'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      available: user.cleanNameCredits,
      used: user.cleanNameCreditsUsed,
      total: user.cleanNameCredits + user.cleanNameCreditsUsed,
    };
  }

  // ─── Cancelar assinatura ──────────────────────────────────────────────────────
  async cancelSubscription(subscriptionId: string, userId: string, immediately = false) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');

    if (subscription.stripeSubscriptionId) {
      if (immediately) {
        await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        await this.subscriptionRepository.update(subscription.id, {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
        });
      } else {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        await this.subscriptionRepository.update(subscription.id, { cancelAtPeriodEnd: true });
      }
    }

    return {
      message: immediately
        ? 'Assinatura cancelada imediatamente'
        : 'Assinatura será cancelada ao fim do período',
    };
  }

  // ─── Portal do cliente Stripe ─────────────────────────────────────────────────
  async createCustomerPortalSession(userId: string, returnUrl: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.stripeCustomerId) throw new BadRequestException('Usuário sem conta Stripe');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { portalUrl: session.url, url: session.url };
  }
}
