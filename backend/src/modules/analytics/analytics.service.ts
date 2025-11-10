import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get analytics for a specific project
   */
  async getProjectAnalytics(projectId: string) {
    try {
      const [
        project,
        totalMessages,
        totalTasks,
        totalRequirements,
        completedTasks,
        messagesBySource,
        tasksGrouped,
        recentActivity,
        topContributors,
      ] = await Promise.all([
        this.prisma.project.findUnique({
          where: { id: projectId },
        }),
        this.prisma.message.count({
          where: { projectId },
        }),
        this.prisma.task.count({
          where: { projectId },
        }),
        this.prisma.requirement.count({
          where: { projectId },
        }),
        this.prisma.task.count({
          where: { projectId, status: 'completed' },
        }),
        this.prisma.message.groupBy({
          by: ['source'],
          where: { projectId },
          _count: true,
        }),
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
        }),
        this.prisma.message.findMany({
          where: { projectId },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            authorName: true,
            timestamp: true,
            source: true,
          },
        }),
        this.prisma.message.groupBy({
          by: ['authorName'],
          where: { projectId },
          _count: true,
          orderBy: {
            _count: {
              authorName: 'desc',
            },
          },
          take: 10,
        }),
      ]);

      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      return {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          deadline: project.deadline,
        },
        summary: {
          totalMessages,
          totalTasks,
          totalRequirements,
          completedTasks,
          taskCompletionRate:
            totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        },
        messagesBySource,
        tasksByStatus: tasksGrouped,
        recentActivity,
        topContributors,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Get upcoming deadlines across all projects
   */
  async getDeadlines(daysAhead: number = 30) {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const [projectDeadlines, taskDeadlines] = await Promise.all([
        this.prisma.project.findMany({
          where: {
            deadline: {
              gte: now,
              lte: futureDate,
            },
          },
          orderBy: { deadline: 'asc' },
          select: {
            id: true,
            name: true,
            deadline: true,
            status: true,
            _count: {
              select: {
                tasks: true,
                requirements: true,
              },
            },
          },
        }),
        this.prisma.task.findMany({
          where: {
            dueDate: {
              gte: now,
              lte: futureDate,
            },
            status: {
              not: 'completed',
            },
          },
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            title: true,
            dueDate: true,
            priority: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return {
        daysAhead,
        projectDeadlines,
        taskDeadlines,
        summary: {
          upcomingProjects: projectDeadlines.length,
          upcomingTasks: taskDeadlines.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get deadlines', error);
      throw error;
    }
  }

  /**
   * Get team activity metrics
   */
  async getTeamActivity(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        messageActivity,
        taskActivity,
        contributorStats,
        channelActivity,
        dailyActivity,
      ] = await Promise.all([
        this.prisma.message.count({
          where: {
            timestamp: {
              gte: startDate,
            },
          },
        }),
        this.prisma.task.count({
          where: {
            createdAt: {
              gte: startDate,
            },
          },
        }),
        this.prisma.message.groupBy({
          by: ['authorName'],
          where: {
            timestamp: {
              gte: startDate,
            },
          },
          _count: true,
          orderBy: {
            _count: {
              authorName: 'desc',
            },
          },
          take: 15,
        }),
        this.prisma.message.groupBy({
          by: ['channelName', 'source'],
          where: {
            timestamp: {
              gte: startDate,
            },
          },
          _count: true,
          orderBy: {
            _count: {
              channelName: 'desc',
            },
          },
          take: 15,
        }),
        // Get messages grouped by day
        this.prisma.$queryRaw`
          SELECT
            DATE(timestamp) as date,
            COUNT(*) as count,
            source
          FROM "Message"
          WHERE timestamp >= ${startDate}
          GROUP BY DATE(timestamp), source
          ORDER BY date DESC
        `,
      ]);

      return {
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
        summary: {
          totalMessages: messageActivity,
          totalTasks: taskActivity,
          avgMessagesPerDay: (messageActivity / days).toFixed(2),
          avgTasksPerDay: (taskActivity / days).toFixed(2),
        },
        topContributors: contributorStats,
        channelActivity,
        dailyActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get team activity', error);
      throw error;
    }
  }

  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats() {
    try {
      const [
        totalProjects,
        activeProjects,
        totalMessages,
        totalTasks,
        totalRequirements,
        recentMessages,
        upcomingDeadlines,
      ] = await Promise.all([
        this.prisma.project.count(),
        this.prisma.project.count({
          where: { status: 'active' },
        }),
        this.prisma.message.count(),
        this.prisma.task.count(),
        this.prisma.requirement.count(),
        this.prisma.message.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
        this.prisma.project.count({
          where: {
            deadline: {
              gte: new Date(),
              lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 14 days
            },
          },
        }),
      ]);

      return {
        projects: {
          total: totalProjects,
          active: activeProjects,
          inactive: totalProjects - activeProjects,
        },
        messages: {
          total: totalMessages,
          recent: recentMessages,
        },
        tasks: {
          total: totalTasks,
        },
        requirements: {
          total: totalRequirements,
        },
        upcomingDeadlines,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw error;
    }
  }
}
