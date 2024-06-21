import { StatusObjectWithProgress } from '@grpc/grpc-js/src/load-balancing-call';
import { DynamicModule, Module } from '@nestjs/common';
import { ClientGrpcProxy, ClientsModule } from '@nestjs/microservices';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { GrpcClientKind } from './grpc-client-kind';
import { GrpcOptionsModule } from './grpc-options.module';
import { GrpcOptionsService } from './grpc-options.service';

// Make sure all errors coming from RPC calls are an instance of
// ExtendedRpcException instead of a plain Error.
// See https://docs.nestjs.com/microservices/custom-transport#message-serialization
class ErrorHandlingGrpcProxy extends ClientGrpcProxy {
  serializeError({ code, details }: Error & StatusObjectWithProgress) {
    return new ExtendedRpcException({ code, message: details });
  }
}

@Module({})
export class GrpcClientModule {
  static register(...kinds: GrpcClientKind[]): DynamicModule {
    return ClientsModule.registerAsync(
      kinds.map((kind) => ({
        name: kind.toString(),
        imports: [GrpcOptionsModule],
        inject: [GrpcOptionsService],
        useFactory: (grpcOptionsService: GrpcOptionsService) => {
          const options = grpcOptionsService.getGrpcOptions(kind);
          return { ...options, customClass: ErrorHandlingGrpcProxy };
        },
      })),
    );
  }
}
