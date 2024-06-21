import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { thorify } from 'thorify';
import Web3 from 'web3';
import { Web3Service } from './web3.service';

export const WEB3_CLIENT = Symbol('WEB3_CLIENT');

const web3Provider = {
  inject: [ConfigService],
  provide: WEB3_CLIENT,
  useFactory: (configService: ConfigService) => {
    const node = configService.getOrThrow<string>('VECHAIN_NODE');
    const web3 = thorify(new Web3(), node);
    return web3;
  },
};

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [web3Provider, Web3Service],
  exports: [web3Provider, Web3Service],
})
export class Web3Module {}
