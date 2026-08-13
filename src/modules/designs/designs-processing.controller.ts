import {
  Controller,
  Post,
  Get,
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
import {
  DesignProcessingService,
  NormalizedDesignRepresentation,
} from '../design-processing/design-processing.service';

@ApiTags('Design ZIP Processing Pipeline')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignsProcessingController {
  constructor(
    private readonly designProcessingService: DesignProcessingService,
  ) {}

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inspect and extract ZIP archive assets into isolated processing directory',
  })
  @ApiResponse({
    status: 200,
    description: 'ZIP extraction and asset inspection successful',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid or malicious ZIP archive (Zip Slip / size limit exceeded)',
  })
  @ApiResponse({
    status: 409,
    description: 'Design is currently being processed',
  })
  async processDesign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<NormalizedDesignRepresentation> {
    return this.designProcessingService.processDesign(id, user.id);
  }

  @Get(':id/result')
  @ApiOperation({
    summary:
      'Retrieve normalized design representation (SVG/image/font inventory)',
  })
  @ApiResponse({
    status: 200,
    description: 'Normalized design representation metadata',
  })
  async getProcessingResult(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<NormalizedDesignRepresentation> {
    return this.designProcessingService.getProcessingResult(id, user.id);
  }
}
