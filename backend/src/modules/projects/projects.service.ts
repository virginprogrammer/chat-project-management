import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateProjectDto {
  name: string;
  description?: string;
  status?: string;
  deadline?: Date;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: string;
  deadline?: Date;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all projects with optional filtering
   */
  async findAll(filters?: { status?: string; search?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            tasks: true,
            requirements: true,
            messages: true,
          },
        },
      },
    });
  }

  /**
   * Get a single project by ID
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        requirements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            tasks: true,
            requirements: true,
            messages: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  /**
   * Create a new project
   */
  async create(createProjectDto: CreateProjectDto) {
    try {
      return await this.prisma.project.create({
        data: {
          name: createProjectDto.name,
          description: createProjectDto.description,
          status: createProjectDto.status || 'active',
          deadline: createProjectDto.deadline,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create project', error);
      throw error;
    }
  }

  /**
   * Update a project
   */
  async update(id: string, updateProjectDto: UpdateProjectDto) {
    // Check if project exists
    await this.findOne(id);

    try {
      return await this.prisma.project.update({
        where: { id },
        data: updateProjectDto,
      });
    } catch (error) {
      this.logger.error(`Failed to update project ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async remove(id: string) {
    // Check if project exists
    await this.findOne(id);

    try {
      return await this.prisma.project.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to delete project ${id}`, error);
      throw error;
    }
  }

  /**
   * Get project timeline
   */
  async getTimeline(id: string) {
    await this.findOne(id);

    const messages = await this.prisma.message.findMany({
      where: { projectId: id },
      orderBy: { timestamp: 'asc' },
      include: {
        entities: true,
        tasks: true,
        requirements: true,
      },
    });

    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    });

    const requirements = await this.prisma.requirement.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Combine and sort by timestamp
    const timeline = [
      ...messages.map((m) => ({
        type: 'message',
        timestamp: m.timestamp,
        data: m,
      })),
      ...tasks.map((t) => ({
        type: 'task',
        timestamp: t.createdAt,
        data: t,
      })),
      ...requirements.map((r) => ({
        type: 'requirement',
        timestamp: r.createdAt,
        data: r,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }

  /**
   * Get project tasks
   */
  async getTasks(id: string) {
    await this.findOne(id);

    return this.prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get project requirements
   */
  async getRequirements(id: string) {
    await this.findOne(id);

    return this.prisma.requirement.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get project messages
   */
  async getMessages(id: string, filters?: { source?: string; limit?: number }) {
    await this.findOne(id);

    const where: any = { projectId: id };

    if (filters?.source) {
      where.source = filters.source;
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      include: {
        entities: true,
      },
    });
  }
}
