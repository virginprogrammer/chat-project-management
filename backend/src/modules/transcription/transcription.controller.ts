import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { TranscriptionService } from './transcription.service';

@ApiTags('transcription')
@Controller('transcription')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check transcription service status' })
  getStatus() {
    return { service: 'transcription', status: 'ready' };
  }

  @Get('recordings')
  @ApiOperation({ summary: 'Get all audio recordings' })
  @ApiQuery({ name: 'status', required: false })
  async getRecordings(@Query('status') status?: string) {
    try {
      const recordings = await this.transcriptionService.getAllRecordings(status);
      return { recordings };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('recordings/:id')
  @ApiOperation({ summary: 'Get recording by ID' })
  async getRecording(@Param('id') id: string) {
    try {
      const recording = await this.transcriptionService.getTranscription(id);
      return { recording };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('recordings/:id/transcription')
  @ApiOperation({ summary: 'Get transcription for a recording' })
  async getTranscription(@Param('id') id: string) {
    try {
      const transcription = await this.transcriptionService.getTranscription(id);
      return transcription;
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('recordings/:id/status')
  @ApiOperation({ summary: 'Get transcription job status' })
  async getJobStatus(@Param('id') id: string) {
    try {
      const status = await this.transcriptionService.getJobStatus(id);
      return status;
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload audio file for transcription' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body('source') source: string,
    @Body('sourceId') sourceId: string,
    @Body('meetingTitle') meetingTitle: string,
  ) {
    try {
      if (!file) {
        return { success: false, error: 'No file provided' };
      }

      const recording = await this.transcriptionService.uploadAndProcessRecording(
        source,
        sourceId,
        meetingTitle,
        file.buffer,
        file.mimetype,
      );

      return {
        success: true,
        recording,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('recordings/:id/retry')
  @ApiOperation({ summary: 'Retry failed transcription' })
  async retryTranscription(@Param('id') id: string) {
    try {
      await this.transcriptionService.retryTranscription(id);
      return {
        success: true,
        message: 'Transcription retry queued',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('recordings/:id/queue')
  @ApiOperation({ summary: 'Queue transcription for a recording' })
  async queueTranscription(@Param('id') id: string) {
    try {
      await this.transcriptionService.queueTranscription(id);
      return {
        success: true,
        message: 'Transcription queued',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
