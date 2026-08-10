package workers

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestClaimNextProcessingJobIsConcurrentAndFenced(t *testing.T) {
	url := os.Getenv("GAPAK_INTEGRATION_DB_URL")
	if url == "" {
		t.Skip("GAPAK_INTEGRATION_DB_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	jobID := uuid.NewString()
	queueName := "integration-concurrency-" + uuid.NewString()
	_, err = pool.Exec(ctx, `
		INSERT INTO processing_jobs (id, queue_name, job_type, status, attempts, max_attempts, created_at, updated_at)
		VALUES ($1, $2, 'MEDIA_ANALYZE', 'PENDING', 0, 5, NOW(), NOW())`, jobID, queueName)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(context.Background(), `DELETE FROM processing_jobs WHERE id = $1`, jobID)

	repo := NewRepository(pool)
	const workers = 100
	results := make(chan *string, workers)
	errs := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			job, err := repo.ClaimNextProcessingJob(ctx, queueName, time.Now().UTC().Add(-time.Minute))
			if err != nil {
				errs <- err
				return
			}
			if job != nil {
				results <- job.LeaseToken
			}
		}()
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		t.Fatal(err)
	}

	var leases []*string
	for lease := range results {
		leases = append(leases, lease)
	}
	if len(leases) != 1 || leases[0] == nil || *leases[0] == "" {
		t.Fatalf("expected exactly one claimant with a lease token, got %d", len(leases))
	}

	var staleLease string
	if err := pool.QueryRow(ctx, `SELECT lease_token::text FROM processing_jobs WHERE id = $1`, jobID).Scan(&staleLease); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(ctx, `UPDATE processing_jobs SET reserved_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`, jobID); err != nil {
		t.Fatal(err)
	}

	second, err := repo.ClaimJobByID(ctx, jobID, time.Now().UTC().Add(-time.Minute))
	if err != nil || second == nil || second.LeaseToken == nil || *second.LeaseToken == staleLease {
		t.Fatalf("expected stale lease to be fenced and replaced: job=%v err=%v", second, err)
	}

	if err := repo.MarkJobSucceeded(ctx, jobID, staleLease); err == nil {
		t.Fatal("stale worker was able to complete a reclaimed job")
	}
	if err := repo.MarkJobRunning(ctx, jobID, *second.LeaseToken); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkJobSucceeded(ctx, jobID, *second.LeaseToken); err != nil {
		t.Fatal(err)
	}
}
