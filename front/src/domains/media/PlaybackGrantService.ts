import { PlaybackGrant, MediaUsageContext } from '../../shared/types/media';
import { mediaApi } from './api/mediaApi';

export class PlaybackGrantService {
  static async requestPlaybackGrant(mediaId: string, context: MediaUsageContext = 'POST_ATTACHMENT', signal?: AbortSignal): Promise<PlaybackGrant> {
    const response = await mediaApi.requestPlaybackGrant(mediaId, context, signal);
    return response.grant;
  }

  static async renewPlaybackGrant(grant: PlaybackGrant, context: MediaUsageContext = 'POST_ATTACHMENT', signal?: AbortSignal) {
    return this.requestPlaybackGrant(grant.mediaId, context, signal);
  }

  static isGrantValid(grant: PlaybackGrant) {
    return Date.now() < grant.expiresAt - 5_000;
  }

  static getRemainingSeconds(grant: PlaybackGrant) {
    return Math.max(0, Math.floor((grant.expiresAt - Date.now()) / 1000));
  }
}
