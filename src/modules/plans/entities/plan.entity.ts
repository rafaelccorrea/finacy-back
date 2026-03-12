import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PlanInterval } from '../../../common/enums';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: PlanInterval,
    default: PlanInterval.MONTHLY,
  })
  interval: PlanInterval;

  @Column({ nullable: true })
  stripePriceId: string;

  @Column({ nullable: true })
  stripeProductId: string;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, any>;

  @Column({ default: 0 })
  cleanNameCredits: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPopular: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'int', nullable: true })
  trialDays: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions: Subscription[];
}
