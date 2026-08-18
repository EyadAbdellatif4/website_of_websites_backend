import {
  Controller,
  Post,
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
} from './design-processing.service';

@ApiTags('Design Processing Pipeline')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignProcessingController {
  constructor(
    private readonly designProcessingService: DesignProcessingService,
  ) {}

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inspect and extract design assets into isolated processing directory',
  })
  @ApiResponse({
    status: 200,
    description: 'Design extraction and asset inspection successful',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid or malicious archive (Zip Slip / size limit exceeded)',
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
}
