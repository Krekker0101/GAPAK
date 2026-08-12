import type { PlaybackGrant, MediaUsageContext, SignedRequest } from '../../shared/types/media';
import type { PlaybackGrant as BackendPlaybackGrant } from '../../shared/api/backendContracts';
import { mediaApi } from './api/mediaApi';

const toSignedRequest = (request: BackendPlaybackGrant['request']): SignedRequest => ({
  method: request.method,
  url: request.url,
  headers: request.headers,
  expiresAt: request.expiresAt,
});

const mapGrant = (mediaId: string, grant: BackendPlaybackGrant): PlaybackGrant => ({
  id: grant.id,
  status: grant.status,
  maxViews: grant.maxViews,
  usedViews: grant.usedViews,
  expiresAt: Date.parse(grant.expiresAt),
  mediaId,
  masterManifestUrl: grant.request.url,
  request: toSignedRequest(grant.request),
  variants: Object.entries(grant.variantRequests ?? {})
    .filter(([label]) => ['1080p', '720p', '480p', '360p', 'auto'].includes(label))
    .map(([label, request]) => ({
      resolution: label as '1080p' | '720p' | '480p' | '360p' | 'auto',
      url: request.url,
    })),
});

export class PlaybackGrantService {
  static async requestPlaybackGrant(mediaId: string, context: MediaUsageContext = 'POST_ATTACHMENT', signal?: AbortSignal): Promise<PlaybackGrant> {
    const response = await mediaApi.requestPlaybackGrant(mediaId, context, signal);
    return mapGrant(mediaId, response);
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
