package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gapak/backend/internal/config"
)

const oauthHTTPTimeout = 10 * time.Second

type oauthUserInfo struct {
	ProviderUserID string
	Email          string
	EmailVerified  bool
	DisplayName    string
	AvatarURL      string
}

type googleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

type githubUserInfo struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

type facebookUserInfo struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func getOAuthHTTPClient() *http.Client {
	return &http.Client{Timeout: oauthHTTPTimeout}
}

func exchangeCodeForToken(providerCfg config.OAuthProviderConfig, code, codeVerifier string) (string, error) {
	data := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {providerCfg.ClientID},
		"client_secret": {providerCfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {providerCfg.RedirectURI},
	}
	if strings.TrimSpace(codeVerifier) != "" {
		data.Set("code_verifier", codeVerifier)
	}

	req, err := http.NewRequest("POST", providerCfg.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := getOAuthHTTPClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("exchange code: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token exchange failed (status %d)", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parse token response: %w", err)
	}
	if tokenResp.Error != "" {
		return "", fmt.Errorf("token error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	return tokenResp.AccessToken, nil
}

func fetchGoogleUserInfo(accessToken string) (*oauthUserInfo, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := getOAuthHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch google user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo failed (status %d)", resp.StatusCode)
	}

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}

	return &oauthUserInfo{
		ProviderUserID: info.ID,
		Email:          info.Email,
		EmailVerified:  info.VerifiedEmail,
		DisplayName:    info.Name,
		AvatarURL:      info.Picture,
	}, nil
}

func fetchGitHubUserInfo(accessToken string) (*oauthUserInfo, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := getOAuthHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch github user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github userinfo failed (status %d)", resp.StatusCode)
	}

	var info githubUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}

	email := ""
	verifiedEmail := false
	if info.Email != "" {
		if verified, ok := fetchGitHubVerifiedEmail(accessToken, info.Email); ok {
			email = verified
			verifiedEmail = true
		}
	} else if verified, ok := fetchGitHubPrimaryEmail(accessToken); ok {
		email = verified
		verifiedEmail = true
	}

	displayName := info.Name
	if displayName == "" {
		displayName = info.Login
	}

	return &oauthUserInfo{
		ProviderUserID: fmt.Sprintf("%d", info.ID),
		Email:          email,
		EmailVerified:  verifiedEmail,
		DisplayName:    displayName,
		AvatarURL:      info.AvatarURL,
	}, nil
}

func fetchGitHubPrimaryEmail(accessToken string) (string, bool) {
	emails, err := fetchGitHubEmails(accessToken)
	if err != nil {
		return "", false
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, true
		}
	}
	for _, e := range emails {
		if e.Verified {
			return e.Email, true
		}
	}
	return "", false
}

func fetchGitHubVerifiedEmail(accessToken, candidate string) (string, bool) {
	emails, err := fetchGitHubEmails(accessToken)
	if err != nil {
		return "", false
	}
	candidate = strings.ToLower(strings.TrimSpace(candidate))
	for _, e := range emails {
		if e.Verified && strings.EqualFold(strings.TrimSpace(e.Email), candidate) {
			return e.Email, true
		}
	}
	return "", false
}

func fetchGitHubEmails(accessToken string) ([]githubEmail, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := getOAuthHTTPClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github emails failed (status %d)", resp.StatusCode)
	}
	var emails []githubEmail
	if err := json.Unmarshal(body, &emails); err != nil {
		return nil, err
	}
	return emails, nil
}

func fetchFacebookUserInfo(accessToken string) (*oauthUserInfo, error) {
	req, err := http.NewRequest("GET", "https://graph.facebook.com/v19.0/me?fields=id,name,email", nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Set("access_token", accessToken)
	req.URL.RawQuery = q.Encode()

	resp, err := getOAuthHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch facebook user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("facebook userinfo failed (status %d)", resp.StatusCode)
	}

	var info facebookUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}

	return &oauthUserInfo{
		ProviderUserID: info.ID,
		Email:          info.Email,
		DisplayName:    info.Name,
	}, nil
}

func buildAuthorizeURL(providerCfg config.OAuthProviderConfig, state, codeChallenge string) string {
	params := url.Values{
		"client_id":     {providerCfg.ClientID},
		"redirect_uri":  {providerCfg.RedirectURI},
		"response_type": {"code"},
		"scope":         {strings.Join(providerCfg.Scopes, " ")},
		"state":         {state},
	}
	if strings.TrimSpace(codeChallenge) != "" {
		params.Set("code_challenge", codeChallenge)
		params.Set("code_challenge_method", "S256")
	}
	return providerCfg.AuthURL + "?" + params.Encode()
}
