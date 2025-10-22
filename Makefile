# ==============================================================================
# StatePass Project - Optimized Makefile (Anchor Workspace)
# ==============================================================================
# This Makefile automates common tasks for the single-program 'state_pass' project.

# --- Configuration ---

# Load environment variables from .env file.
-include .env
export

# Define the default cluster. Can be overridden: make deploy CLUSTER=devnet
CLUSTER ?= devnet

# Define RPC URLs for different clusters.
LOCALNET_RPC_URL := http://localhost:8899
DEVNET_RPC_URL ?= https://api.devnet.solana.com
MAINNET_RPC_URL ?= https://api.mainnet-beta.solana.com

# Automatically select the RPC URL based on the CLUSTER variable.
ifeq ($(CLUSTER), localnet)
    RPC_URL := $(LOCALNET_RPC_URL)
else ifeq ($(CLUSTER), devnet)
    RPC_URL := $(DEVNET_RPC_URL)
else ifeq ($(CLUSTER), mainnet-beta)
    RPC_URL := $(MAINNET_RPC_URL)
else
    $(error Invalid CLUSTER specified. Use localnet, devnet, or mainnet-beta)
endif

# --- Automatic Project Detection ---
# Assumes a single program named 'state-pass' after anchor init state-pass
# Note: Anchor uses snake_case in the programs directory and inside Rust.

# Hardcode the program name for robustness in a single-program workspace
PROGRAM_NAME := state_pass

# Auto-detect the program ID from the `declare_id!` macro in lib.rs.
# This assumes the lib.rs file exists.
PROGRAM_ID := $(shell grep "declare_id!" programs/$(PROGRAM_NAME)/src/lib.rs | cut -d '"' -f 2)

# --- Project Variables ---

# Default wallet path.
WALLET ?= ~/.config/solana/id.json

# Build artifacts paths
PROGRAM_SO := target/deploy/$(PROGRAM_NAME).so
IDL_JSON := target/idl/$(PROGRAM_NAME).json

# Priority fee for transactions, in micro-lamports.
COMPUTE_UNIT_PRICE ?= 100000

# Helper variable for common provider arguments. RPC_URL is quoted for safety.
PROVIDER_ARGS := --provider.cluster "$(RPC_URL)" --provider.wallet $(WALLET)

# --- Commands ---

.DEFAULT_GOAL := help

.PHONY: all build clean test size deploy upgrade idl-init idl-upgrade full-deploy fmt lint archive-idl info help start-localnet stop-localnet reset-localnet check-balance

all: build

# --- Utility & Information ---

info: ## 🔍 Display auto-detected project variables.
	@echo "--- Project Information ---"
	@echo "Program Name:    \033[32m$(PROGRAM_NAME)\033[0m"
	@echo "Program ID:      \033[32m$(PROGRAM_ID)\033[0m"
	@echo "Cluster:         \033[32m$(CLUSTER)\033[0m"
	@echo "RPC URL:         \033[32m$(RPC_URL)\033[0m"
	@echo "Wallet Path:     \033[32m$(WALLET)\033[0m"
	@echo "Compute Price:   \033[32m$(COMPUTE_UNIT_PRICE) µ-lamports\033[0m"
	@echo "---------------------------"

check-balance: ## 💰 Check wallet balance on the current cluster.
	@echo "Checking wallet balance on $(CLUSTER)..."
	@solana balance --url $(RPC_URL)

# --- Local Validator Control ---

start-localnet: ## 🟢 Start a local Solana validator for development.
	@echo "Starting local Solana validator..."
	@solana-test-validator --reset

stop-localnet: ## 🛑 Stop the local Solana validator.
	@echo "Stopping local Solana validator..."
	@pkill -f solana-test-validator || echo "No local validator running"

reset-localnet: stop-localnet start-localnet ## ♻️ Reset the local Solana validator (stop and restart).
	@echo "Local validator reset complete!"

# --- Project Setup & Cleaning ---

clean: ## 🧹 Full clean: remove build artifacts and node dependencies.
	@echo "Cleaning project..."
	@rm -rf target/
	@rm -rf node_modules/
	@rm -f yarn.lock pnpm-lock.yaml bun.lockb
	@pnpm install
	@echo "Done."

# --- Code Quality ---

fmt: ## ✨ Format the Rust code.
	@echo "Formatting Rust code..."
	@cargo fmt --all

lint: fmt ## 🔎 Run clippy linter checks.
	@echo "Running clippy linter..."
	@cargo clippy --all -- -D warnings
	@echo "Running TypeScript/JavaScript linting..."
	@pnpm lint || echo "Note: pnpm lint requires the command to be defined in package.json"

# --- Build & Test ---

build: fmt ## 🦀 Build the Anchor program.
	@echo "Building program '$(PROGRAM_NAME)'..."
	@anchor build

test: build ## 🧪 Run tests against the local validator.
	@echo "Running tests on localnet..."
	# Anchor test automatically starts the local validator if not running.
	@anchor test

size: build ## 📏 Check the compiled program's size.
	@echo "Checking program size..."
	@ls -lh $(PROGRAM_SO)

# --- Deployment ---

deploy: build ## ⬆️ Deploy the program for the first time.
	@echo "Deploying to cluster: $(CLUSTER)..."
	@anchor deploy --program-name $(PROGRAM_NAME) $(PROVIDER_ARGS) -- --with-compute-unit-price $(COMPUTE_UNIT_PRICE) --max-sign-attempts 100

upgrade: build ## 🔄 Upgrade an existing on-chain program.
	@echo "Upgrading program $(PROGRAM_ID) on cluster: $(CLUSTER)..."
	@anchor upgrade $(PROGRAM_SO) --program-id $(PROGRAM_ID) $(PROVIDER_ARGS) -- --with-compute-unit-price $(COMPUTE_UNIT_PRICE) --max-sign-attempts 100

idl-init: ## 📜 Initialize the IDL on-chain.
	@echo "Initializing IDL for program $(PROGRAM_ID) on cluster: $(CLUSTER)..."
	@anchor idl init --filepath $(IDL_JSON) $(PROGRAM_ID) $(PROVIDER_ARGS)

idl-upgrade: build ## ⬆️ Upgrade the on-chain IDL.
	@echo "Upgrading IDL for program $(PROGRAM_ID) on cluster: $(CLUSTER)..."
	@anchor idl upgrade --filepath $(IDL_JSON) $(PROGRAM_ID) $(PROVIDER_ARGS)

full-deploy: build deploy idl-init ## 🚀 Perform a full initial deployment with IDL setup.
	@echo "Full deployment and IDL initialization on cluster: $(CLUSTER) complete."

# --- Archiving ---

archive-idl: build ## 📦 Archive the current IDL to the 'idls' directory with a timestamp.
	@echo "Archiving current IDL..."
	@mkdir -p idls
	@TIMESTAMP=$$(date +'%Y-%m-%d-%H%M%S'); \
	DEST_FILE="idls/$(PROGRAM_NAME)-$${TIMESTAMP}.json"; \
	cp $(IDL_JSON) "$${DEST_FILE}"; \
	echo "IDL successfully archived to $${DEST_FILE}"

# --- Help ---

help: ## 🙋 Show this help message.
	@echo "Usage: make [command] [CLUSTER=devnet]"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make info                       # Show current settings"
	@echo "  make deploy CLUSTER=devnet      # Deploy to Devnet"
	@echo "  make full-deploy CLUSTER=devnet # First-time deploy + IDL init"
