import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MessagesModule } from './modules/messages/messages.module';
import { TeamsModule } from './modules/teams/teams.module';
import { SlackModule } from './modules/slack/slack.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { NlpModule } from './modules/nlp/nlp.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Bull Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Database
    DatabaseModule,

    // Common modules
    StorageModule,

    // Feature modules
    AuthModule,
    ProjectsModule,
    MessagesModule,
    TeamsModule,
    SlackModule,
    TranscriptionModule,
    NlpModule,
    WebhooksModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
