import { Controller, Post, Body, Query, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('teams')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Microsoft Teams webhook notifications' })
  async handleTeamsWebhook(@Query('validationToken') validationToken: string, @Body() body: any) {
    // Microsoft Teams sends a validation request when setting up the webhook
    if (validationToken) {
      return validationToken;
    }

    // Handle the actual notification
    try {
      await this.webhooksService.processTeamsNotification(body);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('slack')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Slack webhook events' })
  async handleSlackWebhook(@Body() body: any, @Headers('x-slack-signature') signature: string) {
    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    // Verify signature
    try {
      await this.webhooksService.verifySlackSignature(body, signature);
      await this.webhooksService.processSlackEvent(body);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
