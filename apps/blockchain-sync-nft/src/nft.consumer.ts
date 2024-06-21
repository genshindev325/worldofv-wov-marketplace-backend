import {
  BlockchainSyncBaseConsumer,
  BlockchainSyncService,
} from '@app/blockchain-sync';
import { GrpcClientKind } from '@app/grpc-options/grpc-client-kind';
import {
  EditionServiceClient,
  EDITION_SERVICE_NAME,
  TokenServiceClient,
  TOKEN_SERVICE_NAME,
} from '@generated/ts-proto/services/nft';
import { InjectQueue, Processor } from '@nestjs/bullmq';
import {
  Inject,
  Logger,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Prisma as PrismaNft, TokenCategory } from '@prisma/client/nft';
import { Job, Queue } from 'bullmq';
import { ZERO_ADDRESS } from 'common/constants';
import isBurnAddress from 'common/is-burn-address';
import { encodeSerializedJson } from 'common/serialized-json';
import _ from 'lodash';
import { catchError, lastValueFrom, map, throwError } from 'rxjs';
import { EditionService } from './edition.service';
import { RegisterPhygitalJobData } from './register-phygital-job-data';
import { TokenService } from './token.service';

@Processor('blockchain/nft', {
  lockDuration: Number(process.env.QUEUE_JOB_TIMEOUT_MS) || 30000,
  concurrency:
    Number(process.env.NFT_QUEUE_JOB_CONCURRENCY) ||
    Number(process.env.QUEUE_JOB_CONCURRENCY) ||
    1,
})
export class NftConsumer
  extends BlockchainSyncBaseConsumer
  implements OnModuleInit
{
  protected readonly logger = new Logger(NftConsumer.name);

  private static readonly NFT_EDITION_COUNT_LIMIT = 300;

  private grpcToken: TokenServiceClient;
  private grpcEdition: EditionServiceClient;

  constructor(
    @Inject(GrpcClientKind.NFT)
    private readonly nftClient: ClientGrpc,

    @InjectQueue('blockchain/phygital')
    private readonly phygitalQueue: Queue<RegisterPhygitalJobData>,

    private readonly blockchainSyncService: BlockchainSyncService,
    private readonly tokenService: TokenService,
    private readonly editionService: EditionService,
  ) {
    super();
  }

  onModuleInit() {
    this.grpcToken = this.nftClient.getService(TOKEN_SERVICE_NAME);
    this.grpcEdition = this.nftClient.getService(EDITION_SERVICE_NAME);
  }

  async handleJob(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'woviesCreation':
        return await this.onWoviesCreation(job);
      case 'Transfer':
        return await this.onTransfer(job);
      default:
        throw new NotImplementedException(
          `No handler for the event "${job.data.event}" mapped to "${job.name}" has been implemented yet`,
        );
    }
  }

  async onWoviesCreation(job: Job) {
    const tokenData = await this.tokenService.getTokenFromBlockchain(
      job.data.returnValues.woviesId,
    );

    if (!tokenData) {
      this.logger.warn(
        `The token ${job.data.returnValues.woviesId} was burned`,
      );
      return;
    }

    if (tokenData.editionsCount > NftConsumer.NFT_EDITION_COUNT_LIMIT) {
      throw new Error(
        `Token '${job.data.returnValues.woviesId}' was minted with too many editions: ${tokenData.editionsCount}`,
      );
    }

    const editionsData = await this.editionService.getEditions(
      tokenData.tokenId,
    );

    const token = await lastValueFrom(
      this.grpcToken.upsert({
        where: {
          tokenId: tokenData.tokenId,
          smartContractAddress: tokenData.smartContractAddress,
        },
        data: {
          ...tokenData,
          editions: editionsData,
        },
      }),
    );

    // If the token is a Phygital we need to register it and store the
    // provenance URL in the attributes.
    if (
      tokenData.categories?.some(
        (c) => c.toUpperCase() === TokenCategory.PHYGITAL,
      )
    ) {
      const chipId = tokenData.attributes.find(
        (a) => a.trait_type === 'NFC-Chip',
      ).value;

      await this.phygitalQueue.add('REGISTER_PHYGITAL', {
        editionId: editionsData[0].editionId,
        chipId,
      });
    }

    return token;
  }

  async onTransfer(job: Job) {
    // TODO: Handle the mint events creating the missing token if necessary
    if (job.data.returnValues.from === ZERO_ADDRESS) {
      this.logger.warn(
        `[${job.id}] Skipping Transfer event because it's a mint event from address(0)`,
      );

      return;
    }

    const editionId = job.data.returnValues?.tokenId;
    const tokenId = editionId?.replace(/.{5}$/, '00000');

    if (isBurnAddress(job.data.returnValues.to)) {
      this.logger.log(
        `[${job.id}] Transfer event is a burn event to address(0)`,
      );

      const editionCount = await this.tokenService.getEditionsCount(tokenId);

      // If there are no more editions left, delete the token.
      if (!editionCount) {
        return await lastValueFrom(
          this.grpcToken.delete({
            tokenId,
            smartContractAddress: job.data.address,
          }),
        );
      } else {
        return await lastValueFrom(
          this.grpcEdition.delete({
            editionId,
            smartContractAddress: job.data.address,
          }),
        );
      }
    }

    // If the token exists, get the owner of the edition
    let ownerAddress;

    try {
      ownerAddress = await this.blockchainSyncService.getOwner(
        this.editionService.contract,
        editionId,
      );
    } catch (err) {
      const isNotMinted =
        err.message.includes('Token not minted') ||
        err.message.includes('VM reverted: EnumerableMap: nonexistent key');

      if (!isNotMinted) throw err;
    }

    if (isBurnAddress(ownerAddress)) {
      return await job.log(
        `Completion of the transfer event before execution because edition #${editionId} has not been minted or has been burned`,
      );
    }

    const tokenExists = await lastValueFrom(
      this.grpcToken
        .exists({
          tokenId,
          smartContractAddress:
            this.tokenService.wovNftContract.options.address,
        })
        .pipe(
          map(({ value }) => value),
          catchError((val) => {
            this.logger.error('grpcToken.exists exception', val);
            return throwError(() => val);
          }),
        ),
    );

    // If the token doesn't exists, create a copy of the job, replace the returnValues and handle it as a 'woviesCreation' event
    if (!tokenExists) {
      const jobCopy = _.clone(job);
      jobCopy.data.returnValues = { woviesId: tokenId };

      await this.onWoviesCreation(jobCopy);
    }

    const lastTransfer = await this.blockchainSyncService.getLastTransfer(
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
      editionId,
      ownerAddress,
    );

    if (lastTransfer) {
      await this.blockchainSyncService.cancelSaleIfInvalid(
        this.tokenService.wovNftContract.options.address,
        editionId,
        lastTransfer.meta.blockTimestamp,
      );
    }

    return await lastValueFrom(
      this.grpcEdition
        .upsert(
          encodeSerializedJson<PrismaNft.EditionUpsertArgs>({
            where: {
              editionId_smartContractAddress: {
                editionId,
                smartContractAddress:
                  this.tokenService.wovNftContract.options.address,
              },
            },
            create: {
              tokenId,
              editionId,
              smartContractAddress:
                this.tokenService.wovNftContract.options.address,
              ownerAddress,
              updatedAt: lastTransfer?.meta?.blockNumber,
            },
            update: {
              ownerAddress,
              updatedAt: lastTransfer?.meta?.blockNumber,
            },
          }),
        )
        .pipe(
          catchError((val) => {
            this.logger.error('[onTransfer] grpcToken.upsert exception', val);
            return throwError(() => val);
          }),
        ),
    );
  }
}
