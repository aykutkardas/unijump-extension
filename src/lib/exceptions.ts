export class CloudflareException extends Error {
  constructor() {
    super();
    this.name = CloudflareException.name;
  }
}

export class UnauthorizedException extends Error {
  constructor() {
    super();
    this.name = UnauthorizedException.name;
  }
}

export class ServiceBusyException extends Error {
  constructor() {
    super();
    this.name = ServiceBusyException.name;
  }
}
export class UnknownException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = UnknownException.name;
  }
}

const exceptions = [
  CloudflareException,
  UnauthorizedException,
  UnknownException,
  ServiceBusyException,
];

export const getExceptionByName = (exceptionName: string) => {
  const exception = exceptions.find((exception) => exception.name === exceptionName);

  return exception;
};
