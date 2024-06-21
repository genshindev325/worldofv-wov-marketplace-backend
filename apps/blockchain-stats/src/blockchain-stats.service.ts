import { ContractService } from '@blockchain/contract';
import {
  GetSalesVolumeArgs,
  GetSalesVolumeGenericObject,
} from '@generated/ts-proto/services/blockchain_stats';
import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { ZERO_ADDRESS } from 'common/constants';
import { getPaymentFromContractAddress } from 'common/get-payment-from-contract-address';
import { isSameAddress } from 'common/is-same-address.helper';
import { ThorifyContract, ThorifyEvent } from 'thorify';
import Web3 from 'web3';

@Injectable()
export class BlockchainStatsService {
  private readonly BLOCKCHAIN_RESPONSE_CHUNK_SIZE = 256;
  private readonly BLOCKCHAIN_REQUEST_PAYLOAD_SIZE = 256;

  private saleContractV2: ThorifyContract;
  private saleContractV3: ThorifyContract;
  private offerContract: ThorifyContract;
  private auctionContract: ThorifyContract;

  constructor(private readonly contractService: ContractService) {
    this.saleContractV2 = this.contractService.getContract(
      process.env.WOV_SALE_V2_ADDRESS,
      'wov-sale-v2',
    );

    this.saleContractV3 = this.contractService.getContract(
      process.env.WOV_SALE_V3_ADDRESS,
      'wov-sale-v3',
    );

    this.offerContract = this.contractService.getContract(
      process.env.WOV_OFFER_ADDRESS,
      'wov-offer',
    );

    this.auctionContract = this.contractService.getContract(
      process.env.WOV_BID_AUCTION_ADDRESS,
      'wov-auction',
    );
  }

  /**
   * We don't want to request too many events in a single request since the node
   * will start returning incomplete results.
   */
  private async getPastEventsInChunks(
    contract: ThorifyContract,
    event: string,
    options = {} as any,
  ) {
    const events: ThorifyEvent[] = [];

    for (let offset = 0; ; offset += this.BLOCKCHAIN_RESPONSE_CHUNK_SIZE) {
      const data = await contract.getPastEvents(event, {
        ...options,
        options: { offset, limit: this.BLOCKCHAIN_RESPONSE_CHUNK_SIZE },
      });

      if (data?.length) {
        events.push(...data);
      } else {
        return events;
      }
    }
  }

  /**
   * Get the matching event for an array of events that shares the same `idKey`.
   *
   * For example if we have an array of `purchase` events we might want to fetch
   * the `listing` events that share the same `saleId` in the return values.
   *
   * We do this in batch because there is a payload size limit on the request
   * body that will make it fail.
   */
  private async getMatchingEvents(
    contract: ThorifyContract,
    event: string,
    idKey: string,
    events: ThorifyEvent[],
  ) {
    const chunks: Promise<ThorifyEvent[]>[] = [];

    for (
      let offset = 0;
      offset < events.length;
      offset += this.BLOCKCHAIN_REQUEST_PAYLOAD_SIZE
    ) {
      const ids = events
        .slice(offset, offset + this.BLOCKCHAIN_REQUEST_PAYLOAD_SIZE)
        .map((event) => event.returnValues[idKey]);

      chunks.push(
        this.getPastEventsInChunks(contract, event, {
          fromBlock: 0,
          filter: { [idKey]: ids },
        }),
      );
    }

    const response = await Promise.all(chunks).then((cs) => cs.flat());

    return response.reduce(
      (vs, event) => vs.set(event.returnValues[idKey], event),
      new Map<string, ThorifyEvent>(),
    );
  }

  private getTotalFromVolumes(volumes: Map<string, BigNumber>) {
    return Array.from(volumes.entries()).map(([addressVIP180, total]) => ({
      payment: getPaymentFromContractAddress(addressVIP180),
      addressVIP180: isSameAddress(addressVIP180, ZERO_ADDRESS)
        ? null
        : addressVIP180,
      value: total.dividedBy(1e18).toFormat(2, {
        groupSize: 3,
        groupSeparator: '.',
        decimalSeparator: ',',
      }),
      asWei: total.toFormat({ groupSeparator: '' }),
    }));
  }

