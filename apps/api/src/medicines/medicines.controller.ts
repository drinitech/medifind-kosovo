import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators/auth.decorators';
import {
  AdminMedicinesQueryDto,
  AvailabilityQueryDto,
  CreateMedicineDto,
  SearchMedicinesQueryDto,
  SuggestQueryDto,
  UpdateMedicineDto,
} from './dto/medicine.dto';
import { MedicinesService } from './medicines.service';

export const SEARCH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('medicines')
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @Public()
  @Throttle(SEARCH_THROTTLE)
  @Get()
  @ApiOperation({ summary: 'Search medicines by name, active ingredient, strength, form or package size' })
  search(@Query() query: SearchMedicinesQueryDto) {
    return this.medicines.search(query);
  }

  @Public()
  @Throttle(SEARCH_THROTTLE)
  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions (names and active ingredients)' })
  suggest(@Query() query: SuggestQueryDto) {
    return this.medicines.suggest(query.q);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Medicine details and other strengths/forms of the same product' })
  findOne(@Param('id') id: string) {
    return this.medicines.findPublic(id);
  }

  @Public()
  @Throttle(SEARCH_THROTTLE)
  @Get(':id/availability')
  @ApiOperation({ summary: 'Reported availability at verified pharmacies, with freshness and optional distance' })
  availability(@Param('id') id: string, @Query() query: AvailabilityQueryDto) {
    return this.medicines.availability(id, query);
  }
}

@ApiTags('admin')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin/medicines')
export class AdminMedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @Get()
  @ApiOperation({ summary: 'List the medicine catalog, including inactive entries' })
  list(@Query() query: AdminMedicinesQueryDto) {
    return this.medicines.adminList(query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a medicine product to the catalog' })
  create(@Body() dto: CreateMedicineDto, @CurrentUser() user: AuthUser) {
    return this.medicines.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit or (de)activate a catalog entry' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto, @CurrentUser() user: AuthUser) {
    return this.medicines.update(id, dto, user.id);
  }
}
