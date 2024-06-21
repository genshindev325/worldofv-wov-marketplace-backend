import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client/nft';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MetadataService implements OnModuleInit {
  private grpcToken: TokenServiceClient;

  private baseUrl: string;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.getOrThrow('SITE_LINK').replace(/\/$/, '');
  }

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
  }

  async getMetadata(smartContractAddress: string, editionId: string) {
    const tokenId = getTokenIdFromEditionId(smartContractAddress, editionId);

    const token = await lastValueFrom(
      this.grpcToken.findUnique(
        encodeSerializedJson<Prisma.TokenFindUniqueArgs>({
          where: {
            tokenId_smartContractAddress: {
              smartContractAddress,
              tokenId: tokenId,
            },
          },
        }),
      ),
    );

    const externalUrl = `${this.baseUrl}/token/${token.smartContractAddress}/${token.tokenId}`;

    // See https://docs.opensea.io/docs/metadata-standards#metadata-structure
    // for the standard metadata format.

    return {
      contract_address: token.smartContractAddress,
      token_id: tokenId,
      name: token.name,
      description: token.description,
      attributes: token.attributes,
      image: token.imageUrl,
      image_mime_type: token.imageMimeType,
      rank: token.rank,
      rarity: token.score,
      edition_count: token.editionsCount,
      categories: token.categories || [],
      minted_at: token.mintedAt > 0 ? token.mintedAt : null,
      creator: token.creatorAddress,
      external_url: externalUrl,
    };
  }
}
