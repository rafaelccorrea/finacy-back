import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreditPackageStatus } from '../../../common/enums';

@Entity('credit_packages')
export class CreditPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  credits: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  stripePriceId: string;

  @Column({ nullable: true })
  stripeProductId: string;

  @Column({ default: false })
  isPopular: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: CreditPackageStatus,
    default: CreditPackageStatus.ACTIVE,
  })
  status: CreditPackageStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
