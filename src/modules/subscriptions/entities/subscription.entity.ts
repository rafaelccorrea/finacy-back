import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SubscriptionStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIALING,
  })
  status: SubscriptionStatus;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column({ nullable: true, type: 'timestamp' })
  trialStart: Date;

  @Column({ nullable: true, type: 'timestamp' })
  trialEnd: Date;

  @Column({ nullable: true, type: 'timestamp' })
  canceledAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  cancelAtPeriodEnd: Date;

  @Column({ default: 0 })
  cleanNameCreditsUsed: number;

  @Column({ default: 0 })
  cleanNameCreditsTotal: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.subscriptions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions)
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @OneToMany(() => Payment, (payment) => payment.subscription)
  payments: Payment[];

  isActive(): boolean {
    return (
      this.status === SubscriptionStatus.ACTIVE ||
      this.status === SubscriptionStatus.TRIALING
    );
  }

  hasCredits(): boolean {
    return this.cleanNameCreditsUsed < this.cleanNameCreditsTotal;
  }
}
