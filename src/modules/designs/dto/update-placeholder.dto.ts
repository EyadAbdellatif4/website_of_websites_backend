import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const MAX_TEXT_PLACEHOLDER_LENGTH = 10000;

export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Explicitly reject dangerous executable or script URL schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  // Allow relative paths (e.g. /about, #pricing, ?filter=1)
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }

  // Allow standard protocols
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    // Relative URL without leading slash or anchor
    return /^[a-zA-Z0-9_\-./#?&=%+]+$/.test(trimmed);
  }
}

export class ButtonPlaceholderValueDto {
  @ApiProperty({ description: 'Button label text', example: 'Get Started' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;

  @ApiPropertyOptional({
    description: 'Target URL or relative route for button action',
    example: '/pricing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;
}

export class LinkPlaceholderValueDto {
  @ApiProperty({
    description: 'Navigation link anchor text',
    example: 'Features',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;

  @ApiProperty({
    description: 'Target URL or relative route for the hyperlink',
    example: '#features',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;
}

export class UpdatePlaceholderValueDto {
  @ApiProperty({
    description:
      'Value payload for placeholder depending on type (string for text, object for button/link)',
    example: 'Welcome to our premium service',
  })
  @Allow()
  value: unknown;
}
