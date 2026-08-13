import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DesignsService } from './designs.service';
import { Design } from './entities/design.entity';

@Controller('designs')
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Get(':id')
  async getDesignById(@Param('id') id: string): Promise<Design> {
    const design = await this.designsService.findById(id);
    if (!design) {
      throw new NotFoundException(`Design with ID '${id}' not found`);
    }
    return design;
  }
}
