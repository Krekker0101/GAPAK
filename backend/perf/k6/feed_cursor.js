import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: { feed: { executor: 'constant-vus', vus: 20, duration: '60s' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500', 'p(99)<1000'] },
};

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:8080';
  const token = __ENV.ACCESS_TOKEN || '';
  let cursor = '';
  for (let i = 0; i < 5; i++) {
    const url = `${base}/posts/feed?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = http.get(url, { headers: { Authorization: `Bearer ${token}` } });
    check(res, { 'feed is 200': (r) => r.status === 200 });
    cursor = res.headers['X-Next-Cursor'] || '';
    if (!cursor) break;
    sleep(0.05);
  }
}
