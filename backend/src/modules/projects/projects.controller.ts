import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.projectsService.findAll({ status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        deadline: { type: 'string', format: 'date-time' },
      },
      required: ['name'],
    },
  })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        deadline: { type: 'string', format: 'date-time' },
      },
    },
  })
  async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get project timeline' })
  async getTimeline(@Param('id') id: string) {
    return this.projectsService.getTimeline(id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Get project tasks' })
  async getTasks(@Param('id') id: string) {
    return this.projectsService.getTasks(id);
  }

  @Get(':id/requirements')
  @ApiOperation({ summary: 'Get project requirements' })
  async getRequirements(@Param('id') id: string) {
    return this.projectsService.getRequirements(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get project messages' })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @Param('id') id: string,
    @Query('source') source?: string,
    @Query('limit') limit?: number,
  ) {
    return this.projectsService.getMessages(id, { source, limit });
  }
}
