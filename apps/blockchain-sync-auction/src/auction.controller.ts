import { GetAuctionHistoryArgs } from '@generated/ts-proto/services/auction';
import {
  BlockchainSyncAuctionServiceController,
  BlockchainSyncAuctionServiceControllerMethods,
  GetAuctionFromBlockchainArgs,
  GetAuctionParticipantsArgs,
} from '@generated/ts-proto/services/blockchain_sync_auction';
import { Controller, Logger } from '@nestjs/common';
import { AuctionService } from './auction.service';

@Controller()
@BlockchainSyncAuctionServiceControllerMethods()
export class BlockchainSyncAuctionController
  implements BlockchainSyncAuctionServiceController
{
  private readonly logger = new Logger(BlockchainSyncAuctionController.name);

  constructor(private readonly auctionService: AuctionService) {}

  async getAuctionFromBlockchain(args: GetAuctionFromBlockchainArgs) {
    const auction = await this.auctionService.getAuction(
      args.auctionId,
      args.tokenId,
      args.smartContractAddress,
    );

    return {
      ...auction,
      startingTime: auction.startingTime.toISOString(),
      endTime: auction.endTime.toISOString(),
    };
  }

  async getAuctionHistory(args: GetAuctionHistoryArgs) {
    const history = await this.auctionService.getHistory(args);
    return { history };
  }

  async getAuctionParticipants(args: GetAuctionParticipantsArgs) {
    const participants = await this.auctionService.getParticipants(
      args.auctionId,
    );

    return { participants };
  }
}
