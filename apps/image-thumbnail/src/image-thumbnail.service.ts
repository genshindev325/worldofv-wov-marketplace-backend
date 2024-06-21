import { REDIS_CLIENT_PROXY } from '@app/redis-client';
import { Asset, AssetSize, AssetSource } from '@generated/ts-proto/types/asset';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AssetEntityKind,
  AssetSize as PrismaAssetSize,
  PrismaClient,
  Thumbnail,
} from '@prisma/client/image-thumbnail';
import { Queue } from 'bullmq';
import { fromBuffer } from 'file-type';
import knex from 'knex';
import _ from 'lodash';
import path from 'path';
import { lastValueFrom } from 'rxjs';
import Web3 from 'web3';
import { AssetEntity, CreateAssetJobData } from './create-asset-job-data.type';
import { ImageThumbnailGenerationService } from './image-thumbnail-generation.service';
import { ImageThumbnailUploadService } from './image-thumbnail-upload.service';

const knexPg = knex({ client: 'pg' });

@Injectable()
export class ImageThumbnailService {
  private readonly logger = new Logger(ImageThumbnailService.name);

  /**
   * Asset sizes that should be generated for the respective entity excluding
   * the original.
   */
  private static readonly ASSET_SIZES: Record<AssetEntityKind, AssetSize[]> = {
    [AssetEntityKind.TOKEN]: [
      AssetSize.STATIC_COVER_128,
      AssetSize.STATIC_COVER_256,
      AssetSize.STATIC_COVER_512,
      AssetSize.ANIMATED_INSIDE_512,
      AssetSize.ANIMATED_INSIDE_1024,
    ],

    [AssetEntityKind.USER_AVATAR]: [
      AssetSize.STATIC_COVER_128,
      AssetSize.STATIC_COVER_256,
      AssetSize.STATIC_COVER_512,
    ],

    [AssetEntityKind.USER_BANNER]: [],
  };

  private static readonly ASSET_SORT_ORDER: Record<AssetSize, number> = {
    [AssetSize.STATIC_COVER_128]: 0,
    [AssetSize.STATIC_COVER_256]: 1,
    [AssetSize.STATIC_COVER_512]: 2,
    [AssetSize.ANIMATED_INSIDE_512]: 3,
    [AssetSize.ANIMATED_INSIDE_1024]: 4,
    [AssetSize.ORIGINAL]: 5,
  };

  private static readonly ASSET_UPLOAD_PATH: Record<AssetSize, string> = {
    [AssetSize.STATIC_COVER_128]: 'static/cover/128',
    [AssetSize.STATIC_COVER_256]: 'static/cover/256',
    [AssetSize.STATIC_COVER_512]: 'static/cover/512',
    [AssetSize.ANIMATED_INSIDE_512]: 'animated/inside/512',
    [AssetSize.ANIMATED_INSIDE_1024]: 'animated/inside/1024',
    [AssetSize.ORIGINAL]: 'original',
  };

