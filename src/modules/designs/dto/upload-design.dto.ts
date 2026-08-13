import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadDesignDto {
  @ApiProperty({
    example: 'Modern Hotel Landing Page',
    description: 'Human readable design name',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'Design name is required' })
  @MaxLength(150, { message: 'Design name cannot exceed 150 characters' })
  name!: string;
}

export class UploadDesignWithFileDto extends UploadDesignDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'ZIP archive file containing design assets',
  })
  file!: unknown;
}
