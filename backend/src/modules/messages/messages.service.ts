import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface MessageFilters {
  projectId?: string;
  source?: string;
  channelId?: string;
  authorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchMessagesDto {
  query: string;
  projectId?: string;
  source?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all messages with filtering
   */
  async findAll(filters?: MessageFilters) {
    const where: any = {};

    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters?.source) {
      where.source = filters.source;
    }

    if (filters?.channelId) {
      where.channelId = filters.channelId;
    }

    if (filters?.authorId) {
      where.authorId = filters.authorId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
      include: {
        entities: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get a single message by ID
   */
  async findOne(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        entities: true,
        tasks: true,
        requirements: true,
        project: true,
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }

  /**
   * Search messages by content
   */
  async search(searchDto: SearchMessagesDto) {
    const where: any = {
      content: {
        contains: searchDto.query,
        mode: 'insensitive',
      },
    };

    if (searchDto.projectId) {
      where.projectId = searchDto.projectId;
    }

    if (searchDto.source) {
      where.source = searchDto.source;
    }

    if (searchDto.startDate || searchDto.endDate) {
      where.timestamp = {};
      if (searchDto.startDate) {
        where.timestamp.gte = searchDto.startDate;
      }
      if (searchDto.endDate) {
        where.timestamp.lte = searchDto.endDate;
      }
    }

    try {
      const messages = await this.prisma.message.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: searchDto.limit || 50,
        include: {
          entities: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        query: searchDto.query,
        total: messages.length,
        messages,
      };
    } catch (error) {
      this.logger.error('Failed to search messages', error);
      throw error;
    }
  }

  /**
   * Get message statistics
   */
  async getStatistics(filters?: { projectId?: string; source?: string }) {
    const where: any = {};

    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters?.source) {
      where.source = filters.source;
    }

    const [total, bySource, byChannel, recentCount] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
      this.prisma.message.groupBy({
        by: ['channelName'],
        where,
        _count: true,
        orderBy: {
          _count: {
            channelName: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.message.count({
        where: {
          ...where,
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      total,
      bySource,
      topChannels: byChannel,
      recentCount,
    };
  }
}
