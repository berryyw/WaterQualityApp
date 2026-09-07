import { IsIn } from 'class-validator';

export class UpdateVenueStatusDto {
  @IsIn(['normal', 'disabled'])
  status!: 'normal' | 'disabled';
}
