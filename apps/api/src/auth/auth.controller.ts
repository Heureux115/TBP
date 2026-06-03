import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_MARKER_COOKIE,
} from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AuthenticatedUser } from './types/auth.types';
import { createCsrfToken } from '../common/middleware/csrf.middleware';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(RateLimitGuard)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh({
      refreshToken:
        dto.refreshToken ??
        this.getCookie(request, REFRESH_TOKEN_COOKIE) ??
        undefined,
    });
    this.setAuthCookies(response, result);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    this.clearAuthCookies(response);
    return { message: 'Logged out.' };
  }

  @Get('csrf-token')
  csrfToken(@Res({ passthrough: true }) response: Response) {
    const csrfToken = createCsrfToken();
    response.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return { csrfToken };
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @UseGuards(RateLimitGuard)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(RateLimitGuard)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @UseGuards(RateLimitGuard)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user);
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ) {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = 'strict' as const;

    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: tokens.expiresIn * 1000,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    response.cookie(SESSION_MARKER_COOKIE, '1', {
      httpOnly: false,
      sameSite,
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const csrfToken = createCsrfToken();
    response.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite,
      secure,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(response: Response) {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = 'strict' as const;
    const options = { path: '/', sameSite, secure };

    response.clearCookie(ACCESS_TOKEN_COOKIE, options);
    response.clearCookie(REFRESH_TOKEN_COOKIE, options);
    response.clearCookie(SESSION_MARKER_COOKIE, options);
    response.clearCookie(CSRF_TOKEN_COOKIE, options);
  }

  private getCookie(request: Request, name: string) {
    const cookieHeader = request.header('cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const prefix = `${name}=`;
    const match = cookies.find((part) => part.startsWith(prefix));

    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
  }
}
