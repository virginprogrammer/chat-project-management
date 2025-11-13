import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('integrations')
  @ApiOperation({ summary: 'Get all integrations' })
  async getAllIntegrations() {
    try {
      const integrations = await this.adminService.getAllIntegrations();
      return { integrations };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('integrations/:platform')
  @ApiOperation({ summary: 'Get integration status for a platform' })
  async getIntegrationStatus(@Param('platform') platform: string) {
    try {
      const integration = await this.adminService.getIntegrationByPlatform(platform);
      return {
        platform,
        connected: !!integration,
        integration,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Delete('integrations/:id')
  @ApiOperation({ summary: 'Delete an integration' })
  async deleteIntegration(@Param('id') id: string) {
    try {
      await this.adminService.deleteIntegration(id);
      return {
        success: true,
        message: 'Integration deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('sync/teams')
  @ApiOperation({ summary: 'Trigger Teams message sync' })
  async syncTeams() {
    try {
      const result = await this.adminService.syncTeamsMessages();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('sync/slack')
  @ApiOperation({ summary: 'Trigger Slack message sync' })
  async syncSlack() {
    try {
      const result = await this.adminService.syncSlackMessages();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('sync/all')
  @ApiOperation({ summary: 'Trigger sync for all platforms' })
  async syncAll() {
    try {
      const result = await this.adminService.syncAllPlatforms();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  async getStats() {
    try {
      const stats = await this.adminService.getSystemStats();
      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }
}
