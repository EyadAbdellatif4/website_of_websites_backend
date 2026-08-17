import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { WebsitePreviewService } from './website-preview.service';
import { PreviewStatusResponse } from './interfaces/preview.interface';

@ApiTags('Website Preview & Validation')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class WebsitePreviewController {
  constructor(private readonly previewService: WebsitePreviewService) {}

  @Post(':id/preview')
  @ApiOperation({
    summary:
      'Validate and start a local preview instance for a generated website',
  })
  @ApiResponse({
    status: 201,
    description: 'Preview started successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Project not generated or failed pre-flight validation',
  })
  @ApiResponse({ status: 404, description: 'Design not found' })
  async startPreview(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<PreviewStatusResponse> {
    return this.previewService.startPreview(designId, user.id);
  }

  @Get(':id/preview')
  @ApiOperation({
    summary: 'Retrieve preview status and URL for a design',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview status details',
  })
  async getPreviewStatus(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<PreviewStatusResponse> {
    return this.previewService.getPreviewStatus(designId, user.id);
  }

  @Delete(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop the active preview instance and release its port',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview stopped successfully',
  })
  async stopPreview(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<PreviewStatusResponse> {
    return this.previewService.stopPreview(designId, user.id);
  }
}
