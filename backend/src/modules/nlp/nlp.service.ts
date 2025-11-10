import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import OpenAI from 'openai';

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface NLPResult {
  entities: ExtractedEntity[];
  projects?: string[];
  tasks?: Array<{
    title: string;
    description?: string;
    assignee?: string;
    priority?: string;
    dueDate?: string;
  }>;
  requirements?: Array<{
    description: string;
    category?: string;
    priority?: string;
  }>;
  deadlines?: Array<{
    description: string;
    date: string;
  }>;
  decisions?: string[];
  summary?: string;
}

@Injectable()
export class NlpService {
  private readonly logger = new Logger(NlpService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @InjectQueue('nlp-processing') private nlpQueue: Queue,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI initialized');
    } else {
      this.logger.warn('OpenAI API key not configured');
    }
  }

  /**
   * Process message for NLP extraction
   */
  async processMessage(messageId: string) {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }

      this.logger.log(`Processing message: ${messageId}`);

      // Extract entities using GPT-4
      const result = await this.extractEntities(message.content);

      // Store extracted entities
      await this.storeEntities(messageId, result.entities);

      // Create tasks if found
      if (result.tasks && result.tasks.length > 0) {
        await this.createTasksFromExtraction(messageId, result.tasks);
      }

      // Create requirements if found
      if (result.requirements && result.requirements.length > 0) {
        await this.createRequirementsFromExtraction(messageId, result.requirements);
      }

      // Link to project if identified
      if (result.projects && result.projects.length > 0) {
        await this.linkMessageToProject(messageId, result.projects[0]);
      }

      this.logger.log(`Message processed successfully: ${messageId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process message: ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Extract entities from text using OpenAI GPT-4
   */
  async extractEntities(text: string): Promise<NLPResult> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const prompt = this.buildExtractionPrompt(text);

      const completion = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting project management information from conversations. Extract tasks, requirements, deadlines, project names, decisions, and other relevant information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: parseInt(this.configService.get('OPENAI_MAX_TOKENS') || '2000'),
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }
      const parsed = JSON.parse(response);

      return this.normalizeNLPResult(parsed);
    } catch (error) {
      this.logger.error('Entity extraction failed', error);
      throw error;
    }
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(text: string): string {
    return `Analyze the following message and extract project management information.

Message:
"""
${text}
"""

Extract and return a JSON object with the following structure:
{
  "entities": [
    {"type": "project|task|deadline|requirement|decision|person", "value": "extracted text", "confidence": 0.0-1.0}
  ],
  "projects": ["project name 1", "project name 2"],
  "tasks": [
    {
      "title": "task title",
      "description": "task description",
      "assignee": "person name or null",
      "priority": "low|medium|high or null",
      "dueDate": "YYYY-MM-DD or null"
    }
  ],
  "requirements": [
    {
      "description": "requirement description",
      "category": "functional|non-functional|constraint or null",
      "priority": "low|medium|high or null"
    }
  ],
  "deadlines": [
    {
      "description": "what needs to be done",
      "date": "YYYY-MM-DD"
    }
  ],
  "decisions": ["decision 1", "decision 2"],
  "summary": "brief 1-2 sentence summary of the message"
}

Important:
- Only extract information that is explicitly or clearly implied in the text
- Use null for optional fields if information is not present
- Be conservative with confidence scores
- Extract project names even if informal (e.g., "the auth module" -> "Auth Module")
- Parse relative dates (e.g., "tomorrow", "next week") to absolute dates based on context
- Return valid JSON only`;
  }

  /**
   * Normalize NLP result
   */
  private normalizeNLPResult(parsed: any): NLPResult {
    return {
      entities: parsed.entities || [],
      projects: parsed.projects || [],
      tasks: parsed.tasks || [],
      requirements: parsed.requirements || [],
      deadlines: parsed.deadlines || [],
      decisions: parsed.decisions || [],
      summary: parsed.summary,
    };
  }

  /**
   * Store extracted entities
   */
  private async storeEntities(messageId: string, entities: ExtractedEntity[]) {
    for (const entity of entities) {
      try {
        await this.prisma.entity.create({
          data: {
            messageId,
            entityType: entity.type,
            entityValue: entity.value,
            confidenceScore: entity.confidence,
            metadata: entity.metadata ? JSON.parse(JSON.stringify(entity.metadata)) : null,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to store entity: ${entity.value}`, error);
      }
    }
  }

  /**
   * Create tasks from extraction
   */
  private async createTasksFromExtraction(
    messageId: string,
    tasks: Array<{
      title: string;
      description?: string;
      assignee?: string;
      priority?: string;
      dueDate?: string;
    }>,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) return;

    for (const task of tasks) {
      try {
        // Find or create project for this message
        let projectId = message.projectId;
        if (!projectId) {
          // Create a default project if none exists
          const project = await this.prisma.project.create({
            data: {
              name: 'Uncategorized Tasks',
              description: 'Tasks extracted from messages without a specific project',
              status: 'in-progress',
            },
          });
          projectId = project.id;

          // Update message with project
          await this.prisma.message.update({
            where: { id: messageId },
            data: { projectId },
          });
        }

        await this.prisma.task.create({
          data: {
            projectId,
            title: task.title,
            description: task.description || null,
            assignee: task.assignee || null,
            status: 'todo',
            priority: task.priority || 'medium',
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            sourceMessageId: messageId,
          },
        });

        this.logger.log(`Task created: ${task.title}`);
      } catch (error) {
        this.logger.error(`Failed to create task: ${task.title}`, error);
      }
    }
  }

  /**
   * Create requirements from extraction
   */
  private async createRequirementsFromExtraction(
    messageId: string,
    requirements: Array<{
      description: string;
      category?: string;
      priority?: string;
    }>,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) return;

    for (const req of requirements) {
      try {
        let projectId = message.projectId;
        if (!projectId) {
          const project = await this.prisma.project.create({
            data: {
              name: 'Uncategorized Requirements',
              description: 'Requirements extracted from messages without a specific project',
              status: 'planning',
            },
          });
          projectId = project.id;

          await this.prisma.message.update({
            where: { id: messageId },
            data: { projectId },
          });
        }

        await this.prisma.requirement.create({
          data: {
            projectId,
            description: req.description,
            category: req.category || 'functional',
            priority: req.priority || 'medium',
            status: 'proposed',
            sourceMessageId: messageId,
          },
        });

        this.logger.log(`Requirement created: ${req.description.substring(0, 50)}...`);
      } catch (error) {
        this.logger.error('Failed to create requirement', error);
      }
    }
  }

  /**
   * Link message to project
   */
  private async linkMessageToProject(messageId: string, projectName: string) {
    try {
      // Find existing project by name (case-insensitive)
      let project = await this.prisma.project.findFirst({
        where: {
          name: {
            equals: projectName,
            mode: 'insensitive',
          },
        },
      });

      // Create project if doesn't exist
      if (!project) {
        project = await this.prisma.project.create({
          data: {
            name: projectName,
            status: 'in-progress',
          },
        });
        this.logger.log(`Project created: ${projectName}`);
      }

      // Link message to project
      await this.prisma.message.update({
        where: { id: messageId },
        data: { projectId: project.id },
      });

      this.logger.log(`Message linked to project: ${projectName}`);
    } catch (error) {
      this.logger.error(`Failed to link message to project: ${projectName}`, error);
    }
  }

  /**
   * Queue NLP processing for a message
   */
  async queueMessageProcessing(messageId: string) {
    try {
      await this.nlpQueue.add(
        'process-message',
        { messageId },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(`NLP processing queued for message: ${messageId}`);
    } catch (error) {
      this.logger.error(`Failed to queue NLP processing: ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Batch process messages
   */
  async batchProcessMessages(messageIds: string[]) {
    const results: Array<{ messageId: string; success: boolean; error?: string }> = [];

    for (const messageId of messageIds) {
      try {
        await this.queueMessageProcessing(messageId);
        results.push({ messageId, success: true });
      } catch (error) {
        results.push({ messageId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get entities for a message
   */
  async getMessageEntities(messageId: string) {
    return this.prisma.entity.findMany({
      where: { messageId },
      orderBy: { confidenceScore: 'desc' },
    });
  }

  /**
   * Generate project summary
   */
  async generateProjectSummary(projectId: string) {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // Get project with messages, tasks, and requirements
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 50, // Last 50 messages
          },
          tasks: true,
          requirements: true,
        },
      });

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Build context from messages
      const context = project.messages
        .map((m) => `[${m.authorName}]: ${m.content}`)
        .join('\n\n');

      const prompt = `Based on the following project information, provide a concise summary:

Project Name: ${project.name}
Status: ${project.status}
Total Tasks: ${project.tasks.length}
Total Requirements: ${project.requirements.length}

Recent Messages:
${context}

Provide a summary covering:
1. Current status and progress
2. Key decisions made
3. Pending tasks and requirements
4. Any blockers or concerns mentioned
5. Next steps

Keep the summary to 3-5 paragraphs.`;

      const completion = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a project management assistant that creates clear, concise project summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Failed to generate project summary: ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Analyze sentiment of messages
   */
  async analyzeSentiment(text: string): Promise<{ sentiment: string; score: number }> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL') || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment of the text. Respond with JSON: {"sentiment": "positive|negative|neutral", "score": 0.0-1.0}',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.2,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      const result = JSON.parse(content);
      return result;
    } catch (error) {
      this.logger.error('Sentiment analysis failed', error);
      throw error;
    }
  }

  /**
   * Get entities extracted from a specific message
   */
  async getEntitiesByMessage(messageId: string) {
    try {
      return await this.prisma.entity.findMany({
        where: {
          messageId,
        },
        orderBy: {
          confidence: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get entities for message: ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Get all entities for a project, optionally filtered by type
   */
  async getEntitiesByProject(projectId: string, type?: string) {
    try {
      const whereClause: any = {
        message: {
          projectId,
        },
      };

      if (type) {
        whereClause.type = type;
      }

      return await this.prisma.entity.findMany({
        where: whereClause,
        orderBy: [
          { confidence: 'desc' },
          { extractedAt: 'desc' },
        ],
        include: {
          message: {
            select: {
              id: true,
              content: true,
              authorName: true,
              timestamp: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get entities for project: ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Get tasks extracted from a specific message
   */
  async getTasksByMessage(messageId: string) {
    try {
      return await this.prisma.task.findMany({
        where: {
          sourceMessageId: messageId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get tasks for message: ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Get requirements extracted from a specific message
   */
  async getRequirementsByMessage(messageId: string) {
    try {
      return await this.prisma.requirement.findMany({
        where: {
          sourceMessageId: messageId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get requirements for message: ${messageId}`, error);
      throw error;
    }
  }
}
