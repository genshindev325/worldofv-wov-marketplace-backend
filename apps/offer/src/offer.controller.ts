import { PriceConversionCacheService } from '@app/price-conversion-cache';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  FindHighestOfferArgs,
  FindManyHighestOffersArgs,
  OfferServiceController,
  OfferServiceControllerMethods,
  SendOfferEmailArgs,
  UpsertOfferArgs,
} from '@generated/ts-proto/services/offer';
import { SerializedJson } from '@generated/ts-proto/types/serialized_json';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  Prisma,
  Prisma as PrismaOffer,
  PrismaClient,
} from '@prisma/client/offer';
import ExtendedRpcException from 'common/extended-rpc-exception';
import { decodeSerializedJson } from 'common/serialized-json';
import { catchError, lastValueFrom, of } from 'rxjs';
import { OfferEmailService } from './offer-email.service';
import { OfferService } from './offer.service';

@Controller()
@OfferServiceControllerMethods()
export class OfferController implements OnModuleInit, OfferServiceController {
  private readonly logger = new Logger(OfferController.name);

  constructor(
    @Inject(REDIS_CLIENT_PROXY) private readonly client: ClientProxy,
    private readonly prisma: PrismaClient,
    private readonly offerService: OfferService,
    private readonly offerEmailService: OfferEmailService,
    private readonly priceConversionCache: PriceConversionCacheService,
  ) {}

  onModuleInit() {}

  async findUnique(args: SerializedJson) {
    const params = decodeSerializedJson<PrismaOffer.OfferFindUniqueArgs>(args);
    const offer = await this.prisma.offer.findUnique(params);

    if (!offer) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: "Couldn't find offer.",
      });
    }

    return this.offerService.prismaOfferToGrpc(offer);
  }

  async findFirst(args: SerializedJson) {
    const params = decodeSerializedJson<PrismaOffer.OfferFindFirstArgs>(args);
    const offer = await this.prisma.offer.findFirst(params);

    if (!offer) {
      throw new ExtendedRpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Couldn't find offer."`,
      });
    }

    return this.offerService.prismaOfferToGrpc(offer);
  }

  async findMany(args: SerializedJson) {
    const params = decodeSerializedJson<Prisma.OfferFindManyArgs>(args);
    const prismaArgs = params;
    const offers = await this.prisma.offer.findMany(prismaArgs);
    return { offers: offers.map(this.offerService.prismaOfferToGrpc) };
  }

  async findHighest(args: FindHighestOfferArgs) {
    const offer = await this.offerService.getHighestOffer(
      args.smartContractAddress,
      args?.tokenId,
    );

    return { offer };
  }

  async findManyHighest(args: FindManyHighestOffersArgs) {
    const offers = await this.offerService.getHighestOffersForTokens(
      args.smartContractAddress,
      args.tokenIds || [],
    );

    return { offers };
  }

  async count(args: SerializedJson): Promise<{ value: number }> {
    const params = decodeSerializedJson<Prisma.OfferCountArgs>(args);
    const value = await this.prisma.offer.count(params);
    return { value };
  }

  async upsert(args: UpsertOfferArgs) {
    const offer = await this.offerService.upsert(args.where, args.data);

    // We want to rebuild the offers cache after an offer is modified since
    // the marketplace service will need it to update the database.
    await this.offerService.refreshHighestOffersCache();

    await lastValueFrom(
      this.client.send('UpdateOffer', offer).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.upsert.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return this.offerService.prismaOfferToGrpc(offer);
  }

  async sendEmail(args: SendOfferEmailArgs) {
    const value = await this.offerEmailService.sendEmail(args);
    return { value };
  }
}
