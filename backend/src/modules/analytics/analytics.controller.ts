import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('project/:id')
  @ApiOperation({ summary: 'Get analytics for a specific project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  async getProjectAnalytics(@Param('id') id: string) {
    return this.analyticsService.getProjectAnalytics(id);
  }

  @Get('deadlines')
  @ApiOperation({ summary: 'Get upcoming deadlines across all projects' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look ahead (default: 30)',
  })
  async getDeadlines(@Query('days') days?: number) {
    return this.analyticsService.getDeadlines(days ? parseInt(days.toString()) : 30);
  }

  @Get('team-activity')
  @ApiOperation({ summary: 'Get team activity metrics' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to analyze (default: 30)',
  })
  async getTeamActivity(@Query('days') days?: number) {
    return this.analyticsService.getTeamActivity(days ? parseInt(days.toString()) : 30);
  }
}
