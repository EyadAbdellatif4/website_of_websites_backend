import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Design } from './entities/design.entity';
import { DesignsService } from './designs.service';
import { DesignsController } from './designs.controller';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { DesignProcessingModule } from '../design-processing/design-processing.module';
import { DesignAnalyzerModule } from '../design-analyzer/design-analyzer.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Design]),
    FileStorageModule,
    forwardRef(() => DesignProcessingModule),
    forwardRef(() => DesignAnalyzerModule),
  ],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
