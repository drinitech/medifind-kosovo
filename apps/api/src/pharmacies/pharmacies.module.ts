import { Global, Module } from '@nestjs/common';
import { PharmaciesController, PharmacyProfileController } from './pharmacies.controller';
import { PharmaciesService } from './pharmacies.service';
import { PharmacyAccessService } from './pharmacy-access.service';

@Global()
@Module({
  controllers: [PharmaciesController, PharmacyProfileController],
  providers: [PharmaciesService, PharmacyAccessService],
  exports: [PharmaciesService, PharmacyAccessService],
})
export class PharmaciesModule {}
