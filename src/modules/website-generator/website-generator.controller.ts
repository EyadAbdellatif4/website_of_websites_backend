import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { WebsiteGeneratorService } from './website-generator.service';
import {
  GenerationResult,
  GeneratedProjectManifest,
} from './interfaces/generator.interface';

@ApiTags('Website Generation Engine')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class WebsiteGeneratorController {
  constructor(private readonly generatorService: WebsiteGeneratorService) {}

  @Post(':id/generate')
  @ApiOperation({
    summary:
      'Generate a standalone Next.js App Router website from analyzed design & user content',
  })
  @ApiResponse({
    status: 201,
    description: 'Website generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Design missing layout or placeholder analysis data',
  })
  @ApiResponse({ status: 404, description: 'Design not found' })
  async generateWebsite(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<GenerationResult> {
    return this.generatorService.generateWebsite(designId, user.id);
  }

  @Get(':id/generation')
  @ApiOperation({
    summary: 'Retrieve manifest and file tree of the latest generated website',
  })
  @ApiResponse({
    status: 200,
    description: 'Generated project manifest',
  })
  async getLatestGeneration(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<GeneratedProjectManifest> {
    const manifest = await this.generatorService.getLatestGenerationManifest(
      designId,
      user.id,
    );
    if (!manifest) {
      throw new NotFoundException('No generation found for this design.');
    }
    return manifest;
  }

  @Get(':id/generation/download')
  @ApiOperation({
    summary: 'Download generated Next.js project as a ZIP archive',
  })
  @ApiResponse({
    status: 200,
    description: 'ZIP archive binary stream',
  })
  async downloadGeneratedProject(
    @Param('id') designId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } =
      await this.generatorService.getGeneratedProjectZip(designId, user.id);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  }
}
