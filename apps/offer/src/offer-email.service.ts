import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { PriceConversionCacheService } from '@app/price-conversion-cache';
import {
  EmailServiceClient,
  EMAIL_SERVICE_NAME,
} from '@generated/ts-proto/services/email';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import {
  AggregatedOffer,
  SendOfferEmailArgs,
} from '@generated/ts-proto/services/offer';
import {
  UserServiceClient,
  USER_SERVICE_NAME,
} from '@generated/ts-proto/services/user';
import { User } from '@generated/ts-proto/types/user';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { TemplateKey } from '@prisma/client/email';
import { Prisma as PrismaNft } from '@prisma/client/nft';
import { OfferType, PrismaClient } from '@prisma/client/offer';
import { Prisma as PrismaUser } from '@prisma/client/user';
import { MailData } from '@sendgrid/helpers/classes/mail';
import BigNumber from 'bignumber.js';
import { formatPricePretty } from 'common/format-price-pretty.helper';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import { isSameAddress } from 'common/is-same-address.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import { toShortAddress } from 'common/to-short-address';
import _ from 'lodash';
import { catchError, lastValueFrom, map, of, throwError } from 'rxjs';
import { OfferAggregationService } from './offer-aggregation.service';

@Injectable()
export class OfferEmailService implements OnModuleInit {
  private readonly logger = new Logger(OfferEmailService.name);

