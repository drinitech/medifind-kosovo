import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/decorators/auth.decorators';
import { SESSION_COOKIE } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create a public-user or pharmacy-manager account and start a session' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in; sets an HttpOnly session cookie' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Current account, pharmacy memberships and unread notification count' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private cookieOptions(): CookieOptions {
    const secure = this.config.get<boolean>('COOKIE_SECURE') ?? this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
    };
  }

  private setSessionCookie(res: Response, token: string) {
    const decoded = this.jwt.decode<{ exp?: number }>(token);
    const maxAge = decoded?.exp ? decoded.exp * 1000 - Date.now() : undefined;
    res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), maxAge });
  }
}
