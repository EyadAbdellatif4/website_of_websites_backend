import {
  Controller,
  Post,
  Param,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  DesignProcessingService,
  NormalizedDesignRepresentation,
} from './design-processing.service';
import { UploadDesignDto } from '../designs/dto/upload-design.dto';
import { SafeDesignDto } from '../designs/designs.service';

@Controller('designs')
@UseGuards(JwtAuthGuard)
export class DesignProcessingController {
  constructor(
    private readonly designProcessingService: DesignProcessingService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDesign(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDesignDto,
  ): Promise<SafeDesignDto> {
    if (!file) {
      throw new BadRequestException('Design file is required');
    }
    return this.designProcessingService.upload(user, file, dto?.name);
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  async processDesign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<NormalizedDesignRepresentation> {
    return this.designProcessingService.processDesign(id, user.id);
  }
}
