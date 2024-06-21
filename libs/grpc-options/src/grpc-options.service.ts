import { ChannelOptions } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcOptions, Transport } from '@nestjs/microservices';
import path from 'path';
import { GrpcClientKind } from './grpc-client-kind';

const PROTO_PATH = path.join(__dirname, '../../../protos');
const SERVICES_PATH = path.join(PROTO_PATH, 'services');

/**
 * @grpc/proto-loader options
 * See https://github.com/grpc/grpc-node/blob/master/packages/proto-loader/README.md
 *
 * WARNING: make sure the configuration matches the generation options passed
 * to ts-proto!
 */
const LOADER_OPTIONS: GrpcOptions['options']['loader'] = {
  keepCase: true,
  longs: String,
  enums: String,
  includeDirs: [PROTO_PATH],
};

const CHANNEL_OPTIONS: ChannelOptions = {
  'grpc.max_receive_message_length': -1,
  'grpc.service_config': JSON.stringify({
    loadBalancingConfig: [{ round_robin: {} }],
  }),
};

const PACKAGE_NAME_MAP: Record<GrpcClientKind, string> = {
  [GrpcClientKind.ACTIVITY]: 'activity',
  [GrpcClientKind.ADMIN]: 'admin',
  [GrpcClientKind.APLOS_STATS]: 'aplos_stats',
  [GrpcClientKind.AUCTION]: 'auction',
  [GrpcClientKind.AUTH]: 'auth',
  [GrpcClientKind.BLOCKCHAIN_STATS]: 'blockchain_stats',
  [GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION]: 'blockchain_sync_auction',
  [GrpcClientKind.BLOCKCHAIN_SYNC_PFP]: 'blockchain_sync_pfp',
  [GrpcClientKind.BLOCKCHAIN_SYNC_STAKE]: 'blockchain_sync_stake',
  [GrpcClientKind.BUSINESS]: 'business',
  [GrpcClientKind.EMAIL]: 'email',
  [GrpcClientKind.IMAGE_THUMBNAIL]: 'thumbnail',
  [GrpcClientKind.MARKETPLACE]: 'marketplace',
  [GrpcClientKind.NFT_IMPORT]: 'nft_import',
  [GrpcClientKind.NFT]: 'nft',
  [GrpcClientKind.OFFER]: 'offer',
  [GrpcClientKind.PRICE_CONVERSION]: 'price_conversion',
  [GrpcClientKind.SALE]: 'sale',
  [GrpcClientKind.USER]: 'user',
};

const PROTO_FILE_MAP: Record<GrpcClientKind, string> = {
  [GrpcClientKind.ACTIVITY]: 'activity.proto',
  [GrpcClientKind.ADMIN]: 'admin.proto',
  [GrpcClientKind.APLOS_STATS]: 'aplos_stats.proto',
  [GrpcClientKind.AUCTION]: 'auction.proto',
  [GrpcClientKind.AUTH]: 'auth.proto',
  [GrpcClientKind.BLOCKCHAIN_STATS]: 'blockchain_stats.proto',
  [GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION]: 'blockchain_sync_auction.proto',
  [GrpcClientKind.BLOCKCHAIN_SYNC_PFP]: 'blockchain_sync_pfp.proto',
  [GrpcClientKind.BLOCKCHAIN_SYNC_STAKE]: 'blockchain_sync_stake.proto',
  [GrpcClientKind.BUSINESS]: 'business.proto',
  [GrpcClientKind.EMAIL]: 'email.proto',
  [GrpcClientKind.IMAGE_THUMBNAIL]: 'thumbnail.proto',
  [GrpcClientKind.MARKETPLACE]: 'marketplace.proto',
  [GrpcClientKind.NFT_IMPORT]: 'nft_import.proto',
  [GrpcClientKind.NFT]: 'nft.proto',
  [GrpcClientKind.OFFER]: 'offer.proto',
  [GrpcClientKind.PRICE_CONVERSION]: 'price_conversion.proto',
  [GrpcClientKind.SALE]: 'sale.proto',
  [GrpcClientKind.USER]: 'user.proto',
};

