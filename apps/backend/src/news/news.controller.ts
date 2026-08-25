import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NewsService } from './news.service';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @ApiOperation({ summary: 'Get latest financial market news with sentiment analysis' })
  @ApiQuery({ name: 'symbol', required: false, description: 'Filter news by stock ticker symbol (e.g. TCS.NS)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of articles to return (default: 5)' })
  @ApiResponse({ status: 200, description: 'News articles returned with sentiment' })
  @Get()
  async getNews(
    @Query('symbol') symbol?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 5;
    return this.newsService.getNews(symbol, parsedLimit);
  }
}
