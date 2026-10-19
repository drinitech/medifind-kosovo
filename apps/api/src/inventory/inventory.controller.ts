import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../common/decorators/auth.decorators';
import { PharmacyScopeQueryDto } from '../pharmacies/dto/pharmacy.dto';
import {
  BulkUpdateInventoryDto,
  CreateInventoryDto,
  HistoryQueryDto,
  ImportConfirmDto,
  InventoryListQueryDto,
  UpdateInventoryDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

/** Absolute upload ceiling enforced by multer; the configurable limit (IMPORT_MAX_FILE_MB) is checked below it. */
const HARD_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;

@ApiTags('pharmacy inventory')
@ApiCookieAuth()
@Roles(Role.PHARMACY_MANAGER, Role.ADMIN)
@Controller('pharmacy/inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Inventory of the managed pharmacy (search, filter, sort, paginate)' })
  list(@CurrentUser() user: AuthUser, @Query() query: InventoryListQueryDto) {
    return this.inventory.list(user, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Overview counts for the pharmacy dashboard' })
  stats(@CurrentUser() user: AuthUser, @Query() scope: PharmacyScopeQueryDto) {
    return this.inventory.stats(user, scope.pharmacyId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Inventory change history with responsible account' })
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.inventory.history(user, query);
  }

  @Get('import/batches')
  @ApiOperation({ summary: 'Recent import previews and their status' })
  batches(@CurrentUser() user: AuthUser, @Query() scope: PharmacyScopeQueryDto) {
    return this.inventory.importBatches(user, scope.pharmacyId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a medicine to the inventory (one entry per medicine)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInventoryDto, @Query() scope: PharmacyScopeQueryDto) {
    return this.inventory.create(user, dto, scope.pharmacyId);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Apply one change to many entries atomically' })
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkUpdateInventoryDto, @Query() scope: PharmacyScopeQueryDto) {
    return this.inventory.bulkUpdate(user, dto, scope.pharmacyId);
  }

  @Post('import/preview')
  @ApiOperation({ summary: 'Upload CSV/XLSX, validate every row and return a preview (nothing is saved to inventory)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: HARD_UPLOAD_LIMIT_BYTES, files: 1 } }))
  preview(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() scope: PharmacyScopeQueryDto,
  ) {
    const maxMb = this.config.get<number>('IMPORT_MAX_FILE_MB') ?? 2;
    if (file && file.size > maxMb * 1024 * 1024) {
      throw new PayloadTooLargeException(`File is larger than ${maxMb} MB`);
    }
    return this.inventory.importPreview(user, file, scope.pharmacyId);
  }

  @Post('import/confirm')
  @ApiOperation({ summary: 'Commit a previewed import transactionally and return the import report' })
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ImportConfirmDto, @Query() scope: PharmacyScopeQueryDto) {
    return this.inventory.importConfirm(user, dto.batchId, scope.pharmacyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update status/quantity/visibility, or (re)activate an entry' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventory.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate an entry (history is preserved)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventory.deactivate(user, id);
  }
}
