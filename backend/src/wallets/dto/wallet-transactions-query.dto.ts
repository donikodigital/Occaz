// backend/src/wallets/dto/wallet-transactions-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { WALLET_TX_FILTERS, type WalletTxFilter } from '../wallet-history';

export class WalletTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: WALLET_TX_FILTERS,
    default: 'ALL',
    description: "Catégorie de l'historique : TRIPS (trajets), SHIPMENTS (envois), PAYOUTS (retraits), OTHER (remboursements, ajustements…). Les totaux de toutes les catégories sont toujours renvoyés.",
  })
  @IsOptional()
  @IsIn([...WALLET_TX_FILTERS])
  category?: WalletTxFilter;
}
