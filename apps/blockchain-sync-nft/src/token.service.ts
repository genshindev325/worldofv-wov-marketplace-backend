import { ContractService } from '@blockchain/contract';
import { UpsertTokenData } from '@generated/ts-proto/services/nft';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenCategory } from '@prisma/client/nft';
import { BURN_ADDRESSES_TO_CHECK } from 'common/constants';
import isBurnAddress from 'common/is-burn-address';
import isIpfsCid from 'common/is-ipfs-cid';
import _ from 'lodash';
import { ThorifyContract } from 'thorify';

@Injectable()
export class TokenService implements OnModuleInit {
  private readonly logger = new Logger(TokenService.name);

  public wovNftContract: ThorifyContract;

  private readonly WOV_IPFS_GATEWAY: string;
  private readonly ARWEAVE_GATEWAY: string;
  private readonly GET_EDITION_COUNT_BATCH_SIZE = 100;

  constructor(
    private readonly httpService: HttpService,
    private readonly contractService: ContractService,
    private readonly configService: ConfigService,
  ) {
    this.WOV_IPFS_GATEWAY = this.configService
      .getOrThrow('WOV_IPFS_GATEWAY')
      .replace(/\/?$/, '/');

    this.ARWEAVE_GATEWAY = this.configService
      .getOrThrow('ARWEAVE_GATEWAY')
      .replace(/\/?$/, '/');
  }

  async onModuleInit() {
    this.wovNftContract = this.contractService.getContract(
      this.configService.getOrThrow('WOV_MARKETPLACE_TOKEN_ADDRESS'),
      'wov-nft',
    );
  }

  async getTokenProperties(tokenId: string) {
    return await this.wovNftContract.methods.getTokenProperties(tokenId).call();
  }

  async getEditionsCount(tokenId: string): Promise<number> {
    let count = await this.wovNftContract.methods
      .woviesEditionNumber(tokenId)
      .call();

    // Get the events in batches of 100 to make sure we don't hit the node
    // request size limit.
    for (
      let index = 0;
      index < count;
      index += this.GET_EDITION_COUNT_BATCH_SIZE
    ) {
      const editionIds = Array.from(
        { length: this.GET_EDITION_COUNT_BATCH_SIZE },
        (_, i) =>
          tokenId.replace(/.{5}$/, (i + index + 1).toString().padStart(5, '0')),
      );

      const burnEvents = await this.wovNftContract.getPastEvents('Transfer', {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { to: BURN_ADDRESSES_TO_CHECK, tokenId: editionIds },
      });

      count -= burnEvents.length;
    }

    return count;
  }

  async getMintedAt(woviesId: string): Promise<number> {
    const events = await this.wovNftContract.getPastEvents('woviesCreation', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { woviesId },
    });

    return events[0].blockNumber || events[0].meta.blockNumber;
  }

  async getTokenFromBlockchain(
    tokenId: string,
  ): Promise<Omit<UpsertTokenData, 'editions'> | null> {
    const properties = await this.getTokenProperties(tokenId);

    if (isBurnAddress(properties.creatorAddress)) {
      return null;
    }

    const gateway = isIpfsCid(properties.metadataHash)
      ? this.WOV_IPFS_GATEWAY
      : this.ARWEAVE_GATEWAY;

    const [mintedAt, { data: metadata }, editionsCount] = await Promise.all([
      this.getMintedAt(tokenId),
      this.httpService.axiosRef.get(gateway + properties.metadataHash),
      this.getEditionsCount(tokenId),
    ]);

    if (editionsCount <= 0) {
      return null;
    }

    if (metadata?.categories?.length) {
      metadata.categories = metadata.categories
        ?.map((category: string | { label: string; value: string }) =>
          _.isString(category) ? category : category.value || category.label,
        )
        .filter((el?: string) => el && el.toUpperCase() in TokenCategory);
    }

    const attributes = Array.isArray(metadata.attributes)
      ? metadata.attributes.filter(
          (attribute: unknown) =>
            typeof attribute === 'object' &&
            'trait_type' in attribute &&
            'value' in attribute,
        )
      : null;

    return {
      tokenId,
      smartContractAddress: this.wovNftContract.options.address,
      name: metadata.name,
      description: metadata.description,
      creatorAddress: properties.creatorAddress,
      editionsCount,
      royalty: properties.royalty || 0,
      categories: metadata.categories || null,
      attributes,
      score: null,
      rank: null,
      collectionName: metadata.collectionName || metadata.collection_name,
      sourceImageUrl: gateway + properties.fileHash,
      mintedAt,
      stakingEarnings: null,
    };
  }
}
