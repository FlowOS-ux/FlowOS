/**
 * FlowOS - src/modules/users/users.service.ts
 * User profile, settings/preferences, and onboarding logic.
 */
import { usersRepository, toPublicUser } from './users.repository';
import { NotFoundError } from '../../lib/errors';
import type { UpdateProfileDto, UpdateSettingsDto } from './users.schema';

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await usersRepository.updateById(userId, dto);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    // Map to dotted paths so we only touch the provided nested settings fields.
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) update[`settings.${key}`] = value;

    const user = await usersRepository.updateById(userId, update);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async completeOnboarding(userId: string) {
    const user = await usersRepository.updateById(userId, { onboardingComplete: true });
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },
};
