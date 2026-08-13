import { HttpException, HttpStatus } from '@nestjs/common';

export class StorageException extends HttpException {
  constructor(message: string, statusCode = HttpStatus.INTERNAL_SERVER_ERROR) {
    super({ statusCode, message, error: 'Storage Error' }, statusCode);
  }
}

export class InvalidFileInputException extends StorageException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
