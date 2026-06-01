package moderation

import (
	"context"

	"github.com/gapak/backend/internal/domain/model"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, reporterUserID string, req CreateReportRequest) (ReportResponse, error) {
	report, err := s.repo.Create(ctx, reporterUserID, req)
	if err != nil {
		return ReportResponse{}, err
	}
	return toResponse(report), nil
}

func (s *Service) Own(ctx context.Context, reporterUserID string) ([]ReportResponse, error) {
	items, err := s.repo.ListOwn(ctx, reporterUserID)
	if err != nil {
		return nil, err
	}
	return toResponses(items), nil
}

func (s *Service) All(ctx context.Context) ([]ReportResponse, error) {
	items, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	return toResponses(items), nil
}

func (s *Service) Resolve(ctx context.Context, reviewerUserID, reportID string, req ResolveReportRequest) (ReportResponse, error) {
	report, err := s.repo.Resolve(ctx, reviewerUserID, reportID, req)
	if err != nil {
		return ReportResponse{}, err
	}
	return toResponse(report), nil
}

func toResponses(items []model.ModerationReport) []ReportResponse {
	response := make([]ReportResponse, 0, len(items))
	for _, item := range items {
		copy := item
		response = append(response, toResponse(&copy))
	}
	return response
}

func toResponse(report *model.ModerationReport) ReportResponse {
	return ReportResponse{
		ID:              report.ID,
		ReporterUserID:  report.ReporterUserID,
		TargetType:      string(report.TargetType),
		TargetID:        report.TargetID,
		Reason:          string(report.Reason),
		Description:     deref(report.Description),
		Status:          string(report.Status),
		HandledByUserID: deref(report.HandledByUserID),
		ResolutionNote:  deref(report.ResolutionNote),
		CreatedAt:       report.CreatedAt,
		UpdatedAt:       report.UpdatedAt,
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
