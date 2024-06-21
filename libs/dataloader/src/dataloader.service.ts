import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
  UserMediaType,
} from '@generated/ts-proto/services/thumbnail';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import DataLoader from 'dataloader';
import { lastValueFrom, map } from 'rxjs';
import Web3 from 'web3';

@Injectable()
export class DataloaderService implements OnModuleInit {
  private grpcThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly thumbnailClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcThumbnail = this.thumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  private async getUserAssets(addresses: string[]) {
    return lastValueFrom(
      this.grpcThumbnail
        .getManyUserAssets({
          addresses: addresses,
          mediaType: UserMediaType.AVATAR,
        })
        .pipe(
          map(({ items }) =>
            addresses.map(
              (a) => items?.[Web3.utils.toChecksumAddress(a)]?.assets || [],
            ),
          ),
        ),
    );
  }

  async getUserAssetsLoader() {
    return new DataLoader(
      (addresses: string[]) => this.getUserAssets(addresses),
      { cacheKeyFn: Web3.utils.toChecksumAddress },
    );
  }
}
