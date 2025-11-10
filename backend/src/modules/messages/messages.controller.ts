import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  @Get()
  @ApiOperation({ summary: 'Get messages' })
  findAll() {
    return { messages: [] };
  }
}
