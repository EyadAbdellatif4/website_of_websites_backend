import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSectionStyleDto {
  @ApiPropertyOptional({ description: 'Section background color (e.g. #09090b)' })
  @IsOptional()
  @IsString()
  background_color?: string;

  @ApiPropertyOptional({ description: 'Section primary text color (e.g. #ffffff)' })
  @IsOptional()
  @IsString()
  text_color?: string;

  @ApiPropertyOptional({ description: 'Section primary accent/button color (e.g. #6366f1)' })
  @IsOptional()
  @IsString()
  primary_color?: string;

  @ApiPropertyOptional({ description: 'Section secondary accent color (e.g. #06b6d4)' })
  @IsOptional()
  @IsString()
  secondary_color?: string;
}
