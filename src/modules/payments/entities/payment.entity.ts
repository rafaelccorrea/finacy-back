import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus, PaymentMethod, PaymentType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.SUBSCRIPTION,
  })
  paymentType: PaymentType;

  @Column({ type: 'int', nullable: true })
  creditsAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'BRL' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @Column({ nullable: true })
  stripeInvoiceId: string;

  @Column({ nullable: true })
  pixQrCode: string;

  @Column({ nullable: true })
  pixQrCodeUrl: string;

  @Column({ nullable: true, type: 'timestamp' })
  pixExpiresAt: Date;

  @Column({ nullable: true })
  receiptUrl: string;

  @Column({ nullable: true, type: 'timestamp' })
  paidAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  failedAt: Date;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.payments)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Subscription, (subscription) => subscription.payments)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
