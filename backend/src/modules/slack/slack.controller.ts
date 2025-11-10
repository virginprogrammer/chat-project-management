import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('slack')
@Controller('slack')
export class SlackController {
  @Get('status')
  @ApiOperation({ summary: 'Check Slack integration status' })
  getStatus() {
    return { integration: 'slack', status: 'not_configured' };
  }
}
