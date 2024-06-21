import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { GqlAdminGuard } from '@app/login';
import {
  NftImportServiceClient,
  NFT_IMPORT_SERVICE_NAME,
} from '@generated/ts-proto/services/nft_import';
import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import {
  FetcherType,
  ImportCollectionArgs as GqlImportCollectionArgs,
} from 'apps/gateway/src/import/import-collection.args';
import { lastValueFrom, map } from 'rxjs';
import { CollectionDTO } from '../collections/collection.response';
import { ImportStakingContractArgs } from './import-staking-contract.args';

@Resolver()
export class ImportResolver implements OnModuleInit {
  private readonly logger = new Logger(ImportResolver.name);

  private grpcNftImport: NftImportServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT_IMPORT)
    private readonly nftImportClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpcNftImport = this.nftImportClient.getService(
      NFT_IMPORT_SERVICE_NAME,
    );
  }

  private getFetcherConfigFromGql(fetcher: FetcherType, fetcherConfig: any) {
    switch (fetcher) {
      case FetcherType.STANDARD_IPFS:
        return { standardIpfs: fetcherConfig };
      case FetcherType.STANDARD_ARWEAVE:
        return { standardArweave: fetcherConfig };
      case FetcherType.STANDARD_HTTP:
        return { standardHttp: fetcherConfig };
    }
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => CollectionDTO)
  async importCollection(
    @Args()
    { fetcher, fetcherConfig, ...args }: GqlImportCollectionArgs,
  ) {
    return lastValueFrom(
      this.grpcNftImport.importCollection({
        ...args,
        fetcherConfig: this.getFetcherConfigFromGql(fetcher, fetcherConfig),
      }),
    );
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async adminDeleteCollection(
    @Args('smartContractAddress') smartContractAddress: string,
  ) {
    const { value: deleted } = await lastValueFrom(
      this.grpcNftImport.deleteCollection({ smartContractAddress }),
    );

    return deleted;
  }

  @UseGuards(GqlAdminGuard)
  @Mutation(() => Boolean)
  async importStakingContract(@Args() args: ImportStakingContractArgs) {
    return lastValueFrom(
      this.grpcNftImport
        .importStakingContract(args)
        .pipe(map(({ value }) => value)),
    );
  }
}
