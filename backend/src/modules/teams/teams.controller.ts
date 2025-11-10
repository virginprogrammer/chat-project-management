import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  @Get('status')
  @ApiOperation({ summary: 'Check Microsoft Teams integration status' })
  getStatus() {
    return { integration: 'teams', status: 'not_configured' };
  }
}
