package main

import (
	"fmt"
	"os"
	"os/exec"
)

func main() {
	commands := [][]string{
		{"go", "generate", "./..."},
		{"sqlc", "generate"},
		{"go", "run", "github.com/google/wire/cmd/wire", "./cmd/server"},
		{"swag", "init", "-g", "cmd/server/main.go", "-o", "api/docs", "--parseDependency", "--parseInternal"},
	}

	for _, cmd := range commands {
		fmt.Printf("Running: %v\n", cmd)
		c := exec.Command(cmd[0], cmd[1:]...)
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		if err := c.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Command failed: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Println("Code generation completed successfully")
}