  constructor(
    @InjectQueue('thumbnail/image')
    private readonly imageQueue: Queue<CreateAssetJobData>,

    @InjectQueue('thumbnail/video')
    private readonly videoQueue: Queue<CreateAssetJobData>,

    @Inject(REDIS_CLIENT_PROXY)
    private readonly marketplaceClient: ClientProxy,

    private readonly httpService: HttpService,

    private readonly uploadService: ImageThumbnailUploadService,

    private readonly generationService: ImageThumbnailGenerationService,

    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Get the root S3 path for a specific entity.
   */
  private static getBasePath(entity: AssetEntity) {
    switch (entity.kind) {
      case AssetEntityKind.TOKEN: {
        const { smartContractAddress: address, tokenId } = entity;
        const checksumAddress = Web3.utils.toChecksumAddress(address);
        return `tokens/${checksumAddress}/${tokenId}`;
      }

      case AssetEntityKind.USER_AVATAR: {
        const checksumAddress = Web3.utils.toChecksumAddress(entity.address);
        return `users/${checksumAddress}/avatar`;
      }

      case AssetEntityKind.USER_BANNER: {
        const checksumAddress = Web3.utils.toChecksumAddress(entity.address);
        return `users/${checksumAddress}/banner`;
      }
    }
  }

  /**
   * Get the S3 key for a specific entity.
   */
  private static getUploadPath(
    entity: AssetEntity,
    size: AssetSize,
    extension: string,
  ) {
    const basePath = ImageThumbnailService.getBasePath(entity);
    const uploadPath = ImageThumbnailService.ASSET_UPLOAD_PATH[size];
    extension = extension.replace(/^\./, '');
    return path.posix.join(basePath, uploadPath + '.' + extension);
  }

  /**
   * Get the string that will be used as key for an entity in a batch request.
   */
  private static getEntityMapKey(
    entityKind: Thumbnail['entityKind'],
    entity: any,
  ) {
    switch (entityKind) {
      case AssetEntityKind.TOKEN:
        return entity.smartContractAddress + '_' + entity.tokenId;

      case AssetEntityKind.USER_AVATAR:
      case AssetEntityKind.USER_BANNER:
        return entity.address;

      default:
        throw new Error(`Unsupported entity: ${entityKind}`);
    }
  }

  private getAssetsFromThumbnails(thumbnails: Thumbnail[]): Asset[] {
    const assets: Asset[] = thumbnails.map(({ key, mimeType, size }) => ({
      url: `${this.uploadService.CDN_ENDPOINT}/${key}`,
      mimeType,
      size: size as any,
    }));

    assets.sort(
      (a, b) =>
        ImageThumbnailService.ASSET_SORT_ORDER[a.size] -
        ImageThumbnailService.ASSET_SORT_ORDER[b.size],
    );

    return assets;
  }

  /**
   * @returns The URL of the uploaded data.
   */
  async uploadMedia(
    data: Buffer,
    options: Pick<CreateAssetJobData, 'entity' | 'size'>,
  ) {
    const { mime, ext } = await fromBuffer(data);

    if (!mime.startsWith('video') && !mime.startsWith('image')) {
      throw new Error(
        `[${this.uploadMedia.name}] Unsupported mime type: ${mime}.`,
      );
    }

    const uploadPath = ImageThumbnailService.getUploadPath(
      options.entity,
      options.size,
      ext,
    );

    await this.uploadService.putObject({
      Key: uploadPath,
      ACL: 'public-read',
      ContentDisposition: 'inline',
      ContentType: mime,
      Body: data,
    });

    const entityKind = options.entity.kind;
    const entityPayload: any = { ...options.entity, kind: undefined };

    const deleteQuery = knexPg
      .table('Thumbnail')
      .select('*')
      .delete()
      .whereNot('key', '=', uploadPath)
      .where('entityKind', '=', entityKind)
      .where('size', '=', options.size)
      .whereRaw('"entity" @> ?', JSON.stringify(entityPayload));

    const payload = {
      key: uploadPath,
      entity: entityPayload as any,
      entityKind: entityKind,
      mimeType: mime,
      size: options.size,
    };

    const [existing] = await this.prisma.$transaction([
      this.prisma.$queryRawUnsafe<Thumbnail[]>(deleteQuery.toString()),
      this.prisma.thumbnail.upsert({
        where: { key: payload.key },
        create: payload,
        update: payload,
      }),
    ]);

    // Remove the old entries manually if they happen to have a different
    // extension. We do this after deleting from the database to make sure
    // we don't store any blank entry.
    if (existing.length) {
      await this.uploadService.deleteObjects({
        Delete: {
          Objects: existing.map(({ key }) => ({ Key: key })),
        },
      });
    }

    await lastValueFrom(
      this.marketplaceClient.send('UpdateAsset', options.entity),
    );

    return `${this.uploadService.ORIGIN_ENDPOINT}/${uploadPath}`;
  }

  async createAssets(entity: AssetEntity, source?: AssetSource) {
    let location: string;
    let mimeType: string;
    let extension: string;

    if (source) {
      // We upload the original thumbnail outside of the queue so we can make sure the
      // original asset exists before returning. Original file upload should be reasonably fast since
      // there is no conversion involved. As a side benefit to this approach jobs will use the
      // uploaded file as a remote cache since it's not recommended to create jobs
      // with big payloads like an image buffer and the original source might be quite slow.

      let sourceBuffer: Buffer | undefined;

      if (source.buffer) {
        sourceBuffer = source.buffer;
      } else if (source.url) {
        const response = await lastValueFrom(
          this.httpService.get(source.url, { responseType: 'arraybuffer' }),
        );
        sourceBuffer = response.data;
      }

      const info = await fromBuffer(sourceBuffer);

      mimeType = info.mime;
      extension = info.ext;

      location = await this.uploadMedia(sourceBuffer, {
        size: AssetSize.ORIGINAL,
        entity,
      });

      this.logger.log(
        `[${this.createAssets.name}] Successfully uploaded original to ${location}`,
      );
    } else {
      // When no URL is provided we use the previous original file as source.

      const assets = await this.getAssets(entity, [AssetSize.ORIGINAL]);

      if (!assets.length) {
        throw new Error(
          `[${this.createAssets.name}] No source provided and no original asset found.`,
        );
      }

      mimeType = assets[0].mimeType;
      extension = assets[0].url.split('.').pop();
      location = assets[0].url;
    }

    // Remove all thumbnails and keep only the original file to avoid clashes
    // since some thumbnails might not be generated if the original is smaller.
    if (ImageThumbnailService.ASSET_SIZES[entity.kind].length) {
      await this.deleteMedia(entity);
    }

    const jobs = ImageThumbnailService.ASSET_SIZES[entity.kind].map((size) => ({
      name: 'createAsset',
      data: {
        size,
        url: location,
        entity,
        mimeType,
        extension,
      },
    }));

    switch (mimeType.split('/')[0]) {
      case 'video':
        await this.videoQueue.addBulk(jobs);
        break;
      case 'image':
        await this.imageQueue.addBulk(jobs);
        break;
      default:
        throw new Error(`Unknown MIME type: ${mimeType}`);
    }

    return { size: AssetSize.ORIGINAL, url: location, mimeType };
  }

  async getAssets(
    { kind, ...entity }: AssetEntity,
    sizes?: AssetSize[],
  ): Promise<Asset[]> {
    const query = knexPg
      .table('Thumbnail')
      .select('*')
      .where('entityKind', '=', kind)
      .whereRaw('"entity" @> ?', JSON.stringify(entity));

    if (sizes) {
      query.whereIn('size', sizes);
    }

    const data = await this.prisma.$queryRawUnsafe<Thumbnail[]>(
      query.toString(),
    );

    return this.getAssetsFromThumbnails(data);
  }

  async getAssetsBatch(
    entities: AssetEntity[],
    sizes?: AssetSize[],
  ): Promise<Record<string, Asset[]>> {
    const query = knexPg.table('Thumbnail').select('*').whereRaw('false');

    for (const { kind, ...entity } of entities) {
      query.orWhere((builder) => {
        builder
          .where('entityKind', '=', kind)
          .whereRaw('"entity" @> ?', JSON.stringify(entity));
      });
    }

    if (sizes) {
      query.whereIn('size', sizes);
    }

    const data = await this.prisma.$queryRawUnsafe<Thumbnail[]>(
      query.toString(),
    );

    const thumbnailsById: Record<string, Thumbnail[]> = {};

    for (const thumbnail of data) {
      const key = ImageThumbnailService.getEntityMapKey(
        thumbnail.entityKind,
        thumbnail.entity,
      );

      if (!(key in thumbnailsById)) thumbnailsById[key] = [];

      thumbnailsById[key].push(thumbnail);
    }

    return _.mapValues(thumbnailsById, (thumbnails) =>
      this.getAssetsFromThumbnails(thumbnails),
    );
  }

  async deleteMedia({ kind, ...entity }: AssetEntity, deleteOriginal = false) {
    const query = knexPg
      .table('Thumbnail')
      .delete()
      .returning('*')
      .where('entityKind', '=', kind)
      .whereRaw('"entity" @> ?', JSON.stringify(entity));

    if (!deleteOriginal) {
      query.whereNot('size', '=', PrismaAssetSize.ORIGINAL);
    }

    const data = await this.prisma.$queryRawUnsafe<Thumbnail[]>(
      query.toString(),
    );

    if (data.length) {
      await this.uploadService.deleteObjects({
        Delete: { Objects: data.map((d) => ({ Key: d.key })) },
      });
    }

    const basePath = ImageThumbnailService.getBasePath({
      kind,
      ...entity,
    } as AssetEntity);

    const auxiliaryInfo = deleteOriginal
      ? 'original removed'
      : 'original preserved';

    this.logger.log(
      `[${this.createAssets.name}] Successfully removed old thumbnails for '${basePath}' (${auxiliaryInfo}).`,
    );
  }

  async generateUserAssets(address: string) {
    const entity = {
      kind: AssetEntityKind.USER_AVATAR,
      address: Web3.utils.toChecksumAddress(address),
    };

    const assets = await this.getAssets(entity, [AssetSize.ORIGINAL]);

    if (assets.length) {
      return assets[0];
    }

    const buffer = await this.generationService.generateProfileImage(address);
    return this.createAssets(entity, { buffer });
  }
}
