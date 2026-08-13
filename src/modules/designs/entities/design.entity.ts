import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DesignStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  ANALYZED = 'analyzed',
  FAILED = 'failed',
}

@Entity('designs')
export class Design {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  user_id!: string;

  @ManyToOne(() => User, (user) => user.designs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  name!: string;

  @Column({ name: 'file_name' })
  file_name!: string;

  @Column({ name: 'storage_key' })
  storage_key!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  file_size!: number;

  @Column({ type: 'varchar', default: DesignStatus.PENDING })
  status!: DesignStatus;

  @Column({ name: 'layout_data', type: 'jsonb', nullable: true })
  layout_data!: Record<string, unknown> | null;

  @Column({ name: 'placeholders_data', type: 'jsonb', nullable: true })
  placeholders_data!: Array<Record<string, unknown>> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at!: Date;
}
