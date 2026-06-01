package pagination

type Query struct {
	Page  int    `query:"page" validate:"omitempty,min=1"`
	Limit int    `query:"limit" validate:"omitempty,min=1,max=100"`
	Sort  string `query:"sort" validate:"omitempty,max=64"`
	Order string `query:"order" validate:"omitempty,oneof=asc desc"`
}

func (q Query) Normalize() Query {
	if q.Page == 0 {
		q.Page = 1
	}
	if q.Limit == 0 {
		q.Limit = 20
	}
	if q.Order == "" {
		q.Order = "desc"
	}
	return q
}

func Meta(page, limit int, total int64, returned int) map[string]any {
	return map[string]any{
		"page":     page,
		"limit":    limit,
		"total":    total,
		"hasNext":  int64(page*limit) < total,
		"hasPrev":  page > 1,
		"returned": returned,
	}
}
