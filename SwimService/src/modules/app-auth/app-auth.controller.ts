import { Body, Controller, Post } from '@nestjs/common';
import { AppLoginDto } from './dto/app-login.dto';
import { AppRefreshTokenDto } from './dto/app-refresh-token.dto';
import { AppRegisterDto } from './dto/app-register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { AppAuthService } from './app-auth.service';

@Controller('app/auth')
export class AppAuthController {
  constructor(private readonly appAuthService: AppAuthService) {}

  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.appAuthService.sendCode(dto);
  }

  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.appAuthService.verifyCode(dto);
  }

  @Post('register')
  register(@Body() dto: AppRegisterDto) {
    return this.appAuthService.register(dto);
  }

  @Post('login')
  login(@Body() dto: AppLoginDto) {
    return this.appAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: AppRefreshTokenDto) {
    return this.appAuthService.refresh(dto);
  }
}
