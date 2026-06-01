import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WalletService } from './wallet.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.walletService.getMine(request.user);
  }

  @Post('withdrawals')
  createWithdrawal(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.walletService.createWithdrawal(request.user, dto);
  }
}
