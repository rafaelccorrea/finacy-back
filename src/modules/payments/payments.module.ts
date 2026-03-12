import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CreditPackage } from '../credit-packages/entities/credit-package.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Subscription, User, Plan, CreditPackage])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
