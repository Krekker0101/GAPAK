package push

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

func doForm(ctx context.Context, endpoint string, values url.Values) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := defaultHTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return resp.StatusCode, nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return resp.StatusCode, body, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}
	return resp.StatusCode, body, nil
}
