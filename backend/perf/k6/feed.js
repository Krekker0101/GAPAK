import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    feed: { executor: 'constant-vus', vus: 20, duration: '60s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:8080';
  const token = __ENV.ACCESS_TOKEN || '';
  const res = http.get(`${base}/posts/feed?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'feed is 200': (r) => r.status === 200 });
  sleep(0.2);
}
