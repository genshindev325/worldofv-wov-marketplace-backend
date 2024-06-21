import { GrpcClientModule, GrpcOptionsModule } from '@app/grpc-options';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { NftModule } from '../nft.module';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
  imports: [
    forwardRef(() => NftModule),
    GrpcOptionsModule,
    GrpcClientModule.register(GrpcClientKind.IMAGE_THUMBNAIL),
    HttpModule,
  ],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
