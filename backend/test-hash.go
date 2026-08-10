package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/alexedwards/argon2id"
)

func main() {
	// Используем те же параметры что в коде
	params := &argon2id.Params{
		Memory:      256 * 1024,
		Iterations:  3,
		Parallelism: 2,
		SaltLength:  16,
		KeyLength:   32,
	}

	password := strings.TrimSpace(os.Getenv("TEST_PASSWORD"))
	pepper := os.Getenv("TEST_PASSWORD_PEPPER")
	if password == "" || pepper == "" {
		fmt.Fprintln(os.Stderr, "TEST_PASSWORD and TEST_PASSWORD_PEPPER must be set")
		return
	}

	// Генерируем хеш
	hash, err := argon2id.CreateHash(password+pepper, params)
	if err != nil {
		fmt.Printf("Error generating hash: %v\n", err)
		return
	}

	// Проверяем что хеш валиден
	ok, err := argon2id.ComparePasswordAndHash(password+pepper, hash)
	if err != nil {
		fmt.Printf("Error comparing: %v\n", err)
		return
	}
	if !ok {
		fmt.Fprintln(os.Stderr, "password hash verification failed")
		return
	}
	fmt.Println("password hash verification succeeded")
}
