import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Design } from '../designs/entities/design.entity';
import { DesignsModule } from '../designs/designs.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { DesignProcessingService } from './design-processing.service';
import { DesignProcessingController } from './design-processing.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([Design]),
    forwardRef(() => DesignsModule),
    FileStorageModule,
  ],
  controllers: [DesignProcessingController],
  providers: [DesignProcessingService],
  exports: [DesignProcessingService],
})
export class DesignProcessingModule {}
