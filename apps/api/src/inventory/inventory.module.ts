import { Global, Module } from '@nestjs/common';
import { AvailabilityPresenter } from './availability-presenter.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Global()
@Module({
  controllers: [InventoryController],
  providers: [InventoryService, AvailabilityPresenter],
  exports: [InventoryService, AvailabilityPresenter],
})
export class InventoryModule {}
