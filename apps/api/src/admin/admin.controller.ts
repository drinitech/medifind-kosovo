import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../common/decorators/auth.decorators';
import { AdminService } from './admin.service';
import {
  AddMemberDto,
  AdminHistoryQueryDto,
  AdminInventoryQueryDto,
  AdminPharmaciesQueryDto,
  AdminUpdateInventoryDto,
  AdminUpdatePharmacyDto,
  AdminUpdateUserDto,
  AdminUsersQueryDto,
  AuditLogQueryDto,
  VerifyPharmacyDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiCookieAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'System statistics, data freshness and recent activity' })
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('pharmacies')
  @ApiOperation({ summary: 'All pharmacies, including unverified and inactive' })
  pharmacies(@Query() query: AdminPharmaciesQueryDto) {
    return this.admin.pharmacies(query);
  }

  @Patch('pharmacies/:id/verify')
  @ApiOperation({ summary: 'Verify (or revoke verification of) a pharmacy' })
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VerifyPharmacyDto) {
    return this.admin.verifyPharmacy(user, id, dto.isVerified);
  }

  @Patch('pharmacies/:id')
  @ApiOperation({ summary: 'Activate/deactivate a pharmacy' })
  updatePharmacy(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdatePharmacyDto) {
    return this.admin.updatePharmacy(user, id, dto);
  }

  @Post('pharmacies/:id/members')
  @ApiOperation({ summary: 'Grant a user access to manage a pharmacy' })
  addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.admin.addMember(user, id, dto.email);
  }

  @Delete('pharmacies/:id/members/:userId')
  @ApiOperation({ summary: "Revoke a user's access to a pharmacy" })
  removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.admin.removeMember(user, id, userId);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search and filter user accounts' })
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.users(query);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: "Change a user's role or deactivate the account" })
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.admin.updateUser(user, id, dto);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Review inventory across pharmacies (oldest reports first)' })
  inventory(@Query() query: AdminInventoryQueryDto) {
    return this.admin.inventoryList(query);
  }

  @Patch('inventory/:id')
  @ApiOperation({ summary: 'Deactivate or restore an incorrect inventory entry' })
  updateInventory(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateInventoryDto) {
    return this.admin.updateInventory(user, id, dto.isActive);
  }

  @Get('inventory-history')
  @ApiOperation({ summary: 'Inventory update history across all pharmacies' })
  history(@Query() query: AdminHistoryQueryDto) {
    return this.admin.inventoryHistory(query);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit log of sensitive changes' })
  auditLogs(@Query() query: AuditLogQueryDto) {
    return this.admin.auditLogs(query);
  }
}
