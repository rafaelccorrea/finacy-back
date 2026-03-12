import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { PaymentMethod } from '../../common/enums';

@ApiTags('Pagamentos')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('subscribe/:planId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar assinatura de plano' })
  async createSubscription(
    @CurrentUser() user: User,
    @Param('planId') planId: string,
    @Body('paymentMethod') paymentMethod: PaymentMethod,
  ) {
    return this.paymentsService.createSubscription(user.id, planId, paymentMethod);
  }

  @Post('pix/:planId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar pagamento via PIX' })
  async createPixPayment(
    @CurrentUser() user: User,
    @Param('planId') planId: string,
  ) {
    return this.paymentsService.createPixPayment(user.id, planId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de pagamentos do usuário' })
  async getPaymentHistory(@CurrentUser() user: User) {
    return this.paymentsService.getUserPayments(user.id);
  }

  @Post('cancel/:subscriptionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar assinatura' })
  async cancelSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.paymentsService.cancelSubscription(subscriptionId, user.id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook do Stripe' })
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) {
      return { received: false, error: 'No raw body' };
    }
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
