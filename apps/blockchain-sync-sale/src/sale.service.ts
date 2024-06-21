import { ContractService } from '@blockchain/contract';
import { Sale } from '@generated/ts-proto/types/sale';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { SaleStatus } from '@prisma/client/sale';
import { ZERO_ADDRESS } from 'common/constants';
import { formatPrice } from 'common/format-price.helper';
import getTokenIdFromEditionId from 'common/get-token-id-from-edition-id.helper';
import { isSameAddress } from 'common/is-same-address.helper';
import { ThorifyContract } from 'thorify';

@Injectable()
export class SaleService implements OnModuleInit {
  public contract_v2: ThorifyContract;
  public contract_v3: ThorifyContract;

  constructor(private readonly contractService: ContractService) {}

  async onModuleInit() {
    this.contract_v2 = this.contractService.getContract(
      process.env.WOV_SALE_V2_ADDRESS,
      'wov-sale-v2',
    );

    this.contract_v3 = this.contractService.getContract(
      process.env.WOV_SALE_V3_ADDRESS,
      'wov-sale-v3',
    );
  }

  private async getLastBlockNumberForEvent(
    contractVersion: 'v2' | 'v3',
    saleId: string,
    event: string,
  ) {
    const contract =
      contractVersion === 'v2' ? this.contract_v2 : this.contract_v3;

    return await contract
      .getPastEvents(event, {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { saleId },
      })
      .then((data) =>
        data.sort(
          (a, b) =>
            (b.blockNumber || b.meta.blockNumber) -
            (a.blockNumber || a.meta.blockNumber),
        ),
      )
      .then((events) =>
        events.length
          ? events[0].blockNumber || events[0].meta.blockNumber
          : null,
      );
  }

  private async getUpdatedAt(
    contractVersion: 'v2' | 'v3',
    saleId: string,
    status: SaleStatus,
  ) {
    switch ([status, contractVersion]) {
      case [SaleStatus.CANCELLED, 'v2']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'cancel',
        );
      case [SaleStatus.PURCHASED, 'v2']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'purchase',
        );
      case [SaleStatus.LISTED, 'v2']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'listing',
        );
      case [SaleStatus.CANCELLED, 'v3']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'cancelNonCustodial',
        );
      case [SaleStatus.PURCHASED, 'v3']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'purchaseNonCustodial',
        );
      case [SaleStatus.LISTED, 'v3']:
        return this.getLastBlockNumberForEvent(
          contractVersion,
          saleId,
          'listingNonCustodial',
        );
    }
  }

  async getSale(
    saleId: string,
    editionId: string,
    smartContractAddress: string,
    contractVersion: 'v2' | 'v3',
  ): Promise<Sale> {
    const contract =
      contractVersion === 'v2' ? this.contract_v2 : this.contract_v3;

    // Get data from the blockchain
    const saleData = await contract.methods
      .tokenToSale(saleId, smartContractAddress, editionId)
      .call();

    if (!saleData.price) {
      throw new NotFoundException(
        `Couldn't find price for sale of edition ${editionId}`,
      );
    }

    // If the token comes from marketplace address extract the tokenId from the edition
    const tokenId = getTokenIdFromEditionId(smartContractAddress, editionId);

    // If the buyer is equal to address(0) set as NULL
    const buyerAddress =
      saleData.buyer !== ZERO_ADDRESS ? saleData.buyer : null;

    // Get the status based on the data
    let status = buyerAddress
      ? SaleStatus.PURCHASED
      : saleData.isClosed
      ? SaleStatus.CANCELLED
      : SaleStatus.LISTED;

    /**
     * When using non custodial listing the sale is to be considered cancelled
     * if the token was transferred during the listing period, even in case it
     * gets transferred back to the original owner.
     */
    if (contractVersion === 'v3' && status === SaleStatus.LISTED) {
      const abiKind = isSameAddress(
        smartContractAddress,
        process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
      )
        ? 'wov-nft'
        : 'pfp-standard';

      const nftContract = this.contractService.getContract(
        smartContractAddress,
        abiKind,
      );

      const transfers = await nftContract.getPastEvents('Transfer', {
        range: { unit: 'time', from: saleData.startingTime },
        options: { limit: 1 },
      });

      if (transfers.length) {
        status = SaleStatus.CANCELLED;
      }
    }

    // If the addressVIP180 is equal to address(0) set as NULL
    const addressVIP180 =
      saleData.addressVIP180 !== ZERO_ADDRESS ? saleData.addressVIP180 : null;

    // Get the createdAt and updatedAt block number
    const createdAt = await this.getLastBlockNumberForEvent(
      contractVersion,
      saleId,
      contractVersion === 'v2' ? 'listing' : 'listingNonCustodial',
    );

    const updatedAt = await this.getUpdatedAt(contractVersion, saleId, status);

    // Starting time can be either in milliseconds or seconds
    const rawStartingTime = parseInt(saleData.startingTime);
    const tomorrow = (Date.now() + 24 * 60 * 60 * 1000) / 1000;
    const isInMillisecond = rawStartingTime > tomorrow;
    const multiplier = isInMillisecond ? 1 : 1000;
    const startingTime = new Date(rawStartingTime * multiplier).toISOString();

    // Return the object to save into the database
    return {
      saleId,
      tokenId,
      editionId,
      smartContractAddress,
      sellerAddress: saleData.seller,
      buyerAddress,
      price: formatPrice(saleData.price),
      addressVIP180,
      startingTime,
      status,
      createdAt,
      updatedAt,
    };
  }
}
