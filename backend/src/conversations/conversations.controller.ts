// backend/src/conversations/conversations.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('mine')
  findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findMine(user.id, query);
  }

  @Post('booking/:bookingId')
  getOrCreateForBooking(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.getOrCreateForBooking(bookingId, user.id);
  }

  @Post('shipment/:shipmentId')
  getOrCreateForShipment(@Param('shipmentId') shipmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.getOrCreateForShipment(shipmentId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findOne(
      id,
      user.id,
      user.permissions.includes(PERMISSIONS.CONVERSATION_READ),
    );
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.findMessages(
      id,
      user.id,
      user.permissions.includes(PERMISSIONS.CONVERSATION_READ),
      query,
    );
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.sendMessage(
      id,
      { id: user.id, hasSupportAccess: user.permissions.includes(PERMISSIONS.CONVERSATION_READ) },
      dto.content,
    );
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.markRead(id, user.id);
  }
}