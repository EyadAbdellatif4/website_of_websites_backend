import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { PlaceholdersService } from './placeholders.service';
import { PlaceholdersController } from './placeholders.controller';

@Module({
  imports: [forwardRef(() => DesignsModule), FileStorageModule],
  controllers: [PlaceholdersController],
  providers: [PlaceholdersService],
  exports: [PlaceholdersService],
})
export class PlaceholdersModule {}
