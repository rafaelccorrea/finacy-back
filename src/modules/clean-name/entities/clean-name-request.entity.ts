import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CleanNameRequestStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('clean_name_requests')
export class CleanNameRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 150 })
  personName: string;

  @Column({ length: 14 })
  cpf: string;

  @Column({
    type: 'enum',
    enum: CleanNameRequestStatus,
    default: CleanNameRequestStatus.PENDING,
  })
  status: CleanNameRequestStatus;

  @Column({ type: 'jsonb', nullable: true })
  debtDetails: Record<string, any>[];

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalDebtAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  negotiationResult: Record<string, any>;

  @Column({ nullable: true })
  documentId: string;

  @Column({ nullable: true })
  documentUrl: string;

  @Column({ nullable: true, type: 'timestamp' })
  processedAt: Date;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.cleanNameRequests)
  @JoinColumn({ name: 'userId' })
  user: User;
}
