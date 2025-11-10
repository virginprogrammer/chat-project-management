import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Process Teams webhook notification
   */
  async processTeamsNotification(notification: any) {
    this.logger.log('Processing Teams notification');

    try {
      // Validate client state
      const expectedClientState = this.configService.get('TEAMS_WEBHOOK_SECRET');
      if (notification.clientState !== expectedClientState) {
        throw new Error('Invalid client state');
      }

      // Process each notification
      for (const item of notification.value || []) {
        if (item.changeType === 'created' && item.resourceData) {
          await this.handleTeamsMessageCreated(item);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process Teams notification', error);
      throw error;
    }
  }

  /**
   * Handle Teams message created event
   */
  private async handleTeamsMessageCreated(item: any) {
    try {
      // Extract message details from the notification
      const resourceData = item.resourceData;

      // Store the message in database
      await this.prisma.message.create({
        data: {
          source: 'teams',
          sourceId: resourceData.id,
          channelId: resourceData.channelId || 'unknown',
          channelName: 'Unknown', // Would need to fetch from API
          authorId: resourceData.from?.user?.id || 'unknown',
          authorName: resourceData.from?.user?.displayName || 'Unknown',
          content: resourceData.body?.content || '',
          messageType: 'chat',
          timestamp: new Date(resourceData.createdDateTime || Date.now()),
        },
      });

      this.logger.log(`Stored new Teams message: ${resourceData.id}`);
    } catch (error) {
      this.logger.error('Failed to handle Teams message created', error);
    }
  }

  /**
   * Verify Slack request signature
   */
  async verifySlackSignature(body: any, signature: string): Promise<boolean> {
    const slackSigningSecret = this.configService.get('SLACK_SIGNING_SECRET');
    const timestamp = body.timestamp;
    const requestBody = JSON.stringify(body);

    const signatureBaseString = `v0:${timestamp}:${requestBody}`;
    const expectedSignature =
      'v0=' +
      crypto.createHmac('sha256', slackSigningSecret).update(signatureBaseString).digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid Slack signature');
    }

    return true;
  }

  /**
   * Process Slack event
   */
  async processSlackEvent(event: any) {
    this.logger.log('Processing Slack event');

    try {
      if (event.event?.type === 'message' && !event.event.subtype) {
        await this.handleSlackMessage(event.event);
      }
    } catch (error) {
      this.logger.error('Failed to process Slack event', error);
      throw error;
    }
  }

  /**
   * Handle Slack message event
   */
  private async handleSlackMessage(message: any) {
    try {
      await this.prisma.message.create({
        data: {
          source: 'slack',
          sourceId: message.ts,
          channelId: message.channel,
          channelName: 'Unknown', // Would need to fetch from API
          authorId: message.user,
          authorName: 'Unknown', // Would need to fetch from API
          content: message.text || '',
          messageType: 'chat',
          timestamp: new Date(parseFloat(message.ts) * 1000),
        },
      });

      this.logger.log(`Stored new Slack message: ${message.ts}`);
    } catch (error) {
      this.logger.error('Failed to handle Slack message', error);
    }
  }
}
