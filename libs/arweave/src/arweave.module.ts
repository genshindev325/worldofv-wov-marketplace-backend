import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Arweave from 'arweave';
import { ArweaveService } from './arweave.service';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    {
      provide: Arweave,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return Arweave.init({
          host: 'arweave.net',
          port: 443,
          protocol: 'https',
        });
      },
    },
    ArweaveService,
  ],
  exports: [ArweaveService],
})
export class ArweaveModule {}