const SERVICE_NAME_MAP: Record<GrpcClientKind, string> = {
  [GrpcClientKind.ACTIVITY]: 'ACTIVITY_SERVICE_NAME',
  [GrpcClientKind.ADMIN]: 'ADMIN_SERVICE_NAME',
  [GrpcClientKind.APLOS_STATS]: 'APLOS_STATS_SERVICE_NAME',
  [GrpcClientKind.AUCTION]: 'AUCTION_SERVICE_NAME',
  [GrpcClientKind.AUTH]: 'AUTH_SERVICE_NAME',
  [GrpcClientKind.BLOCKCHAIN_STATS]: 'BLOCKCHAIN_STATS_SERVICE_NAME',
  [GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION]:
    'BLOCKCHAIN_SYNC_AUCTION_SERVICE_NAME',
  [GrpcClientKind.BLOCKCHAIN_SYNC_PFP]: 'BLOCKCHAIN_SYNC_PFP_SERVICE_NAME',
  [GrpcClientKind.BLOCKCHAIN_SYNC_STAKE]: 'BLOCKCHAIN_SYNC_STAKE_SERVICE_NAME',
  [GrpcClientKind.BUSINESS]: 'BUSINESS_SERVICE_NAME',
  [GrpcClientKind.EMAIL]: 'EMAIL_SERVICE_NAME',
  [GrpcClientKind.IMAGE_THUMBNAIL]: 'IMAGE_THUMBNAIL_SERVICE_NAME',
  [GrpcClientKind.MARKETPLACE]: 'MARKETPLACE_SERVICE_NAME',
  [GrpcClientKind.NFT_IMPORT]: 'NFT_IMPORT_SERVICE_NAME',
  [GrpcClientKind.NFT]: 'NFT_SERVICE_NAME',
  [GrpcClientKind.OFFER]: 'OFFER_SERVICE_NAME',
  [GrpcClientKind.PRICE_CONVERSION]: 'PRICE_CONVERSION_SERVICE_NAME',
  [GrpcClientKind.SALE]: 'SALE_SERVICE_NAME',
  [GrpcClientKind.USER]: 'USER_SERVICE_NAME',
};

const SERVICE_PORT_MAP: Record<GrpcClientKind, string> = {
  [GrpcClientKind.ACTIVITY]: 'ACTIVITY_SERVICE_GRPC_PORT',
  [GrpcClientKind.ADMIN]: 'ADMIN_SERVICE_GRPC_PORT',
  [GrpcClientKind.APLOS_STATS]: 'APLOS_STATS_SERVICE_GRPC_PORT',
  [GrpcClientKind.AUCTION]: 'AUCTION_SERVICE_GRPC_PORT',
  [GrpcClientKind.AUTH]: 'AUTH_SERVICE_GRPC_PORT',
  [GrpcClientKind.BLOCKCHAIN_STATS]: 'BLOCKCHAIN_STATS_SERVICE_GRPC_PORT',
  [GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION]:
    'BLOCKCHAIN_SYNC_AUCTION_SERVICE_GRPC_PORT',
  [GrpcClientKind.BLOCKCHAIN_SYNC_PFP]: 'BLOCKCHAIN_SYNC_PFP_SERVICE_GRPC_PORT',
  [GrpcClientKind.BLOCKCHAIN_SYNC_STAKE]:
    'BLOCKCHAIN_SYNC_STAKE_SERVICE_GRPC_PORT',
  [GrpcClientKind.BUSINESS]: 'BUSINESS_SERVICE_GRPC_PORT',
  [GrpcClientKind.EMAIL]: 'EMAIL_SERVICE_GRPC_PORT',
  [GrpcClientKind.IMAGE_THUMBNAIL]: 'IMAGE_THUMBNAIL_SERVICE_GRPC_PORT',
  [GrpcClientKind.MARKETPLACE]: 'MARKETPLACE_SERVICE_GRPC_PORT',
  [GrpcClientKind.NFT_IMPORT]: 'NFT_IMPORT_SERVICE_GRPC_PORT',
  [GrpcClientKind.NFT]: 'NFT_SERVICE_GRPC_PORT',
  [GrpcClientKind.OFFER]: 'OFFER_SERVICE_GRPC_PORT',
  [GrpcClientKind.PRICE_CONVERSION]: 'PRICE_CONVERSION_SERVICE_GRPC_PORT',
  [GrpcClientKind.SALE]: 'SALE_SERVICE_GRPC_PORT',
  [GrpcClientKind.USER]: 'USER_SERVICE_GRPC_PORT',
};

@Injectable()
export class GrpcOptionsService {
  constructor(private readonly configService: ConfigService) {}

  getGrpcOptions(kind: GrpcClientKind): GrpcOptions {
    const host = this.configService.getOrThrow(SERVICE_NAME_MAP[kind]);
    const port = this.configService.getOrThrow(SERVICE_PORT_MAP[kind]);

    return {
      transport: Transport.GRPC,
      options: {
        package: PACKAGE_NAME_MAP[kind],
        protoPath: path.join(SERVICES_PATH, `${PROTO_FILE_MAP[kind]}`),
        url: `${host}:${port}`,
        loader: LOADER_OPTIONS,
        channelOptions: CHANNEL_OPTIONS,
      },
    };
  }
}
