import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { imageSize } from 'image-size';
import * as path from 'path';
import { DesignsService } from '../designs/designs.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { FileStorage } from '../file-storage/file-storage.interface';
import {
  isSafeUrl,
  MAX_TEXT_PLACEHOLDER_LENGTH,
} from './dto/update-placeholder.dto';

export interface ImagePlaceholderValue {
  storage_key: string;
  file_name: string;
  width: number | null;
  height: number | null;
  size: number;
  mime_type: string;
}

export interface ButtonPlaceholderValue {
  text: string;
  url?: string;
}

export interface LinkPlaceholderValue {
  text: string;
  url: string;
}

export interface StoredPlaceholderItem {
  id: string;
  type: string;
  role: string;
  section_id: string;
  bounds: { x: number; y: number; width: number; height: number };
  content_hint?: string;
  value?: unknown;
}

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class PlaceholdersService {
  constructor(
    private readonly designsService: DesignsService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
    private readonly configService: ConfigService,
  ) {}

  async getPlaceholders(
    designId: string,
    userId: string,
  ): Promise<StoredPlaceholderItem[]> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.placeholders_data || !Array.isArray(design.placeholders_data)) {
      throw new BadRequestException(
        'Design has not been analyzed yet. Please run AI analysis first.',
      );
    }

    return design.placeholders_data as unknown as StoredPlaceholderItem[];
  }

  async updatePlaceholderValue(
    designId: string,
    placeholderId: string,
    userId: string,
    rawValue: unknown,
  ): Promise<{
    placeholder: StoredPlaceholderItem;
    totalFilled: number;
    totalCount: number;
  }> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.placeholders_data || !Array.isArray(design.placeholders_data)) {
      throw new BadRequestException(
        'Design has not been analyzed yet. Please run AI analysis first.',
      );
    }

    const placeholders = [
      ...(design.placeholders_data as unknown as StoredPlaceholderItem[]),
    ];

    const targetIdx = placeholders.findIndex((p) => p.id === placeholderId);
    if (targetIdx === -1) {
      throw new NotFoundException(
        `Placeholder with ID '${placeholderId}' not found in design.`,
      );
    }

    const currentPlaceholder = placeholders[targetIdx];
    const phType = (currentPlaceholder.type || 'text').toLowerCase();

    let validatedValue: unknown = null;

    if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
      switch (phType) {
        case 'text': {
          if (typeof rawValue !== 'string') {
            throw new BadRequestException(
              'Value for text placeholder must be a string.',
            );
          }
          if (rawValue.length > MAX_TEXT_PLACEHOLDER_LENGTH) {
            throw new BadRequestException(
              `Text content exceeds maximum allowed length (${MAX_TEXT_PLACEHOLDER_LENGTH} characters).`,
            );
          }
          validatedValue = rawValue.trim();
          break;
        }

        case 'button': {
          if (typeof rawValue !== 'object' || rawValue === null) {
            throw new BadRequestException(
              'Value for button placeholder must be an object with text and optional url.',
            );
          }
          const valObj = rawValue as { text?: unknown; url?: unknown };
          if (typeof valObj.text !== 'string' || !valObj.text.trim()) {
            throw new BadRequestException('Button text is required.');
          }
          const buttonUrl =
            typeof valObj.url === 'string' ? valObj.url.trim() : undefined;
          if (buttonUrl && !isSafeUrl(buttonUrl)) {
            throw new BadRequestException(
              'Invalid or unsafe URL format provided for button placeholder.',
            );
          }
          validatedValue = {
            text: valObj.text.trim(),
            url: buttonUrl || undefined,
          };
          break;
        }

        case 'link': {
          if (typeof rawValue !== 'object' || rawValue === null) {
            throw new BadRequestException(
              'Value for link placeholder must be an object with text and url.',
            );
          }
          const linkObj = rawValue as { text?: unknown; url?: unknown };
          if (typeof linkObj.text !== 'string' || !linkObj.text.trim()) {
            throw new BadRequestException('Link text is required.');
          }
          if (typeof linkObj.url !== 'string' || !linkObj.url.trim()) {
            throw new BadRequestException('Link URL is required.');
          }
          if (!isSafeUrl(linkObj.url.trim())) {
            throw new BadRequestException(
              'Invalid or unsafe URL format provided for link placeholder.',
            );
          }
          validatedValue = {
            text: linkObj.text.trim(),
            url: linkObj.url.trim(),
          };
          break;
        }

        default: {
          validatedValue = rawValue;
          break;
        }
      }
    }

    const updatedPlaceholder: StoredPlaceholderItem = {
      ...currentPlaceholder,
      value: validatedValue,
    };

    placeholders[targetIdx] = updatedPlaceholder;

    design.placeholders_data = placeholders as unknown as Array<
      Record<string, unknown>
    >;
    await design.save();

    const filledCount = placeholders.filter(
      (p) => p.value !== null && p.value !== undefined && p.value !== '',
    ).length;

    return {
      placeholder: updatedPlaceholder,
      totalFilled: filledCount,
      totalCount: placeholders.length,
    };
  }

  async uploadPlaceholderImage(
    designId: string,
    placeholderId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    placeholder: StoredPlaceholderItem;
    totalFilled: number;
    totalCount: number;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Image file is required.');
    }

    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.placeholders_data || !Array.isArray(design.placeholders_data)) {
      throw new BadRequestException(
        'Design has not been analyzed yet. Please run AI analysis first.',
      );
    }

    const placeholders = [
      ...(design.placeholders_data as unknown as StoredPlaceholderItem[]),
    ];

    const targetIdx = placeholders.findIndex((p) => p.id === placeholderId);
    if (targetIdx === -1) {
      throw new NotFoundException(
        `Placeholder with ID '${placeholderId}' not found in design.`,
      );
    }

    const currentPlaceholder = placeholders[targetIdx];
    const phType = (currentPlaceholder.type || '').toLowerCase();
    if (phType !== 'image' && phType !== 'logo') {
      throw new BadRequestException(
        `Placeholder '${placeholderId}' is of type '${phType}', not 'image' or 'logo'.`,
      );
    }

    // Validate mime type
    const mimeType = file.mimetype.toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported image format '${file.mimetype}'. Allowed formats: JPG, PNG, WEBP, GIF, SVG.`,
      );
    }

    // Validate max file size
    const maxSizeBytes =
      Number(this.configService.get('MAX_PLACEHOLDER_IMAGE_SIZE')) ||
      DEFAULT_MAX_IMAGE_SIZE;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `Image file size (${file.size} bytes) exceeds maximum limit (${maxSizeBytes} bytes).`,
      );
    }

    // Inspect image dimensions safely
    let width: number | null = null;
    let height: number | null = null;
    try {
      const getImageDimensions =
        typeof imageSize === 'function'
          ? imageSize
          : (imageSize as unknown as { imageSize: typeof imageSize }).imageSize;
      const dimensions = getImageDimensions(file.buffer);
      width = dimensions?.width ?? null;
      height = dimensions?.height ?? null;
    } catch {
      // SVG or non-standard format
    }

    // Sanitize filename & create safe isolated storage key
    const rawFilename = path.basename(file.originalname || 'image.png');
    const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `designs/${userId}/${designId}/content/${placeholderId}/${Date.now()}_${sanitizedFilename}`;

    try {
      await this.fileStorage.saveFile(storageKey, file.buffer);
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to store placeholder image: ${err instanceof Error ? err.message : 'Storage error'}`,
      );
    }

    const imageValue: ImagePlaceholderValue = {
      storage_key: storageKey,
      file_name: sanitizedFilename,
      width,
      height,
      size: file.size,
      mime_type: file.mimetype,
    };

    const updatedPlaceholder: StoredPlaceholderItem = {
      ...currentPlaceholder,
      value: imageValue,
    };

    placeholders[targetIdx] = updatedPlaceholder;
    design.placeholders_data = placeholders as unknown as Array<
      Record<string, unknown>
    >;
    await design.save();

    const filledCount = placeholders.filter(
      (p) => p.value !== null && p.value !== undefined && p.value !== '',
    ).length;

    return {
      placeholder: updatedPlaceholder,
      totalFilled: filledCount,
      totalCount: placeholders.length,
    };
  }

  async getPlaceholderImageFile(
    designId: string,
    placeholderId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.placeholders_data || !Array.isArray(design.placeholders_data)) {
      throw new NotFoundException('Design placeholders not found.');
    }

    const placeholder = (
      design.placeholders_data as unknown as StoredPlaceholderItem[]
    ).find((p) => p.id === placeholderId);

    if (!placeholder) {
      throw new NotFoundException(`Placeholder '${placeholderId}' not found.`);
    }

    const val = placeholder.value as ImagePlaceholderValue | undefined;
    if (!val || !val.storage_key) {
      throw new NotFoundException(
        `No uploaded image found for placeholder '${placeholderId}'.`,
      );
    }

    const buffer = await this.fileStorage.getFile(val.storage_key);
    return {
      buffer,
      mimeType: val.mime_type || 'image/png',
      fileName: val.file_name || 'image.png',
    };
  }

  async clearPlaceholderValue(
    designId: string,
    placeholderId: string,
    userId: string,
  ): Promise<{
    placeholder: StoredPlaceholderItem;
    totalFilled: number;
    totalCount: number;
  }> {
    return this.updatePlaceholderValue(designId, placeholderId, userId, null);
  }

  async updateSectionStyles(
    designId: string,
    sectionId: string,
    userId: string,
    styles: {
      background_color?: string;
      text_color?: string;
      primary_color?: string;
      secondary_color?: string;
    },
  ): Promise<{
    sectionId: string;
    styles: Record<string, unknown>;
    layout: Record<string, unknown>;
  }> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.layout_data || typeof design.layout_data !== 'object') {
      throw new BadRequestException('Design layout data not found.');
    }

    const layoutData = { ...design.layout_data } as {
      width: number;
      height: number;
      sections: Array<{
        id: string;
        type: string;
        order?: number;
        bounds: { x: number; y: number; width: number; height: number };
        styles?: Record<string, unknown>;
      }>;
    };

    if (!Array.isArray(layoutData.sections)) {
      throw new BadRequestException('Design layout sections not found.');
    }

    const targetSection = layoutData.sections.find((s) => s.id === sectionId);
    if (!targetSection) {
      throw new NotFoundException(
        `Section with ID '${sectionId}' not found in layout.`,
      );
    }

    targetSection.styles = {
      ...(targetSection.styles || {}),
      ...styles,
    };

    design.layout_data = layoutData as unknown as Record<string, unknown>;
    await design.save();

    return {
      sectionId,
      styles: targetSection.styles,
      layout: layoutData as unknown as Record<string, unknown>,
    };
  }
}
