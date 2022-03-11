import { CustomError } from 'ts-custom-error';

export enum GenericErrorType {
  NO_METHOD = 'NO_METHOD'
}

export class GenericError extends CustomError {
  getMessage(errorType: GenericErrorType): string {
    if (errorType === GenericErrorType.NO_METHOD) {
      return 'Method not implemented';
    }
    return 'An error occured';
  }
  constructor(errorType: GenericErrorType) {
    super();
    this.message = this.getMessage(errorType);
    this.name = 'GenericError';
  }
}
