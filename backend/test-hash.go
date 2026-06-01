package main

import (
	"fmt"
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

	password := "TestPassword123"
	pepper := "this-is-a-pepper-secret-minimum-16-chars-long-value"

	// Генерируем хеш
	hash, err := argon2id.CreateHash(strings.TrimSpace(password)+pepper, params)
	if err != nil {
		fmt.Printf("Error generating hash: %v\n", err)
		return
	}

	fmt.Printf("Password: %s\n", password)
	fmt.Printf("Pepper: %s\n", pepper)
	fmt.Printf("Hash: %s\n", hash)

	// Проверяем что хеш валиден
	ok, err := argon2id.ComparePasswordAndHash(strings.TrimSpace(password)+pepper, hash)
	if err != nil {
		fmt.Printf("Error comparing: %v\n", err)
		return
	}
	fmt.Printf("Verify result: %v\n", ok)
}
