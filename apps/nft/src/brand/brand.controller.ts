import {
  BrandServiceController,
  BrandServiceControllerMethods,
  FindUniqueBrandArgs,
  GetAllBrandsResponse,
  UpsertBrandArgs,
} from '@generated/ts-proto/services/nft';
import { Brand } from '@generated/ts-proto/types/brand';
import { Controller } from '@nestjs/common';
import { BrandService } from './brand.service';

@Controller()
@BrandServiceControllerMethods()
export class BrandController implements BrandServiceController {
  constructor(private readonly brandService: BrandService) {}

  async getAll(): Promise<GetAllBrandsResponse> {
    const brands = await this.brandService.getAll();
    return { brands };
  }

  async upsert(args: UpsertBrandArgs): Promise<Brand> {
    return this.brandService.upsert(args);
  }

  async delete({ id }: FindUniqueBrandArgs): Promise<void> {
    await this.brandService.delete(id);
  }
}
