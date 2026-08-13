import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';

export enum DesignStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export interface DesignAttributes {
  id?: string;
  user_id: string;
  name: string;
  file_name: string;
  storage_key: string;
  file_size: number;
  status: DesignStatus;
  layout_data?: Record<string, unknown> | null;
  placeholders_data?: Array<Record<string, unknown>> | null;
  created_at?: Date;
  updated_at?: Date;
}

export type DesignCreationAttributes = DesignAttributes;

@Table({
  tableName: 'designs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Design extends Model<DesignAttributes, DesignCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    allowNull: false,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare user_id: string;

  @BelongsTo(() => User, { onDelete: 'CASCADE' })
  declare user: User;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'file_name',
  })
  declare file_name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'storage_key',
  })
  declare storage_key: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    field: 'file_size',
  })
  declare file_size: number;

  @Column({
    type: DataType.ENUM(...Object.values(DesignStatus)),
    allowNull: false,
    defaultValue: DesignStatus.UPLOADED,
    validate: {
      isIn: [Object.values(DesignStatus)],
    },
  })
  declare status: DesignStatus;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'layout_data',
  })
  declare layout_data: Record<string, unknown> | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'placeholders_data',
  })
  declare placeholders_data: Array<Record<string, unknown>> | null;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare created_at: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updated_at: Date;
}
