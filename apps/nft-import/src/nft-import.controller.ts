import {
  DeleteCollectionArgs,
  ImportCollectionArgs,
  ImportStakingContractArgs,
  ImportTokenArgs,
  NftImportServiceController,
  NftImportServiceControllerMethods,
} from '@generated/ts-proto/services/nft_import';
import { Controller } from '@nestjs/common';
import { NftImportService } from './nft-import.service';

@Controller()
@NftImportServiceControllerMethods()
export class NftImportController implements NftImportServiceController {
  constructor(private readonly nftImportService: NftImportService) {}

  async importToken(args: ImportTokenArgs) {
    return this.nftImportService.importToken(
      args.smartContractAddress,
      args.tokenId,
    );
  }

  async importCollection(args: ImportCollectionArgs) {
    return this.nftImportService.importCollection(args);
  }

  async deleteCollection({ smartContractAddress }: DeleteCollectionArgs) {
    const deleted = await this.nftImportService.deleteCollection(
      smartContractAddress,
    );

    return { value: deleted };
  }

  async importStakingContract(args: ImportStakingContractArgs) {
    const value = await this.nftImportService.importStakingContract(args);
    return { value };
  }
}
