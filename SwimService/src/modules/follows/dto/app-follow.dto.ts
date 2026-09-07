import { IsUUID } from 'class-validator';

export class AppFollowDto {
  @IsUUID()
  userId!: string;
}
