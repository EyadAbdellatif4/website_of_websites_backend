import { IsString, IsNotEmpty, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateDesignDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @IsNumber()
  @Min(1)
  fileSize!: number;
}
