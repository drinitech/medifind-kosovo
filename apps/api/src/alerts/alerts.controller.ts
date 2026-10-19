import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

@ApiTags('alerts')
@ApiCookieAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Get notified when a medicine is reported available (optionally near a location)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertDto) {
    return this.alerts.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "The current user's alerts" })
  list(@CurrentUser() user: AuthUser) {
    return this.alerts.list(user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Deactivate/reactivate an alert or change its location preferences' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alerts.update(user.id, id, dto);
  }
}
