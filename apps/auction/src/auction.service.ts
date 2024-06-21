import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  BlockchainSyncAuctionServiceClient,
  BLOCKCHAIN_SYNC_AUCTION_SERVICE_NAME,
} from '@generated/ts-proto/services/blockchain_sync_auction';
import {
  EmailServiceClient,
  EMAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/email';
import {
  CollectionServiceClient,
  COLLECTION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/thumbnail';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { Asset, AssetSize } from '@generated/ts-proto/types/asset';
import { Auction } from '@generated/ts-proto/types/auction';
import { Collection } from '@generated/ts-proto/types/collection';
import { Token } from '@generated/ts-proto/types/token';
import { User } from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  Auction as PrismaAuction,
  AuctionStatus,
  PrismaClient,
} from '@prisma/client/auction';
import { TemplateKey } from '@prisma/client/email';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { MailData } from '@sendgrid/helpers/classes/mail';
import { formatPricePretty } from 'common/format-price-pretty.helper';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import { encodeSerializedJson } from 'common/serialized-json';
import { toShortAddress } from 'common/to-short-address';
import { CronJob } from 'cron';
import objectHash from 'object-hash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';

@Injectable()
export class AuctionService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(AuctionService.name);

  private grpcEmail: EmailServiceClient;
  private grpcUser: UserServiceClient;
  private grpcToken: TokenServiceClient;
  private grpcCollection: CollectionServiceClient;
  private grpcImageThumbnail: ImageThumbnailServiceClient;
  private grpcBlockchainSyncAuction: BlockchainSyncAuctionServiceClient;

  constructor(
    @Inject(GrpcClientKind.USER)
    private readonly userClient: ClientGrpc,

    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    @Inject(GrpcClientKind.BLOCKCHAIN_SYNC_AUCTION)
    private readonly blockchainSyncAuctionClient: ClientGrpc,

    @Inject(GrpcClientKind.EMAIL)
    private readonly emailClient: ClientGrpc,

    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit() {
    this.grpcEmail = this.emailClient.getService(EMAIL_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcCollection = this.nftClient.getService(COLLECTION_SERVICE_NAME);

    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );

    this.grpcBlockchainSyncAuction =
      this.blockchainSyncAuctionClient.getService(
        BLOCKCHAIN_SYNC_AUCTION_SERVICE_NAME,
      );
  }

  // On application bootstrap, process the auctions from the database
  // to handle all the crons and settle checks
  async onApplicationBootstrap() {
    const activeAuctions = await this.prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
    });

    const now = new Date();
    const timeRange = 60 * 60 * 1000; // 1 Hour
    const endingSoonTimeLimit = new Date(now.getTime() + timeRange);

    let countEndedAuctions = 0;
    let countEndingSoonAuctions = 0;

    for (const auction of activeAuctions) {
      // If the auction has ended, trigger the onAuctionEnd method
      if (auction.endTime <= now) {
        await this.onAuctionEnd(auction.auctionId);
        countEndedAuctions++;

        continue;
      }

      // If the auction is on-going, schedule the end cron-job
      await this.scheduleAuctionEnd(auction);

      // If the auction is within the ending soon limits, schedule the cron-job
      if (auction.endTime > endingSoonTimeLimit) {
        await this.scheduleAuctionEndingSoon(auction);
        countEndingSoonAuctions++;
      }
    }

    this.logger.verbose(
      `Found ${countEndedAuctions} auctions to set as TO_SETTLED`,
    );

    this.logger.verbose(
      `Found ${countEndingSoonAuctions} auctions scheduled as ENDING_SOON`,
    );

    this.logger.verbose(
      `Found ${
        activeAuctions.length - countEndedAuctions
      } auctions currently ACTIVE`,
    );
  }

  // TODO: Avoid to use CronTab because are not scalable across multiple services
  async scheduleAuctionEnd(auction: PrismaAuction) {
    const cronId = objectHash({
      event: 'auctionEnd',
      auctionId: auction.auctionId,
    });

    if (this.schedulerRegistry.doesExist('cron', cronId)) {
      this.logger.verbose(
        `Another cron scheduled for "auctionEnd" of auction #${auction.auctionId}`,
      );

      this.schedulerRegistry.deleteCronJob(cronId);
    }

    const ended = auction.endTime <= new Date();

    if (ended) {
      this.logger.verbose(`Auction #${auction.auctionId} already ended`);
      return;
    }

    const cron = new CronJob(
      auction.endTime,
      this.onAuctionEnd.bind(this, auction.auctionId),
    );

    this.schedulerRegistry.addCronJob(cronId, cron);
    cron.start();

    this.logger.log(
      `Cron #${cronId} scheduled at ${auction.endTime} for auctionEnd of #${auction.auctionId}`,
    );
  }

  // TODO: Avoid to use CronTab because are not scalable across multiple services
  async scheduleAuctionEndingSoon(auction: PrismaAuction) {
    const cronId = objectHash({
      event: 'auctionEndingSoon',
      auctionId: auction.auctionId,
    });

    if (this.schedulerRegistry.doesExist('cron', cronId)) {
      this.logger.verbose(
        `Another cron scheduled for "auctionEndingSoon" of auction #${auction.auctionId}`,
      );

      this.schedulerRegistry.deleteCronJob(cronId);
    }

    const ended = auction.endTime <= new Date();

    if (ended) {
      this.logger.verbose(`Auction #${auction.auctionId} already ended`);
      return;
    }

    // Schedule the ending soon time 1 hour before the end of the auction
    const timeRange = 60 * 60 * 1000; // 1 Hour
    const endingSoonTime = new Date(auction.endTime.getTime() - timeRange);

    const cron = new CronJob(
      endingSoonTime,
      this.onAuctionEndingSoon.bind(this, auction.auctionId),
    );

    this.schedulerRegistry.addCronJob(cronId, cron);
    cron.start();

    this.logger.log(
      `Cron #${cronId} scheduled at ${endingSoonTime} for auctionEndingSoon of #${auction.auctionId}`,
    );
  }

  async onAuctionEnd(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { auctionId },
      rejectOnNotFound: false,
    });

    if (!auction) {
      this.logger.error(`Couldn't find auction #${auctionId}`);
    }

    const ended = auction.endTime <= new Date();

    if (!ended) {
      return this.logger.error(
        `The auction #${auction.auctionId} is not ended yet`,
      );
    }

    // Check if the auction can be moved in TO_SETTLE status
    if (
      auction.status === AuctionStatus.CANCELLED ||
      auction.status === AuctionStatus.SETTLED
    ) {
      return this.logger.error(
        `The auction #${auction.auctionId} can't be moved to ${AuctionStatus.TO_SETTLE} status because it is in ${auction.status} status`,
      );
    }

    return await this.prisma.auction
      .update({
        where: { auctionId: auction.auctionId },
        data: { status: AuctionStatus.TO_SETTLE },
      })
      .then(async (updatedAuction) => {
        this.logger.log(
          `Auction #${updatedAuction.auctionId} set as TO_SETTLE`,
        );

        // Delete any hanging cron job
        const cronId_auctionEnd = objectHash({
          event: 'auctionEnd',
          auctionId: auction.auctionId,
        });

        const cronId_auctionEndingSoon = objectHash({
          event: 'auctionEndingSoon',
          auctionId: auction.auctionId,
        });

        this.schedulerRegistry.deleteCronJob(cronId_auctionEnd);
        this.schedulerRegistry.deleteCronJob(cronId_auctionEndingSoon);

        // Send the emails if needed
        await this.handleSendEmail(auction, updatedAuction);

        return updatedAuction;
      })
      .catch((err) => {
        this.logger.error(
          `Error while updating auction #${auction.auctionId}`,
          err,
        );

        return undefined;
      });
  }

  async onAuctionEndingSoon(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { auctionId },
      rejectOnNotFound: false,
    });

    const [emailData, bidder] = await Promise.all([
      this.getEmailData(auction),
      this.getBidderForAuction(auction),
    ]);

    await this.sendEmail(undefined, auction, {
      emailData,
      bidder,
      templateKey: TemplateKey.AUCTION_ENDING_SOON,
    });
  }

  async getTokenForAuction(auction: PrismaAuction): Promise<Token | null> {
    if (!auction.tokenId) return null;

    return lastValueFrom(
      this.grpcToken
        .findUnique(
          encodeSerializedJson<PrismaNft.TokenFindUniqueArgs>({
            where: {
              tokenId_smartContractAddress: {
                tokenId: auction.tokenId,
                smartContractAddress: auction.smartContractAddress,
              },
            },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) return of(null);
            else return throwError(() => err);
          }),
        ),
    );
  }

  async getCollectionForAuction(
    auction: PrismaAuction,
  ): Promise<Collection | null> {
    return await lastValueFrom(
      this.grpcCollection
        .findOne({ smartContractAddress: auction.smartContractAddress })
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) return of(null);
            else return throwError(() => err);
          }),
        ),
    );
  }

  async getSellerForAuction(auction: PrismaAuction): Promise<User> {
    return lastValueFrom(
      this.grpcUser
        .findUnique(
          encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
            where: { address: auction.sellerAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of({ address: auction.sellerAddress, name: '' } as User);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );
  }

  async getBidderForAuction(auction: PrismaAuction): Promise<User> {
    if (!auction.highestBidderAddress) {
      return undefined;
    }

    return lastValueFrom(
      this.grpcUser
        .findUnique(
          encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
            where: { address: auction.highestBidderAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of({
                address: auction.highestBidderAddress,
                name: '',
              } as User);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );
  }

  async getSettlorForAuction(auction: PrismaAuction): Promise<User> {
    if (!auction.settlorAddress) {
      return undefined;
    }

    return lastValueFrom(
      this.grpcUser
        .findUnique(
          encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
            where: { address: auction.settlorAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of({
                address: auction.settlorAddress,
                name: '',
              } as User);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );
  }

  async getAssetForAuction(auction: PrismaAuction): Promise<Asset> {
    return await lastValueFrom(
      this.grpcImageThumbnail
        .getTokenAssets({
          smartContractAddress: auction.smartContractAddress,
          tokenId: auction.tokenId,
          filters: { sizes: [AssetSize.STATIC_COVER_512, AssetSize.ORIGINAL] },
        })
        .pipe(map(({ assets }) => assets?.[0])),
    );
  }

  async getEmailData(auction: PrismaAuction) {
    // Get token, collection and seller details
    const [token, collection, seller] = await Promise.all([
      this.getTokenForAuction(auction),
      this.getCollectionForAuction(auction),
      this.getSellerForAuction(auction),
    ]);

    const asset = await this.getAssetForAuction(auction);
    const imageUrl = asset?.url || collection.thumbnailImageUrl;

    const sellerSlug = seller.customUrl || seller.address;

    return {
      siteLink: process.env.SITE_LINK,
      auctionLink: `${process.env.SITE_LINK}/auction/${auction.auctionId}`,
      tokenLink: `${process.env.SITE_LINK}/token/${auction.tokenId}`,
      tokenImage: imageUrl,
      tokenName: token.name,
      sellerLink: `${process.env.SITE_LINK}/profile/${sellerSlug}`,
      sellerName: seller.name || toShortAddress(seller.address),
      seller,
    };
  }

  // Return an array of TemplateKey indicating which emails should be sent
  // or undefined if no emails should be sent
  getEmailType(
    oldAuction: PrismaAuction,
    newAuction: PrismaAuction,
  ): TemplateKey[] | undefined {
    // If there is an old auction and the endTime has been updated it means that
    // a "timeUpdate" event has been processed and should not send any email
    // if (oldAuction && oldAuction.endTime !== newAuction.endTime) {
    //   return undefined;
    // }

    const now = new Date();

    // Add 15 minutes to the end-time to validate the email send
    const checkEndTime = new Date(
      newAuction.endTime.getTime() + 15 * 60 * 1000,
    );

    // Check if the auction is in-range to send the email
    const isTimeValid = now >= newAuction.startingTime && now <= checkEndTime;

    if (!isTimeValid) {
      this.logger.warn(
        `[${
          newAuction.auctionId
        }] The email will not be sent because is not in date range (${newAuction.startingTime.getTime()} - ${checkEndTime.getTime()})`,
      );

      return undefined;
    }

    // Determine the templates based on the new auction status
    switch (newAuction.status) {
      case AuctionStatus.ACTIVE:
        if (oldAuction) {
          // If the bid has not changed, skip the email send
          if (
            oldAuction.highestBid === newAuction.highestBid &&
            oldAuction.highestBidderAddress === newAuction.highestBidderAddress
          ) {
            return undefined;
          }

          // When the first bid is placed, send the AUCTION_CREATED email
          if (!oldAuction.highestBid && newAuction.highestBid) {
            return [
              TemplateKey.AUCTION_CREATED,
              TemplateKey.AUCTION_BID_CONFIRMED,
            ];
          }

          // If the new bidder is different from the previous and the bid is higher, send the OUTBID email
          if (
            oldAuction.highestBid &&
            oldAuction.highestBidderAddress !==
              newAuction.highestBidderAddress &&
            newAuction.highestBid > oldAuction.highestBid
          ) {
            return [
              TemplateKey.AUCTION_OUTBID,
              TemplateKey.AUCTION_BID_CONFIRMED,
            ];
          }

          return [TemplateKey.AUCTION_BID_CONFIRMED];
        }

        return undefined;
      case AuctionStatus.TO_SETTLE:
        // If the auction has a bid, it was won by someone
        if (newAuction.highestBid) {
          return [TemplateKey.AUCTION_NFT_SOLD, TemplateKey.AUCTION_WON];
        }

        return [TemplateKey.AUCTION_NFT_NOT_SOLD];
      case AuctionStatus.SETTLED:
        return [TemplateKey.AUCTION_SETTLED];
      case AuctionStatus.CANCELLED:
        return undefined;
    }

    return undefined;
  }

  async handleSendEmail(oldAuction: PrismaAuction, newAuction: PrismaAuction) {
    const emailsToSend = this.getEmailType(oldAuction, newAuction);

    if (emailsToSend?.length) {
      const [emailData, bidder] = await Promise.all([
        this.getEmailData(newAuction),
        this.getBidderForAuction(newAuction),
      ]);

      await Promise.allSettled(
        emailsToSend.map((templateKey) =>
          this.sendEmail(oldAuction, newAuction, {
            emailData,
            bidder,
            templateKey,
          }),
        ),
      ).then((res) => {
        const rejected = res
          .filter((result) => result.status === 'rejected')
          .map((result: any) => result.reason);

        if (rejected?.length) {
          this.logger.error(
            `Error to send the some emails for auction #${newAuction.auctionId}`,
            rejected,
          );
        }
      });
    }
  }

  async sendEmail(
    oldAuction: PrismaAuction | undefined,
    newAuction: PrismaAuction,
    options: any,
  ) {
    const {
      emailData: { seller, ...emailData },
      bidder,
      templateKey,
    } = options;

    let emailPayload = {};

    const prettyBidValue = formatPricePretty(newAuction.highestBid);
    const payment = getPaymentFromContractAddress(newAuction.addressVIP180);

    const formattedBid = `${prettyBidValue} ${payment}`;

    const bidderName = bidder
      ? bidder.name || toShortAddress(bidder.address)
      : undefined;

    const bidderProfileLink = bidder
      ? `${process.env.SITE_LINK}/profile/${bidder.customUrl || bidder.address}`
      : undefined;

    let recipients: MailData['to'];

    switch (templateKey) {
      case TemplateKey.AUCTION_CREATED:
        recipients = { email: seller.email, name: emailData.sellerName };

        emailPayload = {
          bid: formattedBid,
          bidderName,
          bidderProfileLink,
        };

        break;
      case TemplateKey.AUCTION_BID_CONFIRMED:
        if (!bidder) {
          this.logger.warn(
            `Couldn't find the highest bidder to send the email ${templateKey} for auction #${newAuction.auctionId}`,
          );

          return false;
        }

        recipients = {
          email: bidder.email,
          name: bidderName,
        };

        emailPayload = {
          newBid: formattedBid,
          profileLink: bidderProfileLink,
        };

        break;
      case TemplateKey.AUCTION_OUTBID:
        const prettyOldBidValue = formatPricePretty(oldAuction.highestBid);
        const formattedOldBid = `${prettyOldBidValue} ${payment}`;

        const previousBidder = await this.getBidderForAuction(oldAuction);

        if (!previousBidder) {
          this.logger.warn(
            `Couldn't find the previous bidder to send the email ${templateKey} for auction #${newAuction.auctionId}`,
          );

          return false;
        }

        recipients = {
          email: previousBidder.email,
          name: previousBidder.name || toShortAddress(previousBidder.address),
        };

        emailPayload = {
          oldBid: formattedOldBid,
          newBid: formattedBid,
          newBidderLink: bidderProfileLink,
          newBidderName: bidderName,
          profileLink: `${process.env.SITE_LINK}/profile/${
            previousBidder.customUrl || previousBidder.address
          }`,
        };

        break;
      case TemplateKey.AUCTION_NFT_NOT_SOLD:
      case TemplateKey.AUCTION_NFT_SOLD:
        recipients = {
          email: seller.email,
          name: emailData.sellerName,
        };

        emailPayload = {
          bid: formattedBid,
          payment,
          profileLink: emailData.sellerLink,
        };

        break;
      case TemplateKey.AUCTION_WON:
        if (!bidder) {
          this.logger.warn(
            `Couldn't find the highest bidder to send the email ${templateKey} for auction #${newAuction.auctionId}`,
          );

          return false;
        }

        recipients = {
          email: bidder.email,
          name: bidderName,
        };

        emailPayload = {
          bid: formattedBid,
          payment,
          profileLink: bidder ? bidderProfileLink : emailData.sellerLink,
        };

        break;
      case TemplateKey.AUCTION_SETTLED:
        // Send the email to the bidder that has won the auction and fallback to the settlor if it's not found
        if (bidder) {
          recipients = { email: bidder.email, name: bidderName };
          emailPayload = { profileLink: bidderProfileLink };
        } else {
          const settlor = await this.getSettlorForAuction(newAuction);

          if (settlor) {
            const settlorName = settlor.name || toShortAddress(settlor.address);
            const settlorProfileLink = bidder
              ? `${process.env.SITE_LINK}/profile/${
                  settlor.customUrl || settlor.address
                }`
              : undefined;

            recipients = { email: settlor.email, name: settlorName };
            emailPayload = { profileLink: settlorProfileLink };
          }
        }

        break;
      case TemplateKey.AUCTION_ENDING_SOON:
        const participants: User[] = await lastValueFrom(
          this.grpcBlockchainSyncAuction
            .getAuctionParticipants({
              auctionId: newAuction.auctionId,
            })
            .pipe(
              map(({ participants }) => {
                // If the seller has an email, remove it from participants if is found
                if (seller?.email) {
                  return participants.filter(
                    (participant) => participant.email !== seller.email,
                  );
                }

                return participants;
              }),
              catchError((err) => {
                this.logger.warn(
                  `Error while fetching auction participants for auction ${newAuction.auctionId}`,
                  err,
                );

                return of([]);
              }),
            ),
        );

        // If no participants has been found, skip the email send
        if (!participants?.length) {
          return;
        }

        // Map the participants to recipient format
        recipients = participants.map((recipient) => ({
          email: recipient.email,
          name: recipient.name || toShortAddress(recipient.address),
        }));

        emailPayload = {
          highestBid: formattedBid,
          highestBidderName: bidderName,
          highestBidderLink: bidderProfileLink,
        };

        this.logger.warn(
          `Email for template "${templateKey}" has not been implemented yet`,
        );

        break;
    }

    //! TEST ONLY: Filter recipients to allow only specific accounts to test the auction emails
    if (process.env.TEST_AUCTION_EMAIL_ADDRESSES && recipients) {
      const testRecipients = process.env.TEST_AUCTION_EMAIL_ADDRESSES?.replace(
        /\s/g,
        '',
      )?.split(',');

      if (testRecipients?.length) {
        if (Array.isArray(recipients)) {
          recipients = recipients.filter((recipient) => {
            const email =
              typeof recipient === 'string' ? recipient : recipient.email;

            return testRecipients.includes(email);
          });
        } else {
          const email =
            typeof recipients === 'string' ? recipients : recipients.email;

          recipients = testRecipients.includes(email) ? recipients : undefined;
        }
      }
    }

    const hasRecipients = Array.isArray(recipients)
      ? recipients.length
      : !!recipients;

    if (!hasRecipients) {
      this.logger.log(
        `No recipients found for ${templateKey} to send email to`,
      );

      return false;
    }

    // Send the email using the email microservice
    return await lastValueFrom(
      this.grpcEmail
        .send({
          key: templateKey,
          data: encodeSerializedJson<Partial<MailData>>({
            to: recipients,
            dynamicTemplateData: {
              ...emailData,
              ...emailPayload,
            },
          }),
        })
        .pipe(
          map((val) => val || true),
          catchError((err) => {
            this.logger.warn(
              `Couldn't send "${templateKey}" email for auction #"${newAuction.auctionId}"`,
              err,
            );

            return of(false);
          }),
        ),
    );
  }

  prismaAuctionToGrpc({
    reservePrice,
    highestBid,
    startingTime,
    endTime,
    ...auction
  }: PrismaAuction): Auction {
    // All properties are optional since the request from the client might
    // select only specific fields from the database.
    return {
      ...auction,
      reservePrice: reservePrice?.toFixed(0),
      highestBid: highestBid?.toFixed(0),
      startingTime: startingTime?.toISOString(),
      endTime: endTime?.toISOString(),
    };
  }
}
