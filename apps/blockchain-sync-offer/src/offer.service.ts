import { ContractService } from '@blockchain/contract';
import { OfferStatus, OfferType } from '@generated/ts-proto/types/offer';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { isSameAddress } from 'common/is-same-address.helper';
import { ThorifyContract } from 'thorify';

@Injectable()
export class OfferService implements OnModuleInit {
  public contract: ThorifyContract;

  constructor(private readonly contractService: ContractService) {}

  async onModuleInit() {
    this.contract = this.contractService.getContract(
      process.env.WOV_OFFER_ADDRESS,
      'wov-offer',
    );
  }

  private async getDataFromBlockchain(
    offerType: OfferType,
    offerId: string,
    nftId: string,
    smartContractAddress: string,
  ) {
    switch (offerType) {
      case OfferType.EDITION:
        return await this.contract.methods
          .OfferToToken(offerId, smartContractAddress, nftId)
          .call();
      case OfferType.TOKEN:
        return await this.contract.methods
          .GlobalOfferToToken(offerId, smartContractAddress, nftId)
          .call();
      case OfferType.COLLECTION:
        return await this.contract.methods
          .CollectionOfferToToken(offerId, smartContractAddress)
          .call();
    }
  }

  async getOffer(
    blockchainOfferType: string,
    offerId: string,
    nftId: string,
    smartContractAddress: string,
  ) {
    let offerType: OfferType;

    switch (parseInt(blockchainOfferType)) {
      case 1:
        offerType = OfferType.EDITION;
        break;
      case 2:
        offerType = OfferType.TOKEN;
        break;
      case 3:
        offerType = OfferType.COLLECTION;
        break;
      default:
        throw new Error(`Unknown offer type: ${blockchainOfferType}`);
    }

    /**
     * There is a bug in the contract that allows creating a global offer with
     * an edition id as target. We want to save the token id to the db anyway.
     */
    const woviesId = isSameAddress(
      smartContractAddress,
      process.env.WOV_MARKETPLACE_TOKEN_ADDRESS,
    )
      ? nftId?.replace(/.{5}$/, '00000')
      : nftId;

    let tokenId = null;
    let editionId = null;

    switch (offerType) {
      case OfferType.EDITION:
        tokenId = woviesId;
        editionId = nftId;
        break;
      case OfferType.TOKEN:
        tokenId = woviesId;
        break;
      case OfferType.COLLECTION:
      default:
        break;
    }

    // Get data from blockchain mapping offerType to the correct method
    const data = await this.getDataFromBlockchain(
      offerType,
      offerId,
      nftId,
      smartContractAddress,
    );

    // Check for OfferAccepted event in order to understand the status and get acceptorAddress because data.seller is bugged and is always address(0)
    let acceptorAddress = null;
    let status: OfferStatus = OfferStatus.ACTIVE;

    if (data.isClosed) {
      const acceptedEvents = await this.contract.getPastEvents(
        'OfferAccepted',
        {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { offerId },
        },
      );

      if (acceptedEvents?.length) {
        status = OfferStatus.ACCEPTED;
        acceptorAddress = acceptedEvents[0].meta.txOrigin;
      } else {
        status = OfferStatus.CANCELLED;
      }
    }

    // Return the object to save into the database
    return {
      offerId,
      tokenId,
      editionId,
      smartContractAddress,
      bidderAddress: data.buyer,
      acceptorAddress,
      price: data.price || null,
      addressVIP180: data.addressVIP180,
      startingTime: new Date(parseInt(data.startTime) * 1000).toISOString(),
      endTime: new Date(parseInt(data.endTime) * 1000).toISOString(),
      type: offerType,
      status,
    };
  }
}
