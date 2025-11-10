import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { MessagesService, SearchMessagesDto } from './messages.service';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all messages with filtering' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('source') source?: string,
    @Query('channelId') channelId?: string,
    @Query('authorId') authorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.messagesService.findAll({
      projectId,
      source,
      channelId,
      authorId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get message statistics' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'source', required: false })
  async getStatistics(@Query('projectId') projectId?: string, @Query('source') source?: string) {
    return this.messagesService.getStatistics({ projectId, source });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  async findOne(@Param('id') id: string) {
    return this.messagesService.findOne(id);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search messages by content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        projectId: { type: 'string' },
        source: { type: 'string' },
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  })
  async search(@Body() searchDto: SearchMessagesDto) {
    return this.messagesService.search(searchDto);
  }
}
