import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '../../../common/enums';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { CleanNameRequest } from '../../clean-name/entities/clean-name-request.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ unique: true, length: 14, nullable: true })
  cpf: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ nullable: true, length: 255 })
  avatarUrl: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ type: 'int', default: 0 })
  cleanNameCredits: number;

  @Column({ type: 'int', default: 0 })
  cleanNameCreditsUsed: number;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken: string;

  @Column({ nullable: true })
  @Exclude()
  passwordResetToken: string;

  @Column({ nullable: true })
  @Exclude()
  passwordResetExpires: Date;

  @Column({ nullable: true })
  @Exclude()
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ default: 0 })
  @Exclude()
  loginAttempts: number;

  @Column({ nullable: true })
  @Exclude()
  lockedUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @OneToMany(() => CleanNameRequest, (request) => request.user)
  cleanNameRequests: CleanNameRequest[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2')) {
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      this.password = await bcrypt.hash(this.password, rounds);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  isLocked(): boolean {
    if (!this.lockedUntil) return false;
    return new Date() < this.lockedUntil;
  }
}
