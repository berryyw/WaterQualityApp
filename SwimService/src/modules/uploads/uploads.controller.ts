import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateUploadTicketDto } from './dto/create-upload-ticket.dto';
import { UploadsService } from './uploads.service';

@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('ticket')
  @UseGuards(AdminJwtGuard)
  createTicket(@Body() dto: CreateUploadTicketDto) {
    return this.uploadsService.createTicket(dto);
  }
}
