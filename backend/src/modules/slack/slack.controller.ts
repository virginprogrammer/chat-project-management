import { Controller, Get, Query, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SlackService } from './slack.service';

@ApiTags('slack')
@Controller('slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Get('auth/url')
  @ApiOperation({ summary: 'Get Slack OAuth authorization URL' })
  @ApiQuery({ name: 'state', required: false })
  getAuthUrl(@Query('state') state?: string) {
    const url = this.slackService.getAuthorizationUrl(state);
    return { url };
  }

  @Get('auth/callback')
  @ApiOperation({ summary: 'Handle Slack OAuth callback' })
  async handleCallback(@Query('code') code: string) {
    try {
      const tokenResponse = await this.slackService.exchangeCodeForToken(code);
      await this.slackService.storeIntegration(tokenResponse);

      return {
        success: true,
        message: 'Slack integration connected successfully',
        workspace: tokenResponse.team?.name,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect Slack integration',
        error: error.message,
      };
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Slack integration status' })
  async getStatus() {
    try {
      const integration = await this.slackService.getActiveIntegration();
      return {
        integration: 'slack',
        status: integration ? 'connected' : 'not_connected',
        connected: !!integration,
        workspace: integration?.workspaceName,
      };
    } catch (error) {
      return {
        integration: 'slack',
        status: 'error',
        error: error.message,
      };
    }
  }

  @Get('channels')
  @ApiOperation({ summary: 'Get all Slack channels' })
  async getChannels() {
    try {
      const channels = await this.slackService.getChannels();
      return { channels };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('channels/:channelId/messages')
  @ApiOperation({ summary: 'Get messages from a channel' })
  @ApiQuery({ name: 'limit', required: false })
  async getChannelMessages(@Param('channelId') channelId: string, @Query('limit') limit?: number) {
    try {
      const messages = await this.slackService.getChannelMessages(channelId, limit);
      return { messages };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync all messages from Slack' })
  async syncMessages() {
    try {
      const result = await this.slackService.syncAllMessages();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('team')
  @ApiOperation({ summary: 'Get Slack team info' })
  async getTeamInfo() {
    try {
      const team = await this.slackService.getTeamInfo();
      return { team };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('files/:fileId')
  @ApiOperation({ summary: 'Get file info' })
  async getFileInfo(@Param('fileId') fileId: string) {
    try {
      const file = await this.slackService.getFileInfo(fileId);
      return { file };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search Slack messages' })
  @ApiQuery({ name: 'query', required: true })
  async searchMessages(@Query('query') query: string) {
    try {
      const results = await this.slackService.searchMessages(query);
      return { results };
    } catch (error) {
      return { error: error.message };
    }
  }
}
