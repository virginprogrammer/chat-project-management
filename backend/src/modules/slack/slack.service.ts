import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { PrismaService } from '../../database/prisma.service';

interface TokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  enterprise?: any;
  authed_user?: any;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Generate OAuth authorization URL for Slack
   */
  getAuthorizationUrl(state?: string): string {
    const clientId = this.configService.get('SLACK_CLIENT_ID');
    const redirectUri = this.configService.get('SLACK_REDIRECT_URI');

    const scopes = [
      'channels:history',
      'channels:read',
      'chat:write',
      'files:read',
      'groups:history',
      'groups:read',
      'im:history',
      'im:read',
      'mpim:history',
      'mpim:read',
      'users:read',
      'team:read',
    ].join(',');

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state: state || '',
    });

    return `https://slack.com/oauth/v2/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const clientId = this.configService.get('SLACK_CLIENT_ID');
    const clientSecret = this.configService.get('SLACK_CLIENT_SECRET');
    const redirectUri = this.configService.get('SLACK_REDIRECT_URI');

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();

    if (!data.ok) {
      this.logger.error('Failed to exchange code for token', data);
      throw new Error('Failed to exchange authorization code');
    }

    return data;
  }

  /**
   * Store integration in database
   */
  async storeIntegration(tokenResponse: TokenResponse, userId?: string) {
    // Slack tokens don't expire, but we set a far future date
    const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years

    return this.prisma.integration.create({
      data: {
        platform: 'slack',
        accessToken: tokenResponse.access_token,
        expiresAt,
        userId,
        workspaceId: tokenResponse.team?.id,
        workspaceName: tokenResponse.team?.name,
        isActive: true,
      },
    });
  }

  /**
   * Get active integration from database
   */
  async getActiveIntegration() {
    return this.prisma.integration.findFirst({
      where: {
        platform: 'slack',
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Create authenticated Slack client
   */
  private async getSlackClient(): Promise<WebClient> {
    const integration = await this.getActiveIntegration();

    if (!integration) {
      throw new Error('No active Slack integration found');
    }

    return new WebClient(integration.accessToken);
  }

  /**
   * Get list of channels
   */
  async getChannels() {
    try {
      const client = await this.getSlackClient();
      const response = await client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 100,
      });

      return response.channels || [];
    } catch (error) {
      this.logger.error('Failed to get channels', error);
      throw error;
    }
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(channelId: string, limit = 100) {
    try {
      const client = await this.getSlackClient();
      const response = await client.conversations.history({
        channel: channelId,
        limit: limit,
      });

      return response.messages || [];
    } catch (error) {
      this.logger.error(`Failed to get messages for channel ${channelId}`, error);
      throw error;
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(userId: string) {
    try {
      const client = await this.getSlackClient();
      const response = await client.users.info({
        user: userId,
      });

      return response.user;
    } catch (error) {
      this.logger.error(`Failed to get user info for ${userId}`, error);
      return null;
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(channelId: string) {
    try {
      const client = await this.getSlackClient();
      const response = await client.conversations.info({
        channel: channelId,
      });

      return response.channel;
    } catch (error) {
      this.logger.error(`Failed to get channel info for ${channelId}`, error);
      return null;
    }
  }

  /**
   * Store messages in database
   */
  async storeMessages(messages: any[], channelId: string, channelName: string) {
    const storedMessages: any[] = [];

    for (const message of messages) {
      try {
        // Skip bot messages and certain subtypes
        if (message.bot_id || message.subtype === 'channel_join') {
          continue;
        }

        // Get user info if not cached
        let authorName = 'Unknown';
        if (message.user) {
          const userInfo = await this.getUserInfo(message.user);
          authorName = userInfo?.real_name || userInfo?.name || 'Unknown';
        }

        const stored = await this.prisma.message.upsert({
          where: {
            source_sourceId: {
              source: 'slack',
              sourceId: message.ts,
            },
          },
          update: {
            content: message.text || '',
            timestamp: new Date(parseFloat(message.ts) * 1000),
          },
          create: {
            source: 'slack',
            sourceId: message.ts,
            channelId: channelId,
            channelName: channelName,
            authorId: message.user || 'unknown',
            authorName: authorName,
            content: message.text || '',
            messageType: 'chat',
            timestamp: new Date(parseFloat(message.ts) * 1000),
          },
        });

        storedMessages.push(stored);
      } catch (error) {
        this.logger.error(`Failed to store message ${message.ts}`, error);
      }
    }

    return storedMessages;
  }

  /**
   * Sync all messages from all channels
   */
  async syncAllMessages() {
    try {
      const channels = await this.getChannels();
      let totalMessages = 0;

      for (const channel of channels) {
        try {
          if (!channel.id || !channel.name) {
            this.logger.warn(`Skipping channel with missing id or name`);
            continue;
          }
          const messages = await this.getChannelMessages(channel.id);
          const stored = await this.storeMessages(messages, channel.id, channel.name);
          totalMessages += stored.length;
          this.logger.log(`Synced ${stored.length} messages from #${channel.name}`);
        } catch (error) {
          this.logger.error(`Failed to sync messages from #${channel.name}`, error);
        }
      }

      return { success: true, totalMessages };
    } catch (error) {
      this.logger.error('Failed to sync all messages', error);
      throw error;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(fileId: string) {
    try {
      const client = await this.getSlackClient();
      const response = await client.files.info({
        file: fileId,
      });

      return response.file;
    } catch (error) {
      this.logger.error(`Failed to get file info for ${fileId}`, error);
      throw error;
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileUrl: string, privateUrl?: string): Promise<Buffer> {
    try {
      const integration = await this.getActiveIntegration();

      if (!integration) {
        throw new Error('No active Slack integration found');
      }

      const urlToFetch = privateUrl || fileUrl;

      const response = await fetch(urlToFetch, {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error('Failed to download file', error);
      throw error;
    }
  }

  /**
   * Get team info
   */
  async getTeamInfo() {
    try {
      const client = await this.getSlackClient();
      const response = await client.team.info();
      return response.team;
    } catch (error) {
      this.logger.error('Failed to get team info', error);
      throw error;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(query: string) {
    try {
      const client = await this.getSlackClient();
      const response = await client.search.messages({
        query: query,
        sort: 'timestamp',
        sort_dir: 'desc',
      });

      return response.messages?.matches || [];
    } catch (error) {
      this.logger.error('Failed to search messages', error);
      throw error;
    }
  }
}
