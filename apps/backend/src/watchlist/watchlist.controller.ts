import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { AddWatchlistItemDto } from './dto/add-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Watchlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('watchlists')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @ApiOperation({ summary: 'Get all watchlists and live stock prices for current user' })
  @ApiResponse({ status: 200, description: 'Watchlists retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  async getWatchlists(@Req() req: any) {
    return this.watchlistService.getWatchlists(req.user.id);
  }

  @ApiOperation({ summary: 'Create a new custom watchlist' })
  @ApiResponse({ status: 201, description: 'Watchlist created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  async createWatchlist(@Req() req: any, @Body() dto: CreateWatchlistDto) {
    return this.watchlistService.createWatchlist(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Add a stock to a watchlist' })
  @ApiResponse({ status: 201, description: 'Stock added to watchlist' })
  @ApiResponse({ status: 403, description: 'Forbidden: not owner' })
  @ApiResponse({ status: 404, description: 'Watchlist not found' })
  @Post(':id/items')
  async addItem(@Req() req: any, @Param('id') id: string, @Body() dto: AddWatchlistItemDto) {
    return this.watchlistService.addItem(req.user.id, id, dto);
  }

  @ApiOperation({ summary: 'Remove a stock from a watchlist' })
  @ApiResponse({ status: 200, description: 'Stock removed from watchlist' })
  @ApiResponse({ status: 403, description: 'Forbidden: not owner' })
  @ApiResponse({ status: 404, description: 'Watchlist not found' })
  @Delete(':id/items/:stockId')
  async removeItem(@Req() req: any, @Param('id') id: string, @Param('stockId') stockId: string) {
    return this.watchlistService.removeItem(req.user.id, id, stockId);
  }
}
