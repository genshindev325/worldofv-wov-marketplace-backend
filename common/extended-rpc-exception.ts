import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';

interface ExtendedRpcExceptionArgs {
  message: ExtendedRpcException['message'];
  code: ExtendedRpcException['code'];
}

export default class ExtendedRpcException extends RpcException {
  public readonly message: string;
  public readonly code: GrpcStatus;

  constructor({ message, code }: ExtendedRpcExceptionArgs) {
    super({ message, code });
    this.code = code;
  }
}
