import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('nlp')
@Controller('nlp')
export class NlpController {
  @Get('status')
  @ApiOperation({ summary: 'Check NLP service status' })
  getStatus() {
    return { service: 'nlp', status: 'ready' };
  }
}