  public async getSales({
    range,
    smartContractAddresses,
  }: GetSalesVolumeArgs): Promise<GetSalesVolumeGenericObject> {
    const purchasesV2: any[] = await this.getPastEventsInChunks(
      this.saleContractV2,
      'purchase',
      {
        range: { unit: range.type, from: range.from, to: range.to },
        filter: { nft: smartContractAddresses },
      },
    );

    // We need the matching `listing` events because on the v2 contract
    // the `purchase` events do not contain `addressVIP180` and `price`.
    // saleId -> listing
    const listingsBySaleId = await this.getMatchingEvents(
      this.saleContractV2,
      'listing',
      'saleId',
      purchasesV2,
    );

    // addressVIP180 -> volume
    const volumes = new Map<string, BigNumber>();

    for (const event of purchasesV2) {
      const listing = listingsBySaleId.get(event.returnValues.saleId);
      let addressVIP180 = listing.returnValues.addressVIP180;
      addressVIP180 = Web3.utils.toChecksumAddress(addressVIP180);
      const current = volumes.get(addressVIP180) ?? new BigNumber(0);
      volumes.set(addressVIP180, current.plus(listing.returnValues.price));
    }

    const purchasesV3: any[] = await this.getPastEventsInChunks(
      this.saleContractV3,
      'purchaseNonCustodial',
      {
        range: { unit: range.type, from: range.from, to: range.to },
        filter: { nft: smartContractAddresses },
      },
    );

    for (const event of purchasesV3) {
      let addressVIP180 = event.returnValues.addressVIP180;
      addressVIP180 = Web3.utils.toChecksumAddress(addressVIP180);
      const current = volumes.get(addressVIP180) ?? new BigNumber(0);
      volumes.set(addressVIP180, current.plus(event.returnValues.price));
    }

    const total = this.getTotalFromVolumes(volumes);
    const transactionIds = purchasesV2.map((e) => e.meta.txID);

    return {
      total,
      transactions: { count: transactionIds.length, list: transactionIds },
    };
  }

  public async getAuctions({
    range,
    smartContractAddresses,
  }: GetSalesVolumeArgs): Promise<GetSalesVolumeGenericObject> {
    let auctionExecutedEvents: any[] = await this.getPastEventsInChunks(
      this.auctionContract,
      'auctionExecuted',
      {
        range: { unit: range.type, from: range.from, to: range.to },
        filter: { nft: smartContractAddresses },
      },
    );

    // When the price is 0 the auction has not been sold.
    auctionExecutedEvents = auctionExecutedEvents.filter(
      (e) => e.returnValues.price !== '0',
    );

    // We need the matching `newAuction` events because the `auctionExecuted`
    // events do not contain `addressVIP180` and `price`.
    // auctionId -> newAuction
    const newAuctionEventsById = await this.getMatchingEvents(
      this.auctionContract,
      'newAuction',
      'auctionId',
      auctionExecutedEvents,
    );

    // addressVIP180 -> volume
    const volumes = new Map<string, BigNumber>();

    for (const event of auctionExecutedEvents) {
      const listing = newAuctionEventsById.get(event.returnValues.auctionId);
      let addressVIP180 = listing.returnValues.addressVIP180;
      addressVIP180 = Web3.utils.toChecksumAddress(addressVIP180);
      const current = volumes.get(addressVIP180) ?? new BigNumber(0);
      volumes.set(addressVIP180, current.plus(event.returnValues.price));
    }

    const total = this.getTotalFromVolumes(volumes);
    const transactionIds = auctionExecutedEvents.map((e) => e.meta.txID);

    return {
      total,
      transactions: { count: transactionIds.length, list: transactionIds },
    };
  }

  public async getOffers({
    range,
    smartContractAddresses,
  }: GetSalesVolumeArgs) {
    const offers = await this.getPastEventsInChunks(
      this.offerContract,
      'OfferAccepted',
      {
        range: { unit: range.type, from: range.from, to: range.to },
        filter: { nft: smartContractAddresses },
      },
    );

    // addressVIP180 -> volume
    const volumes = new Map<string, BigNumber>();

    for (const offer of offers) {
      let addressVIP180 = offer.returnValues.vip180;
      addressVIP180 = Web3.utils.toChecksumAddress(addressVIP180);
      const current = volumes.get(addressVIP180) ?? new BigNumber(0);
      volumes.set(addressVIP180, current.plus(offer.returnValues.value));
    }

    const total = this.getTotalFromVolumes(volumes);
    const transactionIds = offers.map((e) => e.meta.txID);

    return {
      total,
      transactions: { count: transactionIds.length, list: transactionIds },
    };
  }
}
