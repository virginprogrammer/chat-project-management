import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { NlpService } from './nlp.service';

@ApiTags('nlp')
@Controller('nlp')
export class NlpController {
  constructor(private readonly nlpService: NlpService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check NLP service status' })
  getStatus() {
    return { service: 'nlp', status: 'ready' };
  }

  @Post('process/:messageId')
  @ApiOperation({ summary: 'Process a single message with NLP' })
  async processMessage(@Param('messageId') messageId: string) {
    try {
      const result = await this.nlpService.processMessage(messageId);
      return {
        success: true,
        messageId,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('queue/:messageId')
  @ApiOperation({ summary: 'Queue a message for NLP processing' })
  async queueMessage(@Param('messageId') messageId: string) {
    try {
      await this.nlpService.queueMessageProcessing(messageId);
      return {
        success: true,
        message: 'Message queued for NLP processing',
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('batch-process')
  @ApiOperation({ summary: 'Batch process multiple messages' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        messageIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async batchProcessMessages(@Body('messageIds') messageIds: string[]) {
    try {
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return {
          success: false,
          error: 'messageIds array is required',
        };
      }

      await this.nlpService.batchProcessMessages(messageIds);
      return {
        success: true,
        message: `${messageIds.length} messages queued for processing`,
        count: messageIds.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('entities/message/:messageId')
  @ApiOperation({ summary: 'Get extracted entities for a message' })
  async getMessageEntities(@Param('messageId') messageId: string) {
    try {
      const entities = await this.nlpService.getEntitiesByMessage(messageId);
      return {
        success: true,
        messageId,
        entities,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('entities/project/:projectId')
  @ApiOperation({ summary: 'Get all entities for a project' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by entity type' })
  async getProjectEntities(@Param('projectId') projectId: string, @Query('type') type?: string) {
    try {
      const entities = await this.nlpService.getEntitiesByProject(projectId, type);
      return {
        success: true,
        projectId,
        entities,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('summary/:projectId')
  @ApiOperation({ summary: 'Generate AI summary for a project' })
  async generateProjectSummary(@Param('projectId') projectId: string) {
    try {
      const summary = await this.nlpService.generateProjectSummary(projectId);
      return {
        success: true,
        projectId,
        summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('sentiment')
  @ApiOperation({ summary: 'Analyze sentiment of text' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
    },
  })
  async analyzeSentiment(@Body('text') text: string) {
    try {
      if (!text) {
        return {
          success: false,
          error: 'Text is required',
        };
      }

      const sentiment = await this.nlpService.analyzeSentiment(text);
      return {
        success: true,
        sentiment,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('tasks/message/:messageId')
  @ApiOperation({ summary: 'Get tasks extracted from a message' })
  async getMessageTasks(@Param('messageId') messageId: string) {
    try {
      const tasks = await this.nlpService.getTasksByMessage(messageId);
      return {
        success: true,
        messageId,
        tasks,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('requirements/message/:messageId')
  @ApiOperation({ summary: 'Get requirements extracted from a message' })
  async getMessageRequirements(@Param('messageId') messageId: string) {
    try {
      const requirements = await this.nlpService.getRequirementsByMessage(messageId);
      return {
        success: true,
        messageId,
        requirements,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
