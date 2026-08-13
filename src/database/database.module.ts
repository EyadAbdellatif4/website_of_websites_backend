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
        host: configService.get<string>('database.host', 'localhost'),
        port: configService.get<number>('database.port', 5432),
        username: configService.get<string>('database.username', 'postgres'),
        password: configService.get<string>('database.password', '1q2w3e4r5t'),
        database: configService.get<string>(
          'database.name',
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
