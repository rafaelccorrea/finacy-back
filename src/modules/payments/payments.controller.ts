import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateSubscriptionCheckoutDto {
  @ApiProperty({ description: 'ID do plano' })
  @IsNotEmpty()
  @IsString()
  planId: string;

  @ApiProperty({ enum: ['card', 'pix'], default: 'card' })
  @IsEnum(['card', 'pix'])
  paymentMethod: 'card' | 'pix';

  @ApiProperty({ description: 'URL de sucesso após pagamento' })
  @IsString()
  successUrl: string;

  @ApiProperty({ description: 'URL de cancelamento' })
  @IsString()
  cancelUrl: string;
}

class CreateCreditCheckoutDto {
  @ApiProperty({ description: 'ID do pacote de créditos' })
  @IsNotEmpty()
  @IsString()
  packageId: string;

  @ApiProperty({ enum: ['card', 'pix'], default: 'card' })
  @IsEnum(['card', 'pix'])
  paymentMethod: 'card' | 'pix';

  @ApiProperty({ description: 'URL de sucesso após pagamento' })
  @IsString()
  successUrl: string;

  @ApiProperty({ description: 'URL de cancelamento' })
  @IsString()
  cancelUrl: string;
}

class CancelSubscriptionDto {
  @ApiProperty({ description: 'Cancelar imediatamente?', default: false, required: false })
  @IsOptional()
  immediately?: boolean;
}

@ApiTags('Pagamentos')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Checkout: Assinatura Mensal ──────────────────────────────────────────────
  @Post('checkout/subscription')
  @ApiOperation({ summary: 'Criar checkout de assinatura mensal via Stripe' })
  @ApiResponse({ status: 201, description: 'URL de checkout gerada com sucesso' })
  async createSubscriptionCheckout(
    @CurrentUser() user: any,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.paymentsService.createSubscriptionCheckout(
      user.id,
      dto.planId,
      dto.paymentMethod,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  // ─── Checkout: Compra de Créditos Avulsos ─────────────────────────────────────
  @Post('checkout/credits')
  @ApiOperation({ summary: 'Criar checkout para compra de créditos avulsos via Stripe' })
  @ApiResponse({ status: 201, description: 'URL de checkout gerada com sucesso' })
  async createCreditPurchaseCheckout(
    @CurrentUser() user: any,
    @Body() dto: CreateCreditCheckoutDto,
  ) {
    return this.paymentsService.createCreditPurchaseCheckout(
      user.id,
      dto.packageId,
      dto.paymentMethod,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  // ─── Listar pacotes de créditos disponíveis ───────────────────────────────────
  @Get('credit-packages')
  @ApiOperation({ summary: 'Listar pacotes de créditos disponíveis para compra' })
  async listCreditPackages() {
    return this.paymentsService.listCreditPackages();
  }

  // ─── Saldo de créditos do usuário ─────────────────────────────────────────────
  @Get('credits/balance')
  @ApiOperation({ summary: 'Consultar saldo de créditos Limpa Nome do usuário' })
  async getCreditsBalance(@CurrentUser() user: any) {
    return this.paymentsService.getUserCreditsBalance(user.id);
  }

  // ─── Histórico de pagamentos ──────────────────────────────────────────────────
  @Get('history')
  @ApiOperation({ summary: 'Histórico de pagamentos do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPaymentHistory(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.paymentsService.getUserPayments(user.id, Number(page), Number(limit));
  }

  // ─── Cancelar assinatura ──────────────────────────────────────────────────────
  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar assinatura (imediatamente ou ao fim do período)' })
  async cancelSubscription(
    @CurrentUser() user: any,
    @Param('id') subscriptionId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.paymentsService.cancelSubscription(subscriptionId, user.id, dto.immediately);
  }

  // ─── Portal do cliente Stripe ─────────────────────────────────────────────────
  @Post('portal')
  @ApiOperation({ summary: 'Gerar URL do portal de gerenciamento de assinatura Stripe' })
  async createPortalSession(
    @CurrentUser() user: any,
    @Body('returnUrl') returnUrl: string,
  ) {
    return this.paymentsService.createCustomerPortalSession(user.id, returnUrl);
  }

  // ─── Webhook Stripe (público) ─────────────────────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Stripe — não requer autenticação' })
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) return { received: false, error: 'No raw body' };
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
