import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import {
  ImageThumbnailServiceClient,
  IMAGE_THUMBNAIL_SERVICE_NAME,
  UserMediaType,
} from '@generated/ts-proto/services/thumbnail';
import {
  SearchUsersByStringArgs,
  UpdateUserArgs,
  UpsertUserArgs,
} from '@generated/ts-proto/services/user';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { Prisma, PrismaClient, User } from '@prisma/client/user';
import { catchError, lastValueFrom, map, of } from 'rxjs';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  private grpcImageThumbnail: ImageThumbnailServiceClient;

  constructor(
    @Inject(GrpcClientKind.IMAGE_THUMBNAIL)
    private readonly imageThumbnailClient: ClientGrpc,

    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceClient: ClientProxy,

    private readonly prisma: PrismaClient,
  ) {}

  onModuleInit() {
    this.grpcImageThumbnail = this.imageThumbnailClient.getService(
      IMAGE_THUMBNAIL_SERVICE_NAME,
    );
  }

  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.prisma.user.findUnique({ where });
  }

  async searchUsersByString({ text, limit }: SearchUsersByStringArgs) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { address: { equals: text } },
        ],
        AND: {
          blacklisted: false,
        },
      },
      orderBy: [
        {
          verified: 'desc',
        },
        { name: 'asc' },
      ],
      take: limit,
    });
  }

  /**
   * RPC doesn't have a distinction between null and undefined so we use empty
   * string to indicate a set null operation and null value to leave the
   * existing value in place.
   */
  private createUpdateClause(
    args: Omit<Prisma.UserCreateInput, 'address'>,
  ): Prisma.UserUpdateInput {
    const coerceBool = (arg?: boolean) => {
      return arg != null ? arg : undefined;
    };

    const coerceString = (arg?: string) => {
      return arg != null ? (arg === '' ? null : arg) : undefined;
    };

    return {
      profileImageUrl: args.profileImageUrl || undefined,
      bannerImageUrl: args.bannerImageUrl || undefined,
      profileId: args.profileId || undefined,
      name: args.name || undefined,
      email: args.email || undefined,
      verifiedLevel: args.verifiedLevel || undefined,
      landingTab: args.landingTab || undefined,
      description: coerceString(args.description),
      customUrl: coerceString(args.customUrl),
      websiteUrl: coerceString(args.websiteUrl),
      facebookUrl: coerceString(args.facebookUrl),
      twitterUrl: coerceString(args.twitterUrl),
      discordUrl: coerceString(args.discordUrl),
      instagramUrl: coerceString(args.instagramUrl),
      firstName: coerceString(args.firstName),
      lastName: coerceString(args.lastName),
      blacklisted: coerceBool(args.blacklisted),
      verified: coerceBool(args.verified),
      isAdmin: coerceBool(args.isAdmin),
      showEmail: coerceBool(args.showEmail),
      showBalance: coerceBool(args.showBalance),
      isEmailNotificationEnabled: coerceBool(args.isEmailNotificationEnabled),
    };
  }

  async upsert({
    profileImageSource,
    bannerImageSource,
    ...args
  }: UpsertUserArgs) {
    // Wait for the original assets to be uploaded before creating the user.
    const [profileImageUrl, bannerImageUrl] = await Promise.all([
      profileImageSource
        ? lastValueFrom(
            this.grpcImageThumbnail
              .createUserAssets({
                mediaType: UserMediaType.AVATAR,
                address: args.address,
                source: profileImageSource,
              })
              .pipe(map(({ url }) => url)),
          )
        : lastValueFrom(
            this.grpcImageThumbnail
              .generateUserAssets({ address: args.address })
              .pipe(map(({ url }) => url)),
          ),
      bannerImageSource
        ? lastValueFrom(
            this.grpcImageThumbnail
              .createUserAssets({
                mediaType: UserMediaType.BANNER,
                address: args.address,
                source: bannerImageSource,
              })
              .pipe(map(({ url }) => url)),
          )
        : null,
    ]);

    const data = { ...args, profileImageUrl, bannerImageUrl };

    const user = await this.prisma.user.upsert({
      where: { address: args.address },
      create: data,
      update: this.createUpdateClause(data),
    });

    await lastValueFrom(
      this.marketplaceClient.send('UpdateUser', user).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.upsert.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return user as User;
  }

  async update({
    address,
    bannerImageSource,
    profileImageSource,
    ...args
  }: UpdateUserArgs) {
    const [profileImageUrl, bannerImageUrl] = await Promise.all([
      profileImageSource
        ? lastValueFrom(
            this.grpcImageThumbnail
              .createUserAssets({
                address,
                mediaType: UserMediaType.AVATAR,
                source: profileImageSource,
              })
              .pipe(map(({ url }) => url)),
          )
        : undefined,
      bannerImageSource
        ? lastValueFrom(
            this.grpcImageThumbnail
              .createUserAssets({
                address,
                mediaType: UserMediaType.BANNER,
                source: bannerImageSource,
              })
              .pipe(map(({ url }) => url)),
          )
        : undefined,
    ]);

    const user = await this.prisma.user.update({
      where: { address, profileId: args.profileId },
      data: this.createUpdateClause({
        ...args,
        profileImageUrl,
        bannerImageUrl,
      }),
    });

    await lastValueFrom(
      this.marketplaceClient.send('UpdateUser', user).pipe(
        catchError((err) => {
          this.logger.error(
            `[${this.update.name}] Error while updating marketplace via Redis`,
            err,
          );
          return of(null);
        }),
      ),
    );

    return user as User;
  }
}