  private grpcEdition: EditionServiceClient;
  private grpcUser: UserServiceClient;
  private grpcEmail: EmailServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    @Inject(GrpcClientKind.USER) private readonly userClient: ClientGrpc,
    @Inject(GrpcClientKind.EMAIL) private readonly emailClient: ClientGrpc,
    private readonly prisma: PrismaClient,
    private readonly priceConversionCache: PriceConversionCacheService,
    private readonly offerAggregationService: OfferAggregationService,
  ) {}

  onModuleInit() {
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
    this.grpcUser = this.userClient.getService(USER_SERVICE_NAME);
    this.grpcEmail = this.emailClient.getService(EMAIL_SERVICE_NAME);
  }

  private async getOfferRecipients(offer: AggregatedOffer): Promise<User[]> {
    const recipientsAddresses = await lastValueFrom(
      this.grpcEdition
        .findMany(
          encodeSerializedJson<PrismaNft.EditionFindManyArgs>({
            distinct: 'ownerAddress',
            select: { ownerAddress: true },
            where: {
              tokenId: offer.tokenId || undefined,
              editionId: offer.editionId || undefined,
              smartContractAddress: offer.smartContractAddress,
              ownerAddress: { not: offer.bidderAddress },
            },
          }),
        )
        .pipe(
          map(({ editions }) =>
            editions.map(({ ownerAddress }) => ownerAddress),
          ),
        ),
    );

    const [users, minimumOffers] = await Promise.all([
      lastValueFrom(
        this.grpcUser
          .findMany(
            encodeSerializedJson<PrismaUser.UserFindManyArgs>({
              select: {
                address: true,
                name: true,
                customUrl: true,
                email: true,
              },
              where: {
                address: { in: recipientsAddresses },
                isEmailNotificationEnabled: true,
                OR: [{ email: { not: null } }, { email: { not: '' } }],
              },
            }),
          )
          .pipe(map(({ users }) => users)),
      ),

      this.prisma.minimumOffer
        .findMany({
          where: {
            userAddress: { in: recipientsAddresses },
            smartContractAddress: {
              not: process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
            },
          },
        })
        .then((res) => _.groupBy(res, 'userAddress')),
    ]);

    return _.reduce(
      users,
      (recipients, user) => {
        const userMinimumOffers = minimumOffers[user.address];

        if (userMinimumOffers) {
          recipients.push({
            user,
            minimumOffers: _.reduce(
              userMinimumOffers,
              (acc, curr) => {
                const price = new BigNumber(curr.price.toString());
                return price.gt(0)
                  ? { ...acc, [curr.smartContractAddress]: price }
                  : acc;
              },
              {},
            ),
          });
        } else {
          recipients.push({ user });
        }

        return recipients;
      },
      [],
    );
  }

  async getOfferAcceptedRecipient(offer: AggregatedOffer): Promise<User> {
    // If the offer doesn't have the acceptor address, return null
    if (!offer.acceptorAddress) {
      return null;
    }

    // Get the bidder as recipient
    const user = await lastValueFrom(
      this.grpcUser
        .findUnique(
          encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
            where: { address: offer.bidderAddress },
          }),
        )
        .pipe(
          catchError((err) => {
            if (err?.code === GrpcStatus.NOT_FOUND) {
              return of({ address: offer.bidderAddress } as User);
            } else {
              return throwError(() => err);
            }
          }),
        ),
    );

    // If the recipient has the email and the notification enabled return it
    if (user && user.email && user.isEmailNotificationEnabled) {
      return user;
    }

    // Else return null
    return null;
  }

  private async getEmailData(offer: AggregatedOffer): Promise<any> {
    // Get the token artist or the collection creator
    const creatorAddress =
      offer.type === OfferType.COLLECTION
        ? offer.collection?.creatorAddress
        : offer.token?.creatorAddress !== offer.token?.smartContractAddress
        ? offer.token?.creatorAddress
        : undefined;

    const creator = creatorAddress
      ? await lastValueFrom(
          this.grpcUser
            .findUnique(
              encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
                where: { address: creatorAddress },
              }),
            )
            .pipe(
              catchError((err) => {
                if (err?.code === GrpcStatus.NOT_FOUND) {
                  return of({ address: creatorAddress } as User);
                } else {
                  return throwError(() => err);
                }
              }),
            ),
        )
      : null;

    const acceptor = offer.acceptorAddress
      ? await lastValueFrom(
          this.grpcUser
            .findUnique(
              encodeSerializedJson<PrismaUser.UserFindUniqueArgs>({
                where: { address: offer.acceptorAddress },
              }),
            )
            .pipe(
              catchError((err) => {
                if (err?.code === GrpcStatus.NOT_FOUND) {
                  return of({ address: offer.acceptorAddress } as User);
                } else {
                  return throwError(() => err);
                }
              }),
            ),
        )
      : null;

    const tokenLink =
      offer.type === OfferType.COLLECTION
        ? `${process.env.SITE_LINK}/collection/${
            offer.collection.customUrl || offer.collection.collectionId
          }`
        : `${process.env.SITE_LINK}/token/${offer.smartContractAddress}/${
            offer.editionId || offer.tokenId
          }`;

    const bidderName =
      offer.bidder?.name || toShortAddress(offer.bidderAddress);
    const bidderProfileLink = `${process.env.SITE_LINK}/profile/${
      offer.bidder?.customUrl || offer.bidderAddress
    }`;

    const acceptorName = acceptor
      ? acceptor.name || toShortAddress(acceptor.address)
      : undefined;

    const acceptorProfileLink = acceptor
      ? `${process.env.SITE_LINK}/profile/${
          acceptor.customUrl || acceptor.address
        }`
      : undefined;

    let creatorName: string;
    let creatorLink: string;

    if (
      creator ||
      isSameAddress(
        offer.token?.smartContractAddress,
        process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
      )
    ) {
      creatorName = creator?.name;
      creatorLink = creator
        ? `${process.env.SITE_LINK}/profile/${
            creator.customUrl || creator.address
          }`
        : '';
    } else if (offer.collection) {
      const slug = offer.collection.customUrl || offer.collection.collectionId;
      creatorLink = `${process.env.SITE_LINK}/collection/${slug}`;
      creatorName = offer.collection.name;
    }

    // Get the imageUrl to show in the email
    let imageUrl: string;

    // If the asset is found set it
    if (offer.asset?.url) {
      imageUrl = offer.asset.url;
    } else if (offer.type === OfferType.COLLECTION) {
      imageUrl = offer.collection.thumbnailImageUrl;
    }

    const payment = getPaymentFromContractAddress(offer.addressVIP180);

    return {
      bid: `${formatPricePretty(offer.price)} ${payment}`,
      tokenName: offer.token?.name || offer.collection?.name,
      tokenLink,
      imageUrl,
      creatorName,
      creatorLink,
      bidderName,
      bidderProfileLink,
      acceptorName,
      acceptorProfileLink,
    };
  }

  async sendEmail({
    offerId,
    emailType,
  }: SendOfferEmailArgs): Promise<boolean> {
    // Get the offer from the database
    const rawOffer = await this.prisma.offer.findUnique({ where: { offerId } });

    const offer = await this.offerAggregationService
      .aggregateOffers([rawOffer])
      .then((offers) => offers?.[0]);

    if (!offer) {
      this.logger.warn(
        `The "${emailType}" email will not be sent because offer "${offer.offerId}" is invalid.`,
      );
      return false;
    }

    if (Date.now() > new Date(offer.endTime).getTime()) {
      this.logger.warn(
        `The "${emailType}" email will not be sent because offer "${offer.offerId}" has ended.`,
      );
    }

    const offerPrice = new BigNumber(offer.price);

    const rates = await this.priceConversionCache.getLatestRatesByCurrency();

    switch (emailType) {
      case TemplateKey.OFFER_RECEIVED: {
        // Get all the recipient addresses for the offer
        const recipients = await this.getOfferRecipients(offer).then(
          (recipientsWithMinimumOffers) =>
            _.reduce(
              recipientsWithMinimumOffers,
              (acc, item: any) => {
                // Get the minimum offer price by smartContractAddress matching the offer address
                const minimumOfferPrice = _.find(
                  item.minimumOffers,
                  (_value, key) =>
                    isSameAddress(key, offer.smartContractAddress),
                );

                const offerPriceUsd = offerPrice?.multipliedBy(
                  rates[getPaymentFromContractAddress(offer.addressVIP180)],
                );

                const minimumOfferPriceUsd = minimumOfferPrice?.multipliedBy(
                  rates['vVET'],
                );

                // If the minimum offer price exists and is greater than the offer, skip the send
                if (
                  minimumOfferPriceUsd &&
                  offerPriceUsd?.lt(minimumOfferPriceUsd)
                ) {
                  return acc;
                }

                // Else push the user to the recipients
                return [...acc, item.user];
              },
              [],
            ),
        );

        if (!recipients?.length) {
          this.logger.warn(
            `There are not any recipients to send email for offer ${offer.offerId}`,
          );

          return true;
        }

        // Get the email data if have to send an email
        const emailData = await this.getEmailData(offer);

        // Define the subject, description and the tokenLink for the email data based ont he offer type
        let subject = "You've received an Offer!";
        let description = "You've received an offer on your NFT.";

        switch (offer.type) {
          case OfferType.TOKEN:
            subject = "You've received a Global Offer!";
            description = "You've received a Global Offer on your NFT.";
            break;
          case OfferType.COLLECTION:
            subject = "You've received a Collection Offer!";
            description =
              'A Collection Offer has been been placed on your NFT.';
            break;
        }

        // Create the personalizations in order to send multiple emails if needed
        const personalizations = recipients.map((recipient) => {
          const profileLink = `${process.env.SITE_LINK}/profile/${
            recipient.customUrl || recipient.address
          }`;

          return {
            to: { email: recipient.email, name: recipient.name || undefined },
            dynamicTemplateData: {
              tokenLink: emailData.tokenLink,
              profileLink,
              offerLink:
                offer.type === OfferType.COLLECTION
                  ? `${profileLink}?tab=offers-received`
                  : emailData.tokenLink,
            },
          };
        });

        // Send the email using the email microservice
        return await lastValueFrom(
          this.grpcEmail
            .send({
              key: TemplateKey.OFFER_RECEIVED,
              data: encodeSerializedJson<Partial<MailData>>({
                subject,
                personalizations,
                dynamicTemplateData: {
                  subject,
                  description,
                  siteLink: process.env.SITE_LINK,
                  bid: emailData.bid,
                  tokenName: emailData.tokenName,
                  tokenImage: emailData.imageUrl,
                  creatorName: emailData.creatorName,
                  creatorLink: emailData.creatorLink,
                  bidderName: emailData.bidderName,
                  bidderProfileLink: emailData.bidderProfileLink,
                },
              }),
            })
            .pipe(
              map(({ value }) => value || true),
              catchError((err) => {
                this.logger.warn(
                  `Couldn't send "${TemplateKey.OFFER_RECEIVED}" email for offer "${offer.offerId}"`,
                  err,
                );

                return of(false);
              }),
            ),
        );
      }
      case TemplateKey.OFFER_ACCEPTED: {
        const recipient = await this.getOfferAcceptedRecipient(offer);

        if (!recipient) {
          this.logger.warn(
            `There are not any recipients to send email for offer ${offer.offerId}`,
          );

          return true;
        }

        const emailData = await this.getEmailData(offer);

        // Send the email using the email microservice
        return await lastValueFrom(
          this.grpcEmail
            .send({
              key: TemplateKey.OFFER_ACCEPTED,
              data: encodeSerializedJson<Partial<MailData>>({
                to: {
                  email: recipient.email,
                  name: recipient.name || undefined,
                },
                dynamicTemplateData: {
                  siteLink: process.env.SITE_LINK,
                  tokenImage: emailData.imageUrl,
                  tokenName: emailData.tokenName,
                  tokenLink: emailData.tokenLink,
                  creatorName: emailData.creatorName,
                  creatorLink: emailData.creatorLink,
                  proprietaryName: emailData.acceptorName,
                  proprietaryLink: emailData.acceptorProfileLink,
                  offerValue: emailData.bid,
                  profileLink: emailData.bidderProfileLink,
                },
              }),
            })
            .pipe(
              map(({ value }) => value || true),
              catchError((err) => {
                this.logger.warn(
                  `Couldn't send "${TemplateKey.OFFER_ACCEPTED}" email for offer "${offer.offerId}"`,
                  err,
                );

                return of(false);
              }),
            ),
        );
      }
    }
  }
}
