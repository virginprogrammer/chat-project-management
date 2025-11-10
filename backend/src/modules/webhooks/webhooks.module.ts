import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { TeamsModule } from '../teams/teams.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [TeamsModule, SlackModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
