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
  DesignAnalysisService,
  AnalysisResponseDto,
} from '../design-analyzer/design-analysis.service';

@ApiTags('Design AI Analyzer')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignsAnalysisController {
  constructor(private readonly designAnalysisService: DesignAnalysisService) {}

  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Analyze design using Gemini AI to extract layout sections & placeholders',
  })
  @ApiResponse({
    status: 200,
    description:
      'Design analysis completed and saved to layout_data and placeholders_data',
  })
  @ApiResponse({
    status: 400,
    description: 'Design is not in valid status for analysis',
  })
  @ApiResponse({
    status: 500,
    description: 'Gemini AI API error or Zod schema validation failure',
  })
  async analyzeDesign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AnalysisResponseDto> {
    return this.designAnalysisService.analyzeDesign(id, user.id);
  }

  @Get(':id/analysis')
  @ApiOperation({
    summary: 'Retrieve design layout structure & placeholders JSON',
  })
  @ApiResponse({
    status: 200,
    description: 'Stored layout and placeholders JSON metadata',
  })
  async getAnalysisResult(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AnalysisResponseDto> {
    return this.designAnalysisService.getAnalysisResult(id, user.id);
  }
}
