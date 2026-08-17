import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { WebsiteGeneratorModule } from '../website-generator/website-generator.module';
import { WebsitePreviewService } from './website-preview.service';
import { ProjectValidatorService } from './services/project-validator.service';
import { PortManagerService } from './services/port-manager.service';
import { LocalPreviewManagerService } from './services/local-preview-manager.service';
import { PREVIEW_MANAGER } from './services/preview-manager.interface';
import { WebsitePreviewController } from './website-preview.controller';

@Module({
  imports: [
    forwardRef(() => DesignsModule),
    forwardRef(() => WebsiteGeneratorModule),
  ],
  controllers: [WebsitePreviewController],
  providers: [
    WebsitePreviewService,
    ProjectValidatorService,
    PortManagerService,
    LocalPreviewManagerService,
    {
      provide: PREVIEW_MANAGER,
      useExisting: LocalPreviewManagerService,
    },
  ],
  exports: [WebsitePreviewService, PREVIEW_MANAGER],
})
export class WebsitePreviewModule {}
