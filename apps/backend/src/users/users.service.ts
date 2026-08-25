import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findByGoogleId(googleId);
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.usersRepository.create(data);
  }

  async updateGoogleId(id: string, googleId: string, avatarUrl?: string): Promise<User> {
    return this.usersRepository.updateGoogleId(id, googleId, avatarUrl);
  }
}
