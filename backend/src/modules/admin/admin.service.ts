import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
    private slackService: SlackService,
  ) {}

  /**
   * Get all integrations
   */
  async getAllIntegrations() {
    return this.prisma.integration.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        isActive: true,
        expiresAt: true,
        workspaceId: true,
        workspaceName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get integration by platform
   */
  async getIntegrationByPlatform(platform: string) {
    return this.prisma.integration.findFirst({
      where: {
        platform: platform,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        platform: true,
        isActive: true,
        expiresAt: true,
        workspaceId: true,
        workspaceName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete integration
   */
  async deleteIntegration(id: string) {
    return this.prisma.integration.delete({
      where: { id },
    });
  }

  /**
   * Sync Teams messages
   */
  async syncTeamsMessages() {
    this.logger.log('Starting Teams message sync');
    try {
      const result = await this.teamsService.syncAllMessages();
      this.logger.log(`Teams sync completed: ${result.totalMessages} messages`);
      return result;
    } catch (error) {
      this.logger.error('Teams sync failed', error);
      throw error;
    }
  }

  /**
   * Sync Slack messages
   */
  async syncSlackMessages() {
    this.logger.log('Starting Slack message sync');
    try {
      const result = await this.slackService.syncAllMessages();
      this.logger.log(`Slack sync completed: ${result.totalMessages} messages`);
      return result;
    } catch (error) {
      this.logger.error('Slack sync failed', error);
      throw error;
    }
  }

  /**
   * Sync all platforms
   */
  async syncAllPlatforms() {
    const results: {
      teams: { success: boolean; totalMessages?: number; error?: string } | null;
      slack: { success: boolean; totalMessages?: number; error?: string } | null;
    } = {
      teams: null,
      slack: null,
    };

    try {
      results.teams = await this.syncTeamsMessages();
    } catch (error) {
      results.teams = { success: false, error: error.message };
    }

    try {
      results.slack = await this.syncSlackMessages();
    } catch (error) {
      results.slack = { success: false, error: error.message };
    }

    return results;
  }

  /**
   * Get system statistics
   */
  async getSystemStats() {
    const [
      totalProjects,
      totalMessages,
      teamsMessages,
      slackMessages,
      totalRecordings,
      totalTranscriptions,
      totalTasks,
      totalRequirements,
    ] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { source: 'teams' } }),
      this.prisma.message.count({ where: { source: 'slack' } }),
      this.prisma.audioRecording.count(),
      this.prisma.transcription.count(),
      this.prisma.task.count(),
      this.prisma.requirement.count(),
    ]);

    const integrations = await this.getAllIntegrations();

    return {
      projects: totalProjects,
      messages: {
        total: totalMessages,
        teams: teamsMessages,
        slack: slackMessages,
      },
      recordings: totalRecordings,
      transcriptions: totalTranscriptions,
      tasks: totalTasks,
      requirements: totalRequirements,
      integrations: {
        total: integrations.length,
        active: integrations.filter((i) => i.isActive).length,
        byPlatform: {
          teams: integrations.filter((i) => i.platform === 'teams').length,
          slack: integrations.filter((i) => i.platform === 'slack').length,
        },
      },
    };
  }
}
