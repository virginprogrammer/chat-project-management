import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@microsoft/microsoft-graph-client';
import { PrismaService } from '../../database/prisma.service';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Generate OAuth authorization URL for Teams
   */
  getAuthorizationUrl(state?: string): string {
    const clientId = this.configService.get('TEAMS_CLIENT_ID');
    const redirectUri = this.configService.get('TEAMS_REDIRECT_URI');
    const tenantId = this.configService.get('TEAMS_TENANT_ID') || 'common';

    const scopes = [
      'Chat.Read',
      'Chat.ReadWrite',
      'Channel.ReadBasic.All',
      'ChannelMessage.Read.All',
      'OnlineMeetings.Read',
      'OnlineMeetings.ReadWrite',
      'CallRecords.Read.All',
      'Files.Read.All',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
      state: state || '',
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const clientId = this.configService.get('TEAMS_CLIENT_ID');
    const clientSecret = this.configService.get('TEAMS_CLIENT_SECRET');
    const redirectUri = this.configService.get('TEAMS_REDIRECT_URI');
    const tenantId = this.configService.get('TEAMS_TENANT_ID') || 'common';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to exchange code for token', error);
      throw new Error('Failed to exchange authorization code');
    }

    return response.json();
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const clientId = this.configService.get('TEAMS_CLIENT_ID');
    const clientSecret = this.configService.get('TEAMS_CLIENT_SECRET');
    const tenantId = this.configService.get('TEAMS_TENANT_ID') || 'common';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('Failed to refresh token', error);
      throw new Error('Failed to refresh access token');
    }

    return response.json();
  }

  /**
   * Store integration in database
   */
  async storeIntegration(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    userId?: string,
  ) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return this.prisma.integration.create({
      data: {
        platform: 'teams',
        accessToken,
        refreshToken,
        expiresAt,
        userId,
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
        platform: 'teams',
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Create authenticated Graph client
   */
  private async getGraphClient(): Promise<Client> {
    const integration = await this.getActiveIntegration();

    if (!integration) {
      throw new Error('No active Teams integration found');
    }

    // Check if token needs refresh
    if (new Date() > new Date(integration.expiresAt.getTime() - 5 * 60 * 1000)) {
      const tokenResponse = await this.refreshAccessToken(integration.refreshToken);
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        },
      });
      integration.accessToken = tokenResponse.access_token;
    }

    return Client.init({
      authProvider: (done) => {
        done(null, integration.accessToken);
      },
    });
  }

  /**
   * Retrieve all teams
   */
  async getTeams() {
    try {
      const client = await this.getGraphClient();
      const response = await client.api('/me/joinedTeams').get();
      return response.value;
    } catch (error) {
      this.logger.error('Failed to get teams', error);
      throw error;
    }
  }

  /**
   * Retrieve channels for a team
   */
  async getChannels(teamId: string) {
    try {
      const client = await this.getGraphClient();
      const response = await client.api(`/teams/${teamId}/channels`).get();
      return response.value;
    } catch (error) {
      this.logger.error(`Failed to get channels for team ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Retrieve messages from a channel
   */
  async getChannelMessages(teamId: string, channelId: string, limit = 50) {
    try {
      const client = await this.getGraphClient();
      const response = await client
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .top(limit)
        .get();

      return response.value;
    } catch (error) {
      this.logger.error(`Failed to get messages for channel ${channelId}`, error);
      throw error;
    }
  }

  /**
   * Store messages in database
   */
  async storeMessages(messages: any[], teamId: string, channelId: string, channelName: string) {
    const storedMessages: any[] = [];

    for (const message of messages) {
      try {
        const stored = await this.prisma.message.upsert({
          where: {
            source_sourceId: {
              source: 'teams',
              sourceId: message.id,
            },
          },
          update: {
            content: message.body?.content || '',
            timestamp: new Date(message.createdDateTime),
          },
          create: {
            source: 'teams',
            sourceId: message.id,
            channelId: channelId,
            channelName: channelName,
            authorId: message.from?.user?.id || 'unknown',
            authorName: message.from?.user?.displayName || 'Unknown',
            content: message.body?.content || '',
            messageType: 'chat',
            timestamp: new Date(message.createdDateTime),
          },
        });

        storedMessages.push(stored);
      } catch (error) {
        this.logger.error(`Failed to store message ${message.id}`, error);
      }
    }

    return storedMessages;
  }

  /**
   * Sync all messages from all teams and channels
   */
  async syncAllMessages() {
    try {
      const teams = await this.getTeams();
      let totalMessages = 0;

      for (const team of teams) {
        const channels = await this.getChannels(team.id);

        for (const channel of channels) {
          try {
            const messages = await this.getChannelMessages(team.id, channel.id);
            const stored = await this.storeMessages(
              messages,
              team.id,
              channel.id,
              channel.displayName,
            );
            totalMessages += stored.length;
            this.logger.log(`Synced ${stored.length} messages from ${channel.displayName}`);
          } catch (error) {
            this.logger.error(`Failed to sync messages from channel ${channel.displayName}`, error);
          }
        }
      }

      return { success: true, totalMessages };
    } catch (error) {
      this.logger.error('Failed to sync all messages', error);
      throw error;
    }
  }

  /**
   * Get online meetings
   */
  async getOnlineMeetings() {
    try {
      const client = await this.getGraphClient();
      const response = await client.api('/me/onlineMeetings').get();
      return response.value;
    } catch (error) {
      this.logger.error('Failed to get online meetings', error);
      throw error;
    }
  }

  /**
   * Get meeting recording
   */
  async getMeetingRecording(meetingId: string) {
    try {
      const client = await this.getGraphClient();
      // Get call records
      const response = await client.api(`/communications/callRecords/${meetingId}`).get();
      return response;
    } catch (error) {
      this.logger.error(`Failed to get recording for meeting ${meetingId}`, error);
      throw error;
    }
  }

  /**
   * Download recording file
   */
  async downloadRecordingFile(fileUrl: string): Promise<Buffer> {
    try {
      const integration = await this.getActiveIntegration();
      const response = await fetch(fileUrl, {
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
      this.logger.error('Failed to download recording file', error);
      throw error;
    }
  }

  /**
   * Create webhook subscription for channel messages
   */
  async createWebhookSubscription(teamId: string, channelId: string) {
    try {
      const client = await this.getGraphClient();
      const notificationUrl = `${this.configService.get('APP_URL')}/api/webhooks/teams`;

      const subscription = {
        changeType: 'created',
        notificationUrl: notificationUrl,
        resource: `/teams/${teamId}/channels/${channelId}/messages`,
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        clientState: this.configService.get('TEAMS_WEBHOOK_SECRET'),
      };

      const response = await client.api('/subscriptions').post(subscription);
      return response;
    } catch (error) {
      this.logger.error('Failed to create webhook subscription', error);
      throw error;
    }
  }

  /**
   * Renew webhook subscription
   */
  async renewWebhookSubscription(subscriptionId: string) {
    try {
      const client = await this.getGraphClient();
      const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const response = await client.api(`/subscriptions/${subscriptionId}`).patch({
        expirationDateTime,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to renew webhook subscription', error);
      throw error;
    }
  }
}
