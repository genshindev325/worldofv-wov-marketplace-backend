import { ContractService } from '@blockchain/contract';
import {
  FetcherConfig,
  StandardArweaveFetcherConfig,
  StandardHttpFetcherConfig,
  StandardIpfsFetcherConfig,
} from '@generated/ts-proto/types/collection';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsUrl,
  ValidateNested,
  validateOrReject,
} from 'class-validator';
import { lastValueFrom } from 'rxjs';

export class TokenAttribute {
  trait_type: string;
  value: string;
}

export class TokenMetadata {
  static async fromResponse(response: any) {
    const metadata = new TokenMetadata();

    metadata.name = response.name;
    metadata.description = response.description;
    metadata.attributes = response.attributes;
    metadata.sourceImageUrl = response.image || response.img;
    metadata.rank = response.rank;
    metadata.score = response.rarity;

    await validateOrReject(metadata);

    return metadata;
  }

  name: string;

  description: string;

  @IsUrl()
  sourceImageUrl: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TokenAttribute)
  attributes?: TokenAttribute[];

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsNumber()
  score?: number;
}

@Injectable()
export class TokenFetcherService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly contractService: ContractService,
  ) {}

  private async getTokenUri(smartContractAddress: string, tokenId: string) {
    return this.contractService
      .getContract(smartContractAddress, 'pfp-standard')
      .methods.tokenURI(tokenId)
      .call();
  }

  private async fetchStandardIpfs(
    smartContractAddress: string,
    tokenId: string,
    config: StandardIpfsFetcherConfig,
  ): Promise<TokenMetadata> {
    const metadataUrlIpfs: string = await this.getTokenUri(
      smartContractAddress,
      tokenId,
    );

    if (!metadataUrlIpfs.startsWith('ipfs://')) {
      throw new Error(
        `[${this.fetchStandardIpfs.name}] Invalid metadata url: '${metadataUrlIpfs}'`,
      );
    }

    const gateway = config.ipfsGateway;
    const metadataUrl = metadataUrlIpfs.replace('ipfs://', gateway);
    const response = await lastValueFrom(this.httpService.get(metadataUrl));

    if (response.data.image.startsWith('ipfs://')) {
      response.data.image = response.data.image.replace('ipfs://', gateway);
    }

    return TokenMetadata.fromResponse(response.data);
  }

  private async fetchStandardArweave(
    smartContractAddress: string,
    tokenId: string,
    config: StandardArweaveFetcherConfig,
  ): Promise<TokenMetadata> {
    const metadataUrlArweave: string = await this.getTokenUri(
      smartContractAddress,
      tokenId,
    );

    if (!metadataUrlArweave.startsWith('ar://')) {
      throw new Error(
        `[${this.fetchStandardArweave.name}] Invalid metadata url: '${metadataUrlArweave}'`,
      );
    }

    const gateway = this.configService.get<string>('ARWEAVE_GATEWAY');
    const metadataUrl = metadataUrlArweave.replace('ar://', gateway);
    const response = await lastValueFrom(this.httpService.get(metadataUrl));

    if (response.data.image.startsWith('ar://')) {
      response.data.image = response.data.image.replace('ar://', gateway);
    }

    return TokenMetadata.fromResponse(response.data);
  }

  private async fetchStandardHttp(
    smartContractAddress: string,
    tokenId: string,
    config: StandardHttpFetcherConfig,
  ): Promise<TokenMetadata> {
    const metadataUrl: string = await this.getTokenUri(
      smartContractAddress,
      tokenId,
    );

    if (!/(http(s?)):\/\//.test(metadataUrl)) {
      throw new Error(
        `[${this.fetchStandardHttp.name}] Invalid metadata url: '${metadataUrl}'`,
      );
    }

    const response = await lastValueFrom(this.httpService.get(metadataUrl));

    return TokenMetadata.fromResponse(response.data);
  }

  async fetchMetadata(
    smartContractAddress: string,
    tokenId: string,
    config: FetcherConfig,
  ) {
    if ('standardIpfs' in config) {
      return this.fetchStandardIpfs(
        smartContractAddress,
        tokenId,
        config.standardIpfs,
      );
    } else if ('standardArweave' in config) {
      return this.fetchStandardArweave(
        smartContractAddress,
        tokenId,
        config.standardArweave,
      );
    } else if ('standardHttp' in config) {
      return this.fetchStandardHttp(
        smartContractAddress,
        tokenId,
        config.standardHttp,
      );
    } else {
      throw new Error(
        `[${this.fetchMetadata.name}] Invalid fetcher configuration.`,
      );
    }
  }
}
