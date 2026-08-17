import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { WebsiteGeneratorService } from './website-generator.service';
import { TemplateRendererService } from './services/template-renderer.service';
import { AssetBundlerService } from './services/asset-bundler.service';
import { WebsiteGeneratorController } from './website-generator.controller';

@Module({
  imports: [forwardRef(() => DesignsModule), FileStorageModule],
  controllers: [WebsiteGeneratorController],
  providers: [
    WebsiteGeneratorService,
    TemplateRendererService,
    AssetBundlerService,
  ],
  exports: [WebsiteGeneratorService],
})
export class WebsiteGeneratorModule {}
