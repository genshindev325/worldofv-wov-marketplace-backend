import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import { ContractService } from '@blockchain/contract';
import {
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { HttpService } from '@nestjs/axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client/nft';
import { Job } from 'bullmq';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import { encodeSerializedJson } from 'common/serialized-json';
import FormData from 'form-data';
import { lastValueFrom, map } from 'rxjs';
import { ThorifyContract } from 'thorify';
import { RegisterPhygitalJobData } from './register-phygital-job-data';

@Processor('blockchain/phygital', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency: Number(process.env.QUEUE_JOB_CONCURRENCY) || 1,
})
export class PhygitalConsumer extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PhygitalConsumer.name);
  private wovNftAddress: string;
  private wovNftContract: ThorifyContract;
  private grpcToken: TokenServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT) private readonly nftClient: ClientGrpc,
    private readonly contractService: ContractService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);

    this.wovNftAddress = this.configService.getOrThrow(
      'WOV_MARKETPLACE_TOKEN_ADDRESS',
    );

    this.wovNftContract = this.contractService.getContract(
      this.wovNftAddress,
      'wov-nft',
    );
  }

  /**
   * Tokens from the `Phygital` category need an additional step where the token
   * is registered thorugh the authentic8 API so the physical counterpart can be
   * created.
   */
  private async registerPhygital(editionId: string, chipId: string) {
    const tokenUri = await this.wovNftContract.methods
      .tokenURI(editionId)
      .call();

    const createFormData = new FormData();
    createFormData.append('chip_id', chipId);
    createFormData.append('contract_address', this.wovNftAddress);
    createFormData.append('token_id', editionId);
    createFormData.append('token_uri', tokenUri);

    // Check if the token is already registered.
    const createResponse = await this.httpService.axiosRef.post(
      'https://worldofv.authentic8.tech/admin/api/products/create',
      createFormData,
      {
        headers: {
          authorization: '980A69FD-0230-437C-BCF9-FE17B6CAF0FC',
          ...createFormData.getHeaders(),
        },
      },
    );

    if (createResponse.data.success) {
      this.logger.log(
        `[${this.registerPhygital.name}] Phygital registered successfully.`,
      );
      return createResponse.data.data.frontend_url as string;
    } else {
      throw new Error('Failed to register Phygital token.');
    }
  }

  async process({
    data: { chipId, editionId },
  }: Job<RegisterPhygitalJobData>): Promise<any> {
    const tokenId = getTokenIdFromEditionId(this.wovNftAddress, editionId);

    const provenance = await this.registerPhygital(editionId, chipId);

    const attributes = await lastValueFrom(
      this.grpcToken
        .findUnique(
          encodeSerializedJson<Prisma.TokenFindUniqueArgs>({
            where: {
              tokenId_smartContractAddress: {
                smartContractAddress: this.wovNftAddress,
                tokenId,
              },
            },
          }),
        )
        .pipe(map((t) => t.attributes || [])),
    );

    await lastValueFrom(
      this.grpcToken.update(
        encodeSerializedJson<Prisma.TokenUpdateArgs>({
          where: {
            tokenId_smartContractAddress: {
              smartContractAddress: this.wovNftAddress,
              tokenId,
            },
          },
          data: {
            attributes: [
              ...attributes,
              { trait_type: 'provenance', value: provenance },
            ] as any,
          },
        }),
      ),
    );
  }
}
