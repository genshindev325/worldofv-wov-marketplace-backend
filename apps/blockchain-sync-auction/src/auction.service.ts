import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import { GetAuctionHistoryArgs } from '@generated/ts-proto/services/auction';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AuctionStatus } from '@prisma/client/auction';
import { PrismaClient } from '@prisma/client/blockchain';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { BlockchainEvent } from 'apps/gateway/src/blockchain/blockchain-event.response';
import { ZERO_ADDRESS } from 'common/constants';
import { formatPrice } from 'common/format-price.helper';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, tap } from 'rxjs';
import { ThorifyContract } from 'thorify';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  public contract: ThorifyContract;
  private grpcUser: UserServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    private readonly prisma: PrismaClient,
    private readonly contractService: ContractService,
  ) {}

  async onModuleInit() {
    this.contract = this.contractService.getContract(
      process.env.WOV_BID_AUCTION_ADDRESS,
      'wov-auction',
    );

    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
  }

  private async getLastBlockNumberForEvent(
    auctionId: string,
    event:
      | 'auctionExecuted'
      | 'cancelAuctionEvent'
      | 'newAuction'
      | 'newBid'
      | 'timeUpdate',
  ) {
    return await this.contract
      .getPastEvents(event, {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { auctionId },
      })
      .then((data) =>
        data.sort(
          (a, b) =>
            (b.blockNumber || b.meta.blockNumber) -
            (a.blockNumber || a.meta.blockNumber),
        ),
      )
      .then((events) =>
        events.length
          ? events[0].blockNumber || events[0].meta.blockNumber
          : null,
      );
  }

  private async getUpdatedAt(auctionId: string, status: AuctionStatus) {
    switch (status) {
      case AuctionStatus.SETTLED:
        return await this.getLastBlockNumberForEvent(
          auctionId,
          'auctionExecuted',
        );
      case AuctionStatus.CANCELLED:
        return await this.getLastBlockNumberForEvent(
          auctionId,
          'cancelAuctionEvent',
        );
    }

    const blockNumbers = await Promise.all([
      this.getLastBlockNumberForEvent(auctionId, 'newBid'),
      this.getLastBlockNumberForEvent(auctionId, 'timeUpdate'),
    ]).then((data) => data?.sort((a, b) => b - a));

    return blockNumbers?.at(0) || null;
  }

  async getAuction(
    auctionId: string,
    editionId: string,
    smartContractAddress: string,
  ) {
    const auctionData = await this.contract.methods
      .tokenToAuction(auctionId, smartContractAddress, editionId)
      .call();

    let tokenId = editionId;

    // If the token comes from marketplace address extract the tokenId from the edition
    if (
      _.isEqualWith(
        smartContractAddress,
        process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
        isSameAddress,
      )
    ) {
      tokenId = tokenId.replace(/.{5}$/, '00000');
    }

    // If the maxBidUser is equal to address(0) set as NULL
    const highestBidderAddress =
      auctionData.maxBidUser !== ZERO_ADDRESS ? auctionData.maxBidUser : null;

    let isCancelled = false;
    if (!highestBidderAddress) {
      const cancelEvent = await this.getLastBlockNumberForEvent(
        auctionId,
        'cancelAuctionEvent',
      );

      isCancelled = !!cancelEvent;
    }

    // Get the status based on the data
    const status = auctionData.isClosed
      ? isCancelled
        ? AuctionStatus.CANCELLED
        : AuctionStatus.SETTLED
      : auctionData.endTime * 1000 <= Date.now()
      ? AuctionStatus.TO_SETTLE
      : AuctionStatus.ACTIVE;

    // If the addressVIP180 is equal to address(0) set as NULL
    const addressVIP180 =
      auctionData.addressVIP180 !== ZERO_ADDRESS
        ? auctionData.addressVIP180
        : null;

    // If the auction is settled, get the settlorAddress from 'auctionExecuted' event
    let settlorAddress = null;
    if (status === AuctionStatus.SETTLED) {
      const settleAuctionEvents = await this.contract.getPastEvents(
        'auctionExecuted',
        {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { auctionId },
        },
      );

      if (settleAuctionEvents.length) {
        settlorAddress = settleAuctionEvents[0].meta.txOrigin;
      }
    }

    // Get the createdAt and updatedAt block number
    const createdAt = await this.getLastBlockNumberForEvent(
      auctionId,
      'newAuction',
    );

    const updatedAt = (await this.getUpdatedAt(auctionId, status)) || createdAt;

    // Return the object to save into the database
    return {
      auctionId,
      tokenId,
      editionId,
      smartContractAddress,
      sellerAddress: auctionData.seller,
      highestBidderAddress,
      settlorAddress,
      reservePrice: formatPrice(auctionData.price),
      highestBid: formatPrice(auctionData.maxBid),
      addressVIP180,
      startingTime: new Date(auctionData.startingTime * 1000),
      endTime: new Date(auctionData.endTime * 1000),
      status,
      createdAt,
      updatedAt,
    };
  }

  private getUserByEvent(
    event: string,
    returnValues: any,
    meta: any,
  ): string | null {
    switch (event) {
      case 'newAuction':
        return returnValues.seller;
      case 'newBid':
        return returnValues.maxBidUser;
      case 'auctionExecuted':
      case 'auctionCancelled':
        return meta.txOrigin;
    }

    return null;
  }

  getPriceByEvent(event: string, returnValues: any): string | null {
    switch (event) {
      case 'newAuction':
      case 'auctionExecuted':
        return returnValues.price;
      case 'newBid':
        return returnValues.maxBid;
    }

    return null;
  }

  async getHistory(args: GetAuctionHistoryArgs) {
    const logs = await this.prisma.blockchainEvent.findMany({
      where: {
        event: args.bidsOnly
          ? 'newBid'
          : {
              in: [
                'newAuction',
                'newBid',
                'cancelAuctionEvent',
                'timeUpdate',
                'auctionExecuted',
              ],
            },
        returnValues: {
          path: ['auctionId'],
          equals: args.auctionId,
        },
      },
    });

    const history = logs
      .map(({ jobId, event, meta, returnValues }: BlockchainEvent) => ({
        id: jobId,
        event: event,
        timestamp: meta.blockTimestamp,
        txID: meta.txID,
        auctionId: returnValues.auctionId,
        smartContractAddress: returnValues.nft,
        tokenId: returnValues.tokenId,
        user: {
          address: this.getUserByEvent(event, returnValues, meta),
        } as any,
        price: this.getPriceByEvent(event, returnValues),
        updatedDate: event === 'timeUpdate' ? returnValues.newEndTime : null,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const uniqueAddresses = _.uniq(_.map(history, 'user.address'));

    await lastValueFrom(
      this.grpcUser
        .findMany(
          encodeSerializedJson<PrismaUser.UserFindManyArgs>({
            select: {
              address: true,
              profileId: true,
              name: true,
              customUrl: true,
              verified: true,
              verifiedLevel: true,
              blacklisted: true,
              profileImageUrl: true,
            },
            where: { address: { in: uniqueAddresses } },
          }),
        )
        .pipe(
          map((res) => res?.users || []),
          tap((users) => {
            for (const el of history) {
              el.user = users.find((user) =>
                isSameAddress(el.user.address, user.address),
              );
            }
          }),
          catchError((err) => {
            this.logger.warn(
              'Error while fetching user for auction history',
              err,
            );

            return [];
          }),
        ),
    );

    return history;
  }

  async getParticipants(auctionId: string) {
    // Get unique auction participants address
    const participantsAddress = await this.prisma.blockchainEvent
      .findMany({
        select: { meta: true },
        where: {
          returnValues: {
            path: ['auctionId'],
            equals: auctionId,
          },
        },
      })
      .then((res) =>
        Array.from(
          new Set(res.map((row) => (row.meta as any).txOrigin?.toLowerCase())),
        ).filter((el) => !!el),
      );

    if (!participantsAddress.length) {
      return [];
    }

    return await lastValueFrom(
      this.grpcUser
        .findMany(
          encodeSerializedJson<PrismaUser.UserFindManyArgs>({
            where: { address: { in: participantsAddress } },
          }),
        )
        .pipe(
          map(({ users }) => users),
          catchError((err) => {
            this.logger.warn(
              `Error while fetching auction participants for auction ${auctionId}`,
              err,
            );

            return of([]);
          }),
        ),
    );
  }
}
