// backend/src/saved-cards/saved-cards.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { SavedCardsService } from './saved-cards.service';
import { AddSavedCardDto } from './dto/add-saved-card.dto';

@ApiTags('Cartes bancaires')
@ApiBearerAuth()
@Controller('saved-cards')
export class SavedCardsController {
  constructor(
    private readonly savedCardsService: SavedCardsService,
    private readonly customerProfilesService: CustomerProfilesService,
  ) {}

  @Get('mine')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    const customerId = await this.customerProfilesService.getProfileIdForUser(user.id);
    return this.savedCardsService.findMine(customerId);
  }

  @Post()
  async add(@Body() dto: AddSavedCardDto, @CurrentUser() user: AuthenticatedUser) {
    const customerId = await this.customerProfilesService.getProfileIdForUser(user.id);
    return this.savedCardsService.add(customerId, dto);
  }

  @Patch(':id/default')
  async setDefault(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const customerId = await this.customerProfilesService.getProfileIdForUser(user.id);
    return this.savedCardsService.setDefault(customerId, id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const customerId = await this.customerProfilesService.getProfileIdForUser(user.id);
    await this.savedCardsService.remove(customerId, id);
  }
}