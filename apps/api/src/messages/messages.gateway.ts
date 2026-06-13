import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { JwtAccessPayload } from '../auth/types/auth.types';
import { MessagesService } from './messages.service';

type AuthenticatedSocket = Socket & {
  data: {
    user?: {
      id: string;
      email: string;
      role: string;
      status: string;
    };
  };
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagesGateway {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      await client.join(this.userRoom(user.id));
      client.emit('socket:ready', { userId: user.id });
    } catch {
      client.emit('socket:error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const user = client.data.user;
    const conversationId = payload?.conversationId;
    if (!user || !conversationId) {
      client.emit('socket:error', { message: 'conversation is required' });
      return;
    }

    try {
      await this.messagesService.assertParticipant(user.id, conversationId);
      await client.join(this.conversationRoom(conversationId));
      client.emit('conversation:joined', { conversationId });
    } catch {
      client.emit('socket:error', { message: 'conversation access denied' });
    }
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    if (payload?.conversationId) {
      await client.leave(this.conversationRoom(payload.conversationId));
    }
  }

  broadcastNewMessage(conversationId: string, message: unknown) {
    this.server
      .to(this.conversationRoom(conversationId))
      .emit('message:new', message);
  }

  async broadcastConversationUpdated(conversationId: string) {
    const participantIds = await this.messagesService.listParticipantIds(
      conversationId,
    );

    participantIds.forEach((participantId) => {
      this.server
        .to(this.userRoom(participantId))
        .emit('conversation:updated', { conversationId });
    });
  }

  emitMessageDeletedForUser(userId: string, conversationId: string, messageId: string) {
    this.server.to(this.userRoom(userId)).emit('message:deletedForMe', {
      conversationId,
      messageId,
    });
  }

  emitMessageRecalled(conversationId: string, messageId: string) {
    this.server.to(this.conversationRoom(conversationId)).emit('message:recalled', {
      conversationId,
      messageId,
    });
  }

  private async authenticate(client: Socket) {
    const token =
      this.readCookie(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE) ||
      this.readBearer(client.handshake.headers.authorization) ||
      this.readHandshakeToken(client);

    if (!token) {
      throw new UnauthorizedException('missing token');
    }

    const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
        'local-dev-access-secret',
    });

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
  }

  private readHandshakeToken(client: Socket) {
    const token = client.handshake.auth?.token;
    return typeof token === 'string' && token ? token : null;
  }

  private readBearer(value: string | undefined) {
    if (!value?.startsWith('Bearer ')) return null;
    return value.slice('Bearer '.length);
  }

  private readCookie(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return null;
    const prefix = `${name}=`;
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
