import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  EditionServiceClient,
  EDITION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  FindMinimumOffersForUserArgs,
  MinimumOfferServiceController,
  MinimumOfferServiceControllerMethods,
  UpsertMinimumOfferArgs,
} from '@generated/ts-proto/services/offer';
import { MinimumOffer } from '@generated/ts-proto/types/minimum-offer';
import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { PrismaClient } from '@prisma/client/offer';
import { formatPrice } from 'common/format-price.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { lastValueFrom } from 'rxjs';
import Web3 from 'web3';

@Controller()
@MinimumOfferServiceControllerMethods()
export class MinimumOfferController
  implements OnModuleInit, MinimumOfferServiceController
{
  private readonly logger = new Logger(MinimumOfferController.name);

  private grpcCollection: CollectionServiceClient;
  private grpcEdition: EditionServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit() {
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
  }

  async findMinimumOffersForUser({
    userAddress,
  }: FindMinimumOffersForUserArgs) {
    const [{ editions }, dbMinimumOffers] = await Promise.all([
      lastValueFrom(
        this.grpcEdition.findMany(
          encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
            select: { smartContractAddress: true },
            where: {
              ownerAddress: userAddress,
              smartContractAddress: {
                not: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
              },
            },
          }),
        ),
      ),

      this.prisma.minimumOffer.findMany({
        where: {
          userAddress,
          AND: [{ price: { not: 0 } }, { price: { not: null } }],
        },
      }),
    ]);

    const minimumOffers = new Map<string, MinimumOffer>();

    const editionCounts = _.countBy(editions, (e) =>
      Web3.utils.toChecksumAddress(e.smartContractAddress),
    );

    // Add an entry for each collection where the owner collected one or more
    // editions.
    for (const smartContractAddress in editionCounts) {
      minimumOffers.set(smartContractAddress, {
        ...minimumOffers.get(smartContractAddress),
        userAddress,
        smartContractAddress,
        editionCount: editionCounts[smartContractAddress],
      });
    }

    for (const offer of dbMinimumOffers) {
      const address = Web3.utils.toChecksumAddress(offer.smartContractAddress);

      if (minimumOffers.has(address)) {
        const entry = minimumOffers.get(address);
        entry.price = formatPrice(offer.price);
      }
    }

    const { collections } = await lastValueFrom(
      this.grpcCollection.findMany(
        encodeSerializedJson<PrismaNft.CollectionFindManyArgs>({
          where: {
            smartContractAddress: { in: Array.from(minimumOffers.keys()) },
            isVisible: true,
          },
          orderBy: { name: 'asc' },
        }),
      ),
    );

    const items = (collections ?? []).reduce((items, c) => {
      const address = Web3.utils.toChecksumAddress(c.smartContractAddress);
      items.push({ ...minimumOffers.get(address), collection: c });
      return items;
    }, []);

    return {
      items: Array.from(items),
    };
  }

  async upsert(args: UpsertMinimumOfferArgs) {
    const offer = await this.prisma.minimumOffer.upsert({
      where: {
        smartContractAddress_userAddress: {
          smartContractAddress: args.smartContractAddress,
          userAddress: args.userAddress,
        },
      },
      create: args,
      update: args,
    });

    return { ...offer, price: offer.price?.toString() };
  }
}
