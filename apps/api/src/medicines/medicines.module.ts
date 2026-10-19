import { Module } from '@nestjs/common';
import { AdminMedicinesController, MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';

@Module({
  controllers: [MedicinesController, AdminMedicinesController],
  providers: [MedicinesService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
