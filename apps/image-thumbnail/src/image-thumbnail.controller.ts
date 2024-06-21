import {
  CreateTokenAssetsArgs,
  CreateUserAssetsArgs,
  DeleteTokenAssetsArgs,
  GenerateUserAssetsArgs,
  GetManyTokenAssetsArgs,
  GetManyUserAssetsArgs,
  GetTokenAssetsArgs,
  GetUserAssetsArgs,
  ImageThumbnailServiceController,
  ImageThumbnailServiceControllerMethods,
  UserMediaType,
} from '@generated/ts-proto/services/thumbnail';
import { Controller } from '@nestjs/common';
import { AssetEntityKind } from '@prisma/client/image-thumbnail';
import _ from 'lodash';
import Web3 from 'web3';
import { ImageThumbnailService } from './image-thumbnail.service';

/**
 * NOTE: Entity information is stored in the database as a JSONB column so
 * all entity addresses must be converted to checksum format to ensure correct
 * operation since entity ids are CASE SENSITIVE.
 */

@Controller()
@ImageThumbnailServiceControllerMethods()
export class ImageThumbnailController
  implements ImageThumbnailServiceController
{
  constructor(private readonly imageThumbnailService: ImageThumbnailService) {}

  async createTokenAssets({
    smartContractAddress,
    tokenId,
    source,
  }: CreateTokenAssetsArgs) {
    const entity = {
      kind: AssetEntityKind.TOKEN,
      smartContractAddress: Web3.utils.toChecksumAddress(smartContractAddress),
      tokenId,
    };

    return this.imageThumbnailService.createAssets(entity, source);
  }

  async generateUserAssets({ address }: GenerateUserAssetsArgs) {
    return this.imageThumbnailService.generateUserAssets(address);
  }

  async createUserAssets({ address, mediaType, source }: CreateUserAssetsArgs) {
    const entity = {
      kind: this.getEntityKindFromUserMediaType(mediaType),
      address: Web3.utils.toChecksumAddress(address),
    };

    return this.imageThumbnailService.createAssets(entity, source);
  }

  async getTokenAssets({
    smartContractAddress,
    tokenId,
    filters,
  }: GetTokenAssetsArgs) {
    const entity = {
      kind: AssetEntityKind.TOKEN,
      smartContractAddress: Web3.utils.toChecksumAddress(smartContractAddress),
      tokenId,
    };

    const assets = await this.imageThumbnailService.getAssets(
      entity,
      filters?.sizes,
    );

    return { assets };
  }

  async getManyTokenAssets({
    identifiers = [],
    filters,
  }: GetManyTokenAssetsArgs) {
    const entities = identifiers.map(({ smartContractAddress, tokenId }) => ({
      kind: AssetEntityKind.TOKEN,
      smartContractAddress: Web3.utils.toChecksumAddress(smartContractAddress),
      tokenId,
    }));

    const assets = await this.imageThumbnailService.getAssetsBatch(
      entities,
      filters?.sizes,
    );

    return { items: _.mapValues(assets, (assets) => ({ assets })) };
  }

  async deleteTokenAssets({
    smartContractAddress,
    tokenId,
  }: DeleteTokenAssetsArgs) {
    const entity = {
      kind: AssetEntityKind.TOKEN,
      smartContractAddress: Web3.utils.toChecksumAddress(smartContractAddress),
      tokenId,
    };

    await this.imageThumbnailService.deleteMedia(entity, true);
  }

  async getUserAssets({ address, mediaType, filters }: GetUserAssetsArgs) {
    const entity = {
      kind: this.getEntityKindFromUserMediaType(mediaType),
      address: Web3.utils.toChecksumAddress(address),
    };

    const assets = await this.imageThumbnailService.getAssets(
      entity,
      filters?.sizes,
    );

    return { assets };
  }

  async getManyUserAssets({
    addresses,
    mediaType,
    filters,
  }: GetManyUserAssetsArgs) {
    const kind = this.getEntityKindFromUserMediaType(mediaType);

    const entities = addresses.map((address) => ({
      kind,
      address: Web3.utils.toChecksumAddress(address),
    }));

    const assets = await this.imageThumbnailService.getAssetsBatch(
      entities,
      filters?.sizes,
    );

    return { items: _.mapValues(assets, (assets) => ({ assets })) };
  }

  private getEntityKindFromUserMediaType(mediaType: UserMediaType) {
    switch (mediaType) {
      case UserMediaType.AVATAR:
        return AssetEntityKind.USER_AVATAR;
      case UserMediaType.BANNER:
        return AssetEntityKind.USER_BANNER;
    }
  }
}
