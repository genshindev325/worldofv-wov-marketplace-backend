import { ArweaveService } from '@app/arweave';
import { GqlUserGuard } from '@app/login';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Recaptcha } from '@nestlab/google-recaptcha';
import streamToBuffer from 'common/stream-to-buffer.helper';
import { fromBuffer } from 'file-type';
import { PinImageToArweaveArgs } from './pin-image-to-arweave-args';
import PinTokenMetadataArgs from './pin-token-metadata.args';
import PinTokenMetadataResponse from './pin-token-metadata.response';

@Resolver()
export class ArweaveResolver {
  private readonly ARWEAVE_GATEWAY: string;

  constructor(
    private readonly arweaveService: ArweaveService,
    configService: ConfigService,
  ) {
    this.ARWEAVE_GATEWAY = configService
      .getOrThrow('ARWEAVE_GATEWAY')
      .replace(/\/?$/, '/');
  }

  @Mutation(() => String)
  @UseGuards(GqlUserGuard)
  @Recaptcha({ action: 'pin_image' })
  async pinImageToArweave(@Args() { image }: PinImageToArweaveArgs) {
    const upload = await image;
    const data = await streamToBuffer(upload.createReadStream());

    const { mime } = await fromBuffer(data);

    if (!mime.startsWith('video') && !mime.startsWith('image')) {
      throw new BadRequestException(
        `[${this.pinImageToArweave.name}] Unsupported mime type: ${mime}.`,
      );
    }

    const tx = await this.arweaveService.upload(
      { data },
      { 'Content-Type': mime },
    );

    return tx.id;
  }

  @Mutation(() => PinTokenMetadataResponse)
  @UseGuards(GqlUserGuard)
  @Recaptcha({ action: 'pin_metadata' })
  async pinMetadataToArweave(
    @Args()
    {
      image,
      name,
      attributes,
      collectionName,
      description,
      categories,
    }: PinTokenMetadataArgs,
  ) {
    const upload = await image;
    const data = await streamToBuffer(upload.createReadStream());

    const { mime } = await fromBuffer(data);

    if (!mime.startsWith('video') && !mime.startsWith('image')) {
      throw new BadRequestException(
        `[${this.pinMetadataToArweave.name}] Unsupported mime type: ${mime}.`,
      );
    }

    const { id: imageTxId } = await this.arweaveService.upload(
      { data },
      { 'Content-Type': mime },
    );

    const metadata = {
      image: this.ARWEAVE_GATEWAY + imageTxId,
      image_mime_type: mime,
      name: name,
      attributes: attributes,
      collection_name: collectionName,
      description: description,
      categories: categories,
    };

    const { id: metadataTxId } = await this.arweaveService.upload(
      { data: JSON.stringify(metadata) },
      { 'Content-Type': 'application/json' },
    );

    return { metadataTxId, imageTxId };
  }
}
