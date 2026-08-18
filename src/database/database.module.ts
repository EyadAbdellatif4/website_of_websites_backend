import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../modules/users/entities/user.entity';
import { Design } from '../modules/designs/entities/design.entity';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', 5432)),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', '1q2w3e4r5t'),
        database: configService.get<string>(
          'DB_NAME',
          'website_of_websites',
        ),
        models: [User, Design],
        autoLoadModels: true,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
