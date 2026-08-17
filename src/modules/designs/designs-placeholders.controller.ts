import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  DesignPlaceholdersService,
  StoredPlaceholderItem,
} from './design-placeholders.service';
import { UpdatePlaceholderValueDto } from './dto/update-placeholder.dto';
import { UpdateSectionStyleDto } from './dto/update-section-style.dto';

@ApiTags('Design Placeholders & Content Editor')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignsPlaceholdersController {
  constructor(
    private readonly placeholdersService: DesignPlaceholdersService,
  ) {}

  @Get(':id/placeholders')
  @ApiOperation({
    summary: 'Retrieve all detected placeholders and their values for a design',
  })
  @ApiResponse({
    status: 200,
    description: 'List of placeholders with values',
  })
  async getPlaceholders(
    @Param('id') designId: string,
    @CurrentUser() user: User,
  ): Promise<StoredPlaceholderItem[]> {
    return this.placeholdersService.getPlaceholders(designId, user.id);
  }

  @Patch(':id/placeholders/:placeholderId')
  @ApiOperation({
    summary: 'Update content value for a text, button, or link placeholder',
  })
  @ApiResponse({
    status: 200,
    description: 'Placeholder updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid value format or unsafe URL',
  })
  @ApiResponse({ status: 404, description: 'Placeholder or design not found' })
  async updatePlaceholderValue(
    @Param('id') designId: string,
    @Param('placeholderId') placeholderId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdatePlaceholderValueDto,
  ) {
    return this.placeholdersService.updatePlaceholderValue(
      designId,
      placeholderId,
      user.id,
      dto.value,
    );
  }

  @Post(':id/placeholders/:placeholderId/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload user content image for an image placeholder',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Placeholder image uploaded and attached',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid image format, file size exceeded, or invalid placeholder type',
  })
  async uploadPlaceholderImage(
    @Param('id') designId: string,
    @Param('placeholderId') placeholderId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }
    return this.placeholdersService.uploadPlaceholderImage(
      designId,
      placeholderId,
      user.id,
      file,
    );
  }

  @Get(':id/placeholders/:placeholderId/image')
  @ApiOperation({
    summary: 'Stream authenticated uploaded image for placeholder preview',
  })
  @ApiResponse({ status: 200, description: 'Image binary stream' })
  @ApiResponse({ status: 404, description: 'Image or placeholder not found' })
  async getPlaceholderImage(
    @Param('id') designId: string,
    @Param('placeholderId') placeholderId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType, fileName } =
      await this.placeholdersService.getPlaceholderImageFile(
        designId,
        placeholderId,
        user.id,
      );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    res.send(buffer);
  }

  @Delete(':id/placeholders/:placeholderId/value')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear value for a specific placeholder',
  })
  @ApiResponse({
    status: 200,
    description: 'Placeholder value cleared',
  })
  async clearPlaceholderValue(
    @Param('id') designId: string,
    @Param('placeholderId') placeholderId: string,
    @CurrentUser() user: User,
  ) {
    return this.placeholdersService.clearPlaceholderValue(
      designId,
      placeholderId,
      user.id,
    );
  }

  @Patch(':id/sections/:sectionId/styles')
  @ApiOperation({
    summary: 'Update visual color palette & styling for a layout section',
  })
  @ApiResponse({
    status: 200,
    description: 'Section styles updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Section or design not found' })
  async updateSectionStyles(
    @Param('id') designId: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateSectionStyleDto,
  ) {
    return this.placeholdersService.updateSectionStyles(
      designId,
      sectionId,
      user.id,
      dto,
    );
  }
}
