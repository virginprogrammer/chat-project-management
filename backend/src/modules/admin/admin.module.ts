import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TeamsModule } from '../teams/teams.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [TeamsModule, SlackModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
