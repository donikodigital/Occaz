// backend/src/saved-cards/saved-cards.module.ts
import { Module } from '@nestjs/common';
import { SavedCardsController } from './saved-cards.controller';
import { SavedCardsService } from './saved-cards.service';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';

@Module({
  imports: [CustomerProfilesModule],
  controllers: [SavedCardsController],
  providers: [SavedCardsService],
})
export class SavedCardsModule {}