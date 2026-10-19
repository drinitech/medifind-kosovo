import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators/auth.decorators';
import { SEARCH_THROTTLE } from '../medicines/medicines.controller';
import {
  ListPharmaciesQueryDto,
  NearbyQueryDto,
  PharmacyInventoryPublicQueryDto,
  PharmacyProfileDto,
  PharmacyScopeQueryDto,
  UpdatePharmacyProfileDto,
} from './dto/pharmacy.dto';
import { PharmaciesService } from './pharmacies.service';

@ApiTags('pharmacies')
@Controller('pharmacies')
export class PharmaciesController {
  constructor(private readonly pharmacies: PharmaciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List verified pharmacies' })
  list(@Query() query: ListPharmaciesQueryDto) {
    return this.pharmacies.list(query);
  }

  @Public()
  @Get('cities')
  @ApiOperation({ summary: 'Cities that have at least one verified pharmacy' })
  cities() {
    return this.pharmacies.cities();
  }

  @Public()
  @Throttle(SEARCH_THROTTLE)
  @Get('nearby')
  @ApiOperation({ summary: 'Verified pharmacies near a point, nearest first' })
  nearby(@Query() query: NearbyQueryDto) {
    return this.pharmacies.nearby(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Public pharmacy profile (by id or slug)' })
  findOne(@Param('id') id: string) {
    return this.pharmacies.findPublic(id);
  }

  @Public()
  @Get(':id/inventory')
  @ApiOperation({ summary: 'Reported inventory of a verified pharmacy' })
  inventory(@Param('id') id: string, @Query() query: PharmacyInventoryPublicQueryDto) {
    return this.pharmacies.publicInventory(id, query);
  }
}

@ApiTags('pharmacy')
@ApiCookieAuth()
@Roles(Role.PHARMACY_MANAGER, Role.ADMIN)
@Controller('pharmacy/profile')
export class PharmacyProfileController {
  constructor(private readonly pharmacies: PharmaciesService) {}

  @Get()
  @ApiOperation({ summary: 'The pharmacy managed by the current account' })
  get(@CurrentUser() user: AuthUser, @Query() scope: PharmacyScopeQueryDto) {
    return this.pharmacies.getOwnProfile(user, scope.pharmacyId);
  }

  @Post()
  @Roles(Role.PHARMACY_MANAGER)
  @ApiOperation({ summary: 'Register a pharmacy (pending admin verification)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: PharmacyProfileDto) {
    return this.pharmacies.createProfile(user, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the managed pharmacy profile' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePharmacyProfileDto, @Query() scope: PharmacyScopeQueryDto) {
    return this.pharmacies.updateProfile(user, dto, scope.pharmacyId);
  }
}
