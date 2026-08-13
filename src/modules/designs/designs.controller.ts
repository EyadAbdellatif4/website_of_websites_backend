import {
  Controller,
  Post,
  Get,
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
import { DesignsService, SafeDesignDto } from './designs.service';
import {
  UploadDesignDto,
  UploadDesignWithFileDto,
} from './dto/upload-design.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Designs Management')
@ApiCookieAuth('access_token')
@ApiBearerAuth()
@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a design ZIP archive' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDesignWithFileDto })
  @ApiResponse({
    status: 201,
    description: 'ZIP uploaded and stored successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid ZIP file or parameters' })
  async uploadDesign(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDesignDto,
  ): Promise<SafeDesignDto> {
    if (!file) {
      throw new BadRequestException('ZIP file is required');
    }
    return this.designsService.uploadDesign(user, file, dto.name);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a design ZIP archive (alias)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDesignWithFileDto })
  @ApiResponse({
    status: 201,
    description: 'ZIP uploaded and stored successfully',
  })
  async createDesign(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDesignDto,
  ): Promise<SafeDesignDto> {
    if (!file) {
      throw new BadRequestException('ZIP file is required');
    }
    return this.designsService.uploadDesign(user, file, dto.name);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all designs uploaded by current user' })
  @ApiResponse({ status: 200, description: 'List of user designs' })
  async getDesigns(@CurrentUser() user: User): Promise<SafeDesignDto[]> {
    return this.designsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve design metadata by ID' })
  @ApiResponse({ status: 200, description: 'Design details' })
  @ApiResponse({ status: 404, description: 'Design not found' })
  async getDesignById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<SafeDesignDto> {
    return this.designsService.findOneForUser(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a design and remove its stored files' })
  @ApiResponse({ status: 200, description: 'Design deleted successfully' })
  @ApiResponse({ status: 404, description: 'Design not found' })
  async deleteDesign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    return this.designsService.deleteForUser(id, user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download the original uploaded ZIP archive' })
  @ApiResponse({ status: 200, description: 'ZIP archive stream' })
  @ApiResponse({ status: 404, description: 'Design or file not found' })
  async downloadDesign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    const { design, buffer } = await this.designsService.getDesignFileBuffer(
      id,
      user.id,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(design.file_name)}"`,
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  }
}
