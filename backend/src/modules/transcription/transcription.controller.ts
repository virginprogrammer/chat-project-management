import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('transcription')
@Controller('transcription')
export class TranscriptionController {
  @Get('status')
  @ApiOperation({ summary: 'Check transcription service status' })
  getStatus() {
    return { service: 'transcription', status: 'ready' };
  }
}
