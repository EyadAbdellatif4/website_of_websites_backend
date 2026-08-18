import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DesignsModule } from './modules/designs/designs.module';
import { DesignProcessingModule } from './modules/design-processing/design-processing.module';
import { DesignAnalysisModule } from './modules/design-analysis/design-analysis.module';
import { PlaceholdersModule } from './modules/placeholders/placeholders.module';
import { WebsiteGeneratorModule } from './modules/website-generator/website-generator.module';
import { WebsitePreviewModule } from './modules/website-preview/website-preview.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    FileStorageModule,
    AuthModule,
    UsersModule,
    DesignsModule,
    DesignProcessingModule,
    DesignAnalysisModule,
    PlaceholdersModule,
    WebsiteGeneratorModule,
    WebsitePreviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
