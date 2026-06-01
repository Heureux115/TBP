import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  listConversations(@Req() request: AuthenticatedRequest) {
    return this.messagesService.listConversations(request.user);
  }

  @Post('conversations')
  createConversation(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.ensureConversation(request.user, dto.bookingId);
  }

  @Get('conversations/:id/messages')
  listMessages(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.listMessages(request.user, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(request.user, id, dto.body);
  }

  @Delete('conversations/:id/messages/:messageId')
  deleteMessageForMe(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessageForMe(
      request.user,
      id,
      messageId,
    );
  }

  @Patch('conversations/:id/messages/:messageId/recall')
  recallMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.recallMessage(request.user, id, messageId);
  }

  @Delete('conversations/:id')
  hideConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.messagesService.hideConversation(request.user, id);
  }
}
