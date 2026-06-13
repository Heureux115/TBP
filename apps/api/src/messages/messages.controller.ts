import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { ATTACHMENT_MAX_FILES } from '../common/file-storage';
import type { MultipartFile } from '../common/file-storage';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

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
  @UseInterceptors(FilesInterceptor('files', ATTACHMENT_MAX_FILES))
  async sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: MultipartFile[] = [],
  ) {
    const message = await this.messagesService.sendMessage(
      request.user,
      id,
      dto.body,
      files,
    );
    this.messagesGateway.broadcastNewMessage(id, message);
    await this.messagesGateway.broadcastConversationUpdated(id);
    return message;
  }

  @Delete('conversations/:id/messages/:messageId')
  async deleteMessageForMe(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const result = await this.messagesService.deleteMessageForMe(
      request.user,
      id,
      messageId,
    );
    this.messagesGateway.emitMessageDeletedForUser(request.user.id, id, messageId);
    await this.messagesGateway.broadcastConversationUpdated(id);
    return result;
  }

  @Patch('conversations/:id/messages/:messageId/recall')
  async recallMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const result = await this.messagesService.recallMessage(
      request.user,
      id,
      messageId,
    );
    this.messagesGateway.emitMessageRecalled(id, messageId);
    await this.messagesGateway.broadcastConversationUpdated(id);
    return result;
  }

  @Delete('conversations/:id')
  hideConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.messagesService.hideConversation(request.user, id);
  }
}
