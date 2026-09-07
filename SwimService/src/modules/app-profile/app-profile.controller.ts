import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AppAuthContext } from '../../common/auth/auth-request.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppJwtGuard } from '../../common/guards/app-jwt.guard';
import { ChangeAppEmailDto } from './dto/change-app-email.dto';
import { ChangeAppPasswordDto } from './dto/change-app-password.dto';
import { UpdateAppProfileDto } from './dto/update-app-profile.dto';
import { AppProfileService } from './app-profile.service';

@Controller('app/me')
@UseGuards(AppJwtGuard)
export class AppProfileController {
  constructor(private readonly appProfileService: AppProfileService) {}

  @Get()
  getMe(@CurrentUser() user: AppAuthContext) {
    return this.appProfileService.getMe(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AppAuthContext,
    @Body() dto: UpdateAppProfileDto,
  ) {
    return this.appProfileService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('仅支持上传图片文件'), false);
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AppAuthContext,
    @UploadedFile()
    file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!file) {
      throw new BadRequestException('请先选择头像文件');
    }

    return this.appProfileService.uploadAvatar(user.id, file);
  }

  @Post('email')
  changeEmail(
    @CurrentUser() user: AppAuthContext,
    @Body() dto: ChangeAppEmailDto,
  ) {
    return this.appProfileService.changeEmail(user.id, dto);
  }

  @Post('password')
  changePassword(
    @CurrentUser() user: AppAuthContext,
    @Body() dto: ChangeAppPasswordDto,
  ) {
    return this.appProfileService.changePassword(user.id, dto);
  }
}
