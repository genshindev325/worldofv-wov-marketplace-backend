declare module 'thorify' {
  export { PromiEvent } from 'web3-core';
  export { Subscription } from 'web3-core-subscriptions';

  export interface ThorifyEventMeta {
    /**Identifier of the block(bytes32) this event was created in */
    blockID: string;

    /**Number of block this event was created in */
    blockNumber: number;

    /**Unix timestamp of block */
    blockTimestamp: number;

    /**Identifier of the transaction this event was created in */
    txID: string;

    /**The one who signed the transaction */
    txOrigin: string;
  }

  export interface ThorifyEventRaw {
    /**: The data containing non-indexed log parameter */
    data: string;

    /**: An array with max 4 32 Byte topics, topic 1-3 contains indexed parameters of the log */
    topics: string[];
  }

  export interface ThorifyEvent {
    /**: The event name. */
    event: string;

    /**: The event signature, null if it’s an anonymous event. */
    signature: string | null;

    /**: The return values coming from the event */
    returnValues: Record<string, any>;

    /**: From which this event originated from */
    address: string;

    /**: Same as meta.blockNumber */
    blockNumber: number;

    /**: Same as meta.blockID */
    blockHash: string;

    /**: Same as meta.txID */
    transactionHash: string;

    meta: ThorifyEventMeta;

    raw: ThorifyEventRaw;
  }

  export declare class ThorifyContract {
    constructor(jsonInterface: any, address?: string, options?: any);

    options: any;
    methods: any;
    events: any;

    clone(): ThorifyContract;
    deploy(options: any): any;

    once(
      event: string,
      options?: any,
      callback?: (error: any, event: any) => void,
    ): void;

    getPastEvents(event: string, options?: any): Promise<ThorifyEvent[]>;
  }

  export declare interface ThorifyEth {
    getBalance(
      address: string,
      blockNumberOrHash?: string | number,
    ): Promise<string>;
    getEnergy(
      address: string,
      blockNumberOrHash?: string | number,
    ): Promise<string>;
    getChainTag(): Promise<string>;
    getBlockNumber(): Promise<number>;
    getBlock(blockNumberOrHash?: string | number): Promise<any>;
    getTransaction(transactionID: string): Promise<any>;
    getTransactionReceipt(transactionHash: string): Promise<any>;
    sendSignedTransaction(signedTransaction: string): PromiEvent<any>;
    sendTransaction(transaction: any): PromiEvent<any>;
    call(
      transaction: any,
      blockNumberOrHash?: string | number,
    ): Promise<string>;
    estimateGas(transaction: any): Promise<number | null>;
    getPastLogs(options: any): Promise<any>;
    clearSubscriptions(): void;
    subscribe(
      type: 'newBlockHeaders',
      position?: string,
      callback?: (error: any, data: any) => void,
    ): Subscription<any>;
    subscribe(
      type: 'transfers',
      options?: any,
      callback?: (error: any, data: any) => void,
    ): Subscription<any>;
    subscribe(
      type: 'logs',
      options?: any,
      callback?: (error: any, data: any) => void,
    ): Subscription<any>;

    Contract: typeof ThorifyContract;
  }

  export declare interface ThorifyWeb3 {
    eth: ThorifyEth;
  }

  export declare const thorify: (
    web3Instance: any,
    host?: string,
    timeout?: number,
  ) => ThorifyWeb3;
}
