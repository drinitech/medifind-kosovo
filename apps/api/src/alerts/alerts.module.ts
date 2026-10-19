import { Global, Module } from '@nestjs/common';
import { AlertMatcherService } from './alert-matcher.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AvailabilityEventsQueue } from './availability-events.queue';

@Global()
@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertMatcherService, AvailabilityEventsQueue],
  exports: [AvailabilityEventsQueue, AlertMatcherService],
})
export class AlertsModule {}
