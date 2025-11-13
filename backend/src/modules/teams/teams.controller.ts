import { Controller, Get, Query, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('auth/url')
  @ApiOperation({ summary: 'Get Teams OAuth authorization URL' })
  @ApiQuery({ name: 'state', required: false })
  getAuthUrl(@Query('state') state?: string) {
    const url = this.teamsService.getAuthorizationUrl(state);
    return { url };
  }

  @Get('auth/callback')
  @ApiOperation({ summary: 'Handle Teams OAuth callback' })
  async handleCallback(@Query('code') code: string) {
    try {
      const tokenResponse = await this.teamsService.exchangeCodeForToken(code);
      await this.teamsService.storeIntegration(
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_in,
      );

      return {
        success: true,
        message: 'Teams integration connected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect Teams integration',
        error: error.message,
      };
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Microsoft Teams integration status' })
  async getStatus() {
    try {
      const integration = await this.teamsService.getActiveIntegration();
      return {
        integration: 'teams',
        status: integration ? 'connected' : 'not_connected',
        connected: !!integration,
        expiresAt: integration?.expiresAt,
      };
    } catch (error) {
      return {
        integration: 'teams',
        status: 'error',
        error: error.message,
      };
    }
  }

  @Get('list')
  @ApiOperation({ summary: 'Get all Teams' })
  async getTeams() {
    try {
      const teams = await this.teamsService.getTeams();
      return { teams };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get(':teamId/channels')
  @ApiOperation({ summary: 'Get channels for a team' })
  async getChannels(@Param('teamId') teamId: string) {
    try {
      const channels = await this.teamsService.getChannels(teamId);
      return { channels };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get(':teamId/channels/:channelId/messages')
  @ApiOperation({ summary: 'Get messages from a channel' })
  @ApiQuery({ name: 'limit', required: false })
  async getChannelMessages(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
    @Query('limit') limit?: number,
  ) {
    try {
      const messages = await this.teamsService.getChannelMessages(teamId, channelId, limit);
      return { messages };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync all messages from Teams' })
  async syncMessages() {
    try {
      const result = await this.teamsService.syncAllMessages();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('meetings')
  @ApiOperation({ summary: 'Get online meetings' })
  async getMeetings() {
    try {
      const meetings = await this.teamsService.getOnlineMeetings();
      return { meetings };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post(':teamId/channels/:channelId/subscribe')
  @ApiOperation({ summary: 'Create webhook subscription for a channel' })
  async createSubscription(@Param('teamId') teamId: string, @Param('channelId') channelId: string) {
    try {
      const subscription = await this.teamsService.createWebhookSubscription(teamId, channelId);
      return {
        success: true,
        subscription,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
